"""
ChatGPT-like AI Chat routes for Resume Analysis
- Multi-turn conversations with context awareness
- Streaming responses (Server-Sent Events)
- Resume context integration
- History management
- Enhanced conversational memory
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
import tempfile
import os
import re

from app.services import llm_tools
from app.services.mock_llm import get_mock_response
from app.services.resume_intelligence import extract_resume_profile, summarize_profile_for_chat
from app.nlp.parser import extract_text_from_pdf
from app.nlp.skills import extract_skills, extract_experience_years, extract_education_level

router = APIRouter(prefix="/api/ai-chat")

# ============================================================================
# Pydantic Models
# ============================================================================

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    context: Optional[str] = None  # resume text or job description
    mode: Optional[str] = "general"  # general | resume | job-match | interview | career
    temperature: Optional[float] = 0.7


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    resume_text: Optional[str] = None
    job_description: Optional[str] = None


# ============================================================================
# In-Memory Storage (replace with DB in production)
# ============================================================================

conversations = {}  # {conversation_id: {"title": str, "messages": [...], "context": {...}}}
conversation_history = {}  # {conversation_id: [...messages...]}


# ============================================================================
# Context-Aware System Prompts (Enhanced)
# ============================================================================

SYSTEM_PROMPTS = {
    "general": """You are an expert AI career coach and resume specialist. You help users:
- Improve their resumes and cover letters
- Prepare for interviews
- Optimize for ATS (Applicant Tracking Systems)
- Navigate career decisions
- Match their skills to job opportunities

Be conversational, practical, and encouraging. Provide specific, actionable advice.
Always reference the user's specific resume content when giving advice.
If you don't have resume context, ask for it to provide personalized guidance.""",

    "resume": """You are an expert resume writer and ATS optimization specialist. You help users:
- Rewrite resume sections for maximum impact
- Add quantifiable metrics and achievements
- Optimize for ATS systems (Workday, Taleo, Greenhouse, etc.)
- Improve bullet point quality
- Structure their experience effectively

Provide specific examples and ask clarifying questions to give precise guidance.
Analyze the user's actual resume content and provide targeted improvements.""",

    "job-match": """You are an expert recruiter and job matching specialist. You help users:
- Understand job requirements and how they match
- Identify skill gaps
- Tailor their resume for specific positions
- Prepare for role-specific interviews
- Understand compensation and career growth

Be detailed and strategic in your recommendations.
Use the user's extracted skills and experience to suggest specific roles.""",

    "interview": """You are an experienced interview coach. You help users:
- Prepare for technical and behavioral interviews
- Practice answering questions using the STAR method
- Develop compelling stories from their experience
- Build confidence for interviews
- Handle difficult questions

Ask clarifying questions and provide practice opportunities.
Tailor questions to the user's specific background and target roles.""",

    "career": """You are a career strategy advisor. You help users:
- Explore career paths based on their skills
- Identify next-step roles and industries
- Build a growth plan
- Understand market opportunities
- Make strategic career moves

Be thoughtful and data-driven in your recommendations.
Use the user's skills and experience to suggest concrete career paths.""",
}


# ============================================================================
# Context Extraction & Analysis
# ============================================================================

def extract_resume_context(resume_text: str) -> Dict:
    """Extract key information from resume for context-aware responses"""
    if not resume_text:
        return {}
    
    skills = extract_skills(resume_text)
    experience_years = extract_experience_years(resume_text)
    education = extract_education_level(resume_text)
    
    # Extract recent role indicators
    role_indicators = []
    role_patterns = [
        r'(?:senior|lead|principal|staff)?\s*(?:software|full.?stack|frontend|backend|data|ml|product)?\s*(?:engineer|developer|manager|analyst)',
    ]
    for pattern in role_patterns:
        matches = re.findall(pattern, resume_text.lower())
        role_indicators.extend(matches)
    
    return {
        "skills": skills,
        "experience_years": experience_years,
        "education": education,
        "detected_roles": list(set(role_indicators))[:3],
        "word_count": len(resume_text.split()),
    }


def build_context_summary(context: Dict) -> str:
    """Build a summary string from extracted context"""
    if not context:
        return "No resume context available."
    
    parts = []
    
    if context.get("skills"):
        parts.append(f"Skills: {', '.join(context['skills'][:8])}")
    
    if context.get("experience_years"):
        parts.append(f"Experience: {context['experience_years']} years")
    
    if context.get("education"):
        parts.append(f"Education: {context['education']}")
    
    if context.get("detected_roles"):
        parts.append(f"Current roles: {', '.join(context['detected_roles'])}")
    
    return " | ".join(parts) if parts else "Limited resume data available."


def _compose_chat_context(raw_context: str, job_description: str = "") -> str:
    return summarize_profile_for_chat(raw_context or "", job_description or "")


def detect_intent(user_message: str) -> str:
    """Detect user intent from message for better routing"""
    message_lower = user_message.lower()
    
    # Resume-related intents
    if any(kw in message_lower for kw in ["resume", "cv", "bullet", "rewrite", "improve"]):
        return "resume"
    
    # Interview-related intents
    if any(kw in message_lower for kw in ["interview", "question", "prepare", "star", "answer"]):
        return "interview"
    
    # Job-related intents
    if any(kw in message_lower for kw in ["job", "role", "position", "apply", "match", "career"]):
        return "job-match"
    
    # Career planning intents
    if any(kw in message_lower for kw in ["career", "path", "growth", "transition", "promotion"]):
        return "career"
    
    return "general"


# ============================================================================
# Helper Functions
# ============================================================================

def get_system_prompt(mode: str) -> str:
    """Get system prompt based on chat mode"""
    return SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general"])


def format_context_for_system(context: Optional[str], context_type: str = "resume") -> str:
    """Format context information to include in system prompt"""
    if not context:
        return ""
    
    lines = context.split("\n")[:20]  # First 20 lines
    context_preview = "\n".join(lines)
    
    if len(context) > 1000:
        context_preview += f"\n... ({len(context)} total characters)"
    
    return f"\n\nUser's {context_type} context:\n{context_preview}"


# ============================================================================
# Chat Endpoints
# ============================================================================

@router.post("/send")
async def send_message(request: ChatRequest):
    """
    Send a message to AI and get response (non-streaming)
    
    Enhanced with:
    - Context-aware responses using extracted resume data
    - Intent detection for better mode routing
    - Personalized responses based on user's skills/experience
    
    Request:
    {
        "messages": [{"role": "user", "content": "..."}],
        "context": "optional resume or job description",
        "mode": "general|resume|job-match|interview|career",
        "temperature": 0.7
    }
    """
    try:
        # Auto-detect intent if in general mode
        mode = request.mode or "general"
        if mode == "general" and request.messages:
            last_user_message = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
            if last_user_message:
                detected_intent = detect_intent(last_user_message)
                if detected_intent != "general":
                    mode = detected_intent
        
        # Extract resume context for personalization
        resume_context = {}
        if request.context:
            resume_context = extract_resume_context(request.context)
        
        # Build system prompt with enhanced context
        system_prompt = get_system_prompt(mode)

        # Add resume context summary
        if resume_context:
            context_summary = build_context_summary(resume_context)
            system_prompt += f"\n\nUser Profile Summary: {context_summary}"
        else:
            context_summary = _compose_chat_context(request.context or "")

        if request.context:
            system_prompt += format_context_for_system(request.context, "resume/job context")
        reply = llm_tools.resume_chat(
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            context_summary=context_summary,
            resume_text=request.context or "",
            mode=mode,
            explain_simple=False,
        )
        
        return {
            "role": "assistant",
            "content": reply,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }
    
    except Exception as e:
        # Handle quota/error - fall back to mock LLM
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "429" in error_msg:
            # Use mock LLM for testing
            reply = get_mock_response(
                [{"role": m.role, "content": m.content} for m in request.messages],
                request.mode or "general",
                request.context
            )
            return {
                "role": "assistant",
                "content": f"📌 **Using Test Mode** (No OpenAI credits)\n\n{reply}",
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                }
            }
        raise HTTPException(status_code=400, detail=error_msg)


@router.post("/stream")
async def stream_message(request: ChatRequest):
    """
    Send a message and get streaming response (Server-Sent Events)
    
    This endpoint returns a streaming response using Server-Sent Events protocol.
    The frontend should read streaming data using EventSource API.
    """
    try:
        # Build system prompt with context
        system_prompt = get_system_prompt(request.mode or "general")
        if request.context:
            system_prompt += format_context_for_system(request.context, "context")
        context_summary = _compose_chat_context(request.context or "")
        
        # Build messages for API
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend([{"role": m.role, "content": m.content} for m in request.messages])
        
        # Stream response from LLM
        from openai import OpenAI
        from app.core.config import get_settings
        from fastapi.responses import StreamingResponse
        
        settings = get_settings()
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.openai_api_key))
        
        async def event_generator():
            try:
                reply = llm_tools.resume_chat(
                    messages=[{"role": m.role, "content": m.content} for m in request.messages],
                    context_summary=context_summary,
                    resume_text=request.context or "",
                    mode=request.mode or "general",
                    explain_simple=False,
                )
                for word in reply.split():
                    yield f"data: {json.dumps({'content': word + ' '})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            
            except Exception as e:
                error_str = str(e)
                if "insufficient_quota" in error_str or "429" in error_str:
                    # Use mock LLM
                    mock_reply = get_mock_response(
                        [{"role": m.role, "content": m.content} for m in request.messages],
                        request.mode or "general",
                        request.context
                    )
                    full_response = f"📌 **Using Test Mode** (No OpenAI credits)\n\n{mock_reply}"
                    # Stream the mock response word by word
                    for word in full_response.split():
                        yield f"data: {json.dumps({'content': word + ' '})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"
                else:
                    yield f"data: {json.dumps({'error': error_str})}\n\n"
        
        return StreamingResponse(event_generator(), media_type="text/event-stream")
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/conversation/create")
async def create_conversation(req: ConversationCreate):
    """Create a new conversation with optional context"""
    try:
        conv_id = str(uuid.uuid4())[:8]
        
        conversations[conv_id] = {
            "id": conv_id,
            "title": req.title or "New conversation",
            "created_at": datetime.now().isoformat(),
            "resume_text": req.resume_text or None,
            "job_description": req.job_description or None,
            "messages": [],
        }
        
        conversation_history[conv_id] = []
        
        return {
            "conversation_id": conv_id,
            "title": conversations[conv_id]["title"],
            "created_at": conversations[conv_id]["created_at"],
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation details and history"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[conversation_id]
    return {
        "id": conv["id"],
        "title": conv["title"],
        "created_at": conv["created_at"],
        "messages": conversation_history.get(conversation_id, []),
        "has_resume": bool(conv.get("resume_text")),
        "has_job_desc": bool(conv.get("job_description")),
    }


@router.post("/conversation/{conversation_id}/message")
async def send_conversation_message(
    conversation_id: str,
    message: Message,
    mode: str = Query("general")
):
    """Send a message in a conversation"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    try:
        conv = conversations[conversation_id]
        
        # Get system prompt with context
        system_prompt = get_system_prompt(mode)
        context = conv.get("resume_text") or conv.get("job_description")
        if context:
            system_prompt += format_context_for_system(context, "user context")
        history_messages = [{"role": msg["role"], "content": msg["content"]} for msg in conversation_history.get(conversation_id, [])]
        history_messages.append({"role": message.role, "content": message.content})
        reply = llm_tools.resume_chat(
            messages=history_messages,
            context_summary=_compose_chat_context(conv.get("resume_text") or "", conv.get("job_description") or ""),
            resume_text=conv.get("resume_text") or "",
            job_description=conv.get("job_description") or "",
            mode=mode,
        )
        
        # Save to history
        if conversation_id not in conversation_history:
            conversation_history[conversation_id] = []
        
        conversation_history[conversation_id].append(
            {"role": "user", "content": message.content}
        )
        conversation_history[conversation_id].append(
            {"role": "assistant", "content": reply}
        )
        
        return {
            "role": "assistant",
            "content": reply,
            "conversation_id": conversation_id,
        }
    
    except Exception as e:
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "429" in error_msg:
            # Use mock LLM
            hist = conversation_history.get(conversation_id, [])
            mock_reply = get_mock_response(
                [{"role": msg["role"], "content": msg["content"]} for msg in hist] 
                + [{"role": message.role, "content": message.content}],
                mode,
                conversations[conversation_id].get("resume_text")
            )
            reply = f"📌 **Using Test Mode** (No OpenAI credits)\n\n{mock_reply}"
            
            # Save to history
            if conversation_id not in conversation_history:
                conversation_history[conversation_id] = []
            
            conversation_history[conversation_id].append(
                {"role": "user", "content": message.content}
            )
            conversation_history[conversation_id].append(
                {"role": "assistant", "content": reply}
            )
            
            return {
                "role": "assistant",
                "content": reply,
                "conversation_id": conversation_id,
            }
        raise HTTPException(status_code=400, detail=error_msg)


@router.get("/conversations")
async def list_conversations():
    """List all conversations"""
    return [
        {
            "id": conv["id"],
            "title": conv["title"],
            "created_at": conv["created_at"],
            "messages_count": len(conversation_history.get(conv["id"], [])),
        }
        for conv in conversations.values()
    ]


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation"""
    if conversation_id in conversations:
        del conversations[conversation_id]
    if conversation_id in conversation_history:
        del conversation_history[conversation_id]
    
    return {"deleted": True}


@router.post("/resume-context")
async def upload_resume_context(file: UploadFile = File(...)):
    """Upload resume PDF and extract context"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        
        resume_text = extract_text_from_pdf(tmp_path)
        os.remove(tmp_path)
        profile = extract_resume_profile(resume_text)
        reasoning_context = llm_tools.build_resume_reasoning_context(resume_text)
        
        return {
            "text": resume_text,
            "resume_text": resume_text,
            "word_count": len(resume_text.split()),
            "skills": list(profile["skills"]),
            "structured_profile": profile,
            "reasoning_context": reasoning_context,
            "preview": resume_text[:500],
            "summary": {
                "name": "",
                "top_skills": profile["skills"][:8],
                "projects": [project.get("name", "") for project in profile["projects"][:3]],
                "experience": [entry.get("title", "") for entry in profile["experience_entries"][:3]],
                "education_level": profile["education_level"],
            },
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze-context")
async def analyze_context(
    text: str = Form(...),
    context_type: str = Form("resume")  # resume | job-description
):
    """Analyze resume or job description for key information"""
    try:
        skills = extract_skills(text)
        word_count = len(text.split())
        
        # Extract key sections
        sections_found = []
        section_keywords = {
            "experience": ["experience", "employment", "work history"],
            "education": ["education", "degree", "university", "college"],
            "skills": ["skills", "technical", "proficiencies"],
            "projects": ["projects", "portfolio", "built"],
            "achievements": ["achievements", "awards", "recognition"],
        }
        
        text_lower = text.lower()
        for section, keywords in section_keywords.items():
            if any(kw in text_lower for kw in keywords):
                sections_found.append(section)
        
        return {
            "context_type": context_type,
            "word_count": word_count,
            "skills_found": list(skills),
            "sections_found": sections_found,
            "is_valid": word_count > 50,  # Need at least 50 words
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
