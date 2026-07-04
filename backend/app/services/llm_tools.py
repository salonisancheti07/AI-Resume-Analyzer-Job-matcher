import os
import re
import json
from openai import OpenAI
from app.core.config import get_settings
from app.services.mock_llm import get_mock_response
from app.services.ats_checker import ATSChecker
from app.services.resume_intelligence import build_job_profile, extract_resume_profile

settings = get_settings()


def _first_present(items: list[str], fallback: str = "") -> str:
    for item in items:
        cleaned = " ".join(str(item or "").split())
        if cleaned:
            return cleaned
    return fallback


def _extract_resume_achievements(resume_text: str, limit: int = 8) -> list[str]:
    achievements = []
    for raw_line in (resume_text or "").splitlines():
        line = re.sub(r"^(?:[-*•]\s+|\d+\.\s+)", "", raw_line).strip()
        if not line or len(line.split()) < 3:
            continue
        has_metric = bool(re.search(r"\b\d+(?:\.\d+)?%?|\$|₹|users?|clients?|projects?|months?|weeks?|hours?\b", line, re.I))
        has_impact = bool(re.search(r"\b(improved|reduced|increased|optimized|automated|built|created|developed|led|launched|delivered|designed|implemented)\b", line, re.I))
        if has_metric or has_impact:
            achievements.append(line)
    return achievements[:limit]


def _section_recommendations(profile: dict, ats_result: dict) -> list[str]:
    recommendations = []
    sections = profile.get("sections", {})
    if not sections.get("summary"):
        recommendations.append("Add a focused Summary section that names the target role and strongest stack.")
    if not sections.get("skills"):
        recommendations.append("Add a dedicated Skills section so ATS systems can parse core keywords.")
    if not sections.get("projects") and profile.get("projects"):
        recommendations.append("Rename the Projects heading clearly and keep each project tied to stack plus outcome.")
    if profile.get("bullet_count", 0) < 4:
        recommendations.append("Use more bullet-led experience/project entries with action, tool, and result.")
    for issue in ats_result.get("issues", [])[:4]:
        fix = issue.get("fix") or issue.get("recommendation") or issue.get("issue")
        if fix:
            recommendations.append(str(fix))
    return list(dict.fromkeys(recommendations))[:6]


def build_resume_reasoning_context(resume_text: str = "", job_description: str = "", role: str = "") -> dict:
    """Build deterministic structured context used by AI Mode before every answer."""
    profile = extract_resume_profile(resume_text or "", preferred_role=role or "")
    job_profile = build_job_profile(job_description or "", fallback_roles=profile.get("target_roles", []))
    ats_result = ATSChecker().check_resume(resume_text or "", job_description or "")

    resume_skills = set(profile.get("skills", []))
    required_skills = set(job_profile.get("market_required_skills", []))
    preferred_skills = set(job_profile.get("market_preferred_skills", []))
    jd_keywords = set(job_profile.get("keywords", []))
    target_terms = required_skills | preferred_skills | jd_keywords
    matched_skills = sorted(resume_skills & (required_skills | preferred_skills))
    missing_skills = sorted((required_skills | jd_keywords) - resume_skills)[:14]
    keyword_hits = sorted(
        keyword for keyword in jd_keywords
        if re.search(rf"\b{re.escape(keyword.lower())}\b", (resume_text or "").lower())
    )

    if target_terms:
        match_percentage = round((len((resume_skills | set(keyword_hits)) & target_terms) / max(1, len(target_terms))) * 100)
    else:
        match_percentage = min(95, 45 + min(len(resume_skills), 25) * 2 + min(len(profile.get("projects", [])), 4) * 4)

    ats_score = ats_result.get("score") or ats_result.get("ats_score") or ats_result.get("overall_score") or 0
    deductions = []
    for issue in ats_result.get("issues", [])[:6]:
        label = issue.get("issue") or issue.get("message") or issue.get("fix")
        severity = issue.get("severity", "medium")
        if label:
            deductions.append({"severity": severity, "reason": label})

    learning_roadmap = []
    for index, skill in enumerate(missing_skills[:5], start=1):
        learning_roadmap.append(
            {
                "step": index,
                "skill": skill,
                "action": f"Build or update one resume-backed project/bullet that truthfully demonstrates {skill}.",
            }
        )

    return {
        "resume_profile": {
            "skills": profile.get("skills", [])[:30],
            "tools": profile.get("tools", [])[:20],
            "projects": profile.get("projects", [])[:8],
            "experience": profile.get("experience_entries", [])[:6],
            "education_level": profile.get("education_level", ""),
            "education_entries": profile.get("education_entries", [])[:5],
            "certifications": profile.get("certifications", [])[:8],
            "achievements": _extract_resume_achievements(resume_text or ""),
            "job_titles": profile.get("job_titles", [])[:8],
            "target_roles": profile.get("target_roles", [])[:5],
            "sections": profile.get("sections", {}),
            "word_count": profile.get("word_count", 0),
            "bullet_count": profile.get("bullet_count", 0),
        },
        "job_profile": job_profile,
        "ats_analysis": {
            "score": ats_score,
            "deductions": deductions,
            "missing_keywords": missing_skills,
            "section_recommendations": _section_recommendations(profile, ats_result),
        },
        "job_match": {
            "match_percentage": match_percentage,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "matched_keywords": keyword_hits[:12],
            "learning_roadmap": learning_roadmap,
        },
    }


def _compact_reasoning_context(context: dict) -> str:
    try:
        return json.dumps(context, ensure_ascii=False, indent=2)[:9000]
    except Exception:
        return "{}"


def _profile_signature(context: dict) -> dict:
    profile = context.get("resume_profile", {})
    projects = profile.get("projects", [])
    experience = profile.get("experience", [])
    return {
        "skills": profile.get("skills", [])[:10],
        "project": _first_present([p.get("name", "") for p in projects], "the strongest resume project"),
        "project_detail": _first_present([p.get("description", "") for p in projects], ""),
        "experience": _first_present([e.get("title", "") for e in experience], "the most relevant experience"),
        "achievement": _first_present(profile.get("achievements", []), ""),
        "education": _first_present(profile.get("education_entries", []), profile.get("education_level", "")),
    }


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key, timeout=8.0, max_retries=0) if api_key else None


def _openai_error_message(exc: Exception) -> str:
    error_text = str(exc).lower()
    if "invalid_api_key" in error_text or "incorrect api key" in error_text or "401" in error_text:
        return (
            "OpenAI API key is invalid. Create a new key in the OpenAI dashboard, "
            "put it in backend/.env as OPENAI_API_KEY, then restart the backend server."
        )
    if "insufficient_quota" in error_text or "429" in error_text:
        return (
            "OpenAI quota or rate limit is blocking the request. Check billing/usage for the "
            "OpenAI project tied to this API key, then restart the backend after updating it."
        )
    return ""


def _chat(system: str, user: str, model: str | None = None, temperature: float = 0.6) -> str:
    client = _get_client()
    if client is None:
        # Local mock fallback for development when no API key is set
        return get_mock_response([{"role": "system", "content": system}, {"role": "user", "content": user}], mode="resume")

    try:
        resp = client.chat.completions.create(
            model=model or settings.llm_model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=temperature,
        )
        return resp.choices[0].message.content
    except Exception as exc:
        openai_error = _openai_error_message(exc)
        if openai_error:
            return f"{openai_error}\n\nLocal fallback answer:\n{get_mock_response([{'role': 'system', 'content': system}, {'role': 'user', 'content': user}], mode='resume')}"
        # On any LLM error (including invalid API key), fall back to mock responses for local dev
        return get_mock_response([{"role": "system", "content": system}, {"role": "user", "content": user}], mode="resume")


def _safe_chat(system: str, user: str, model: str | None = None, temperature: float = 0.6, fallback: str = "") -> str:
    try:
        return _chat(system, user, model=model, temperature=temperature)
    except Exception:
        return fallback


def rewrite_resume(resume_text: str) -> str:
    system = "You are an expert resume writer. Rewrite for clarity, brevity, impact; keep bullet style."
    user = f"Rewrite this resume content. Keep it under 400 words. Return bullet sections only.\n\n{resume_text[:6000]}"
    return _chat(system, user, temperature=0.5)


def cover_letter(resume_text: str, job_text: str) -> str:
    system = "You are a concise professional cover letter writer."
    user = f"Write a tailored cover letter (<=200 words) for this job using this resume.\nJob:\n{job_text}\nResume:\n{resume_text[:6000]}"
    return _chat(system, user, temperature=0.55)


def keyword_optimization(resume_text: str, job_text: str) -> str:
    system = "You optimize resumes for ATS keyword matching."
    user = f"List top 15 keywords/phrases to add to the resume to match the job. Output as bullet list.\nJob:\n{job_text}\nResume:\n{resume_text[:6000]}"
    return _chat(system, user, temperature=0.4)


def interview_questions(job_text: str, role: str = "", company: str = "") -> str:
    system = "You generate interview questions for a role."
    user = (
        f"Role: {role or 'general'}\n"
        f"Company: {company or 'any'}\n"
        f"Generate 8 behavior + 7 technical questions for this job. Keep concise.\n{job_text}"
    )
    return _chat(system, user, temperature=0.65)


def career_recommendation(resume_text: str) -> str:
    system = "You are a career coach."
    user = f"Suggest 3 career tracks and 3 next-role titles with rationale based on this resume. Keep under 180 words.\n{resume_text[:6000]}"
    return _chat(system, user, temperature=0.6)


def suggest_follow_up_prompts(mode: str, resume_text: str = "", job_description: str = "") -> list[str]:
    prompts = {
        "resume": [
            "Which 3 bullets should I rewrite first?",
            "Rewrite my summary for stronger ATS performance.",
            "What missing skills should I address honestly?",
        ],
        "job-match": [
            "Which role is my best fit right now?",
            "What should I improve before applying?",
            "How do I explain my gaps in interviews?",
        ],
        "interview": [
            "Ask me a mock interview question for this role.",
            "Turn my experience into a STAR answer.",
            "What technical topics should I revise first?",
        ],
        "career": [
            "What should my next role be?",
            "Which skills give me the best market upside?",
            "How should I position my background for recruiters?",
        ],
    }
    if job_description and mode != "interview":
        return prompts.get(mode, prompts["resume"])[:2] + ["Tailor my resume to this job description."]
    if resume_text and mode == "general":
        return prompts["resume"]
    return prompts.get(mode, [
        "Explain the strongest and weakest parts of my profile.",
        "What should I improve first?",
        "Help me tailor my resume to a target job.",
    ])


def _build_resume_chat_system_prompt(
    mode: str,
    context_summary: str,
    role: str,
    language: str,
    explain_simple: bool,
    structured_context: dict | None = None,
) -> str:
    tone = "Use simple language and short explanations." if explain_simple else "Be detailed, specific, and practical."
    structured_block = _compact_reasoning_context(structured_context or {})
    return f"""You are an intelligent AI career assistant with strong resume, interview, and job-matching skills.
You can also answer normal general questions like a helpful chat assistant when the user is not asking about careers.

Mode: {mode}
Preferred role: {role or 'general'}
Response language: {language}
Profile summary: {context_summary or 'No structured context available.'}
Structured resume/job context:
{structured_block}

Rules:
- Do not use template-style filler or generic praise.
- Be honest, contextual, and actionable.
- Answer the user's latest question directly before giving resume or career advice.
- Before answering, silently analyze the resume profile, the latest question, the relevant resume sections, and the job description if provided.
- Reference actual projects, skills, tools, education, certifications, achievements, and experience from the structured context whenever available.
- For ATS questions, include score, explanation, deductions, missing keywords, and section-wise recommendations.
- For job matching questions, include match percentage, matched skills, missing skills, and a learning roadmap.
- Include a brief visible rationale, but do not expose hidden chain-of-thought or step-by-step private reasoning.
- If the draft answer sounds generic, rewrite it with at least two resume-specific details before responding.
- If the question is unrelated to resumes, jobs, interviews, or careers, answer it normally without forcing career context.
- If asked for improvement advice, prioritize the highest-impact fixes first.
- If information is missing, say what assumption you are making.
- {tone}"""


def _fallback_resume_chat_reply(
    messages: list[dict],
    mode: str,
    context_summary: str,
    resume_text: str = "",
    job_description: str = "",
    explain_simple: bool = False,
    structured_context: dict | None = None,
) -> str:
    user_message = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "").strip()
    if not user_message:
        return "Share a question about your resume, job fit, interview prep, or career direction, and I’ll help based on the context available."

    simple_prefix = "In simple terms: " if explain_simple else ""
    question_lower = user_message.lower()
    career_terms = [
        "ats", "resume", "cv", "job", "role", "apply", "career", "interview",
        "star", "bullet", "summary", "headline", "keyword", "skills", "gap",
        "shortlist", "recruiter", "cover letter", "linkedin",
    ]
    structured_context = structured_context or build_resume_reasoning_context(resume_text, job_description)
    signature = _profile_signature(structured_context)
    profile = structured_context.get("resume_profile", {})
    ats = structured_context.get("ats_analysis", {})
    match = structured_context.get("job_match", {})
    top_skills = ", ".join(signature["skills"][:8]) or "your strongest verified skills"
    project_name = signature["project"]
    project_detail = signature["project_detail"]
    achievement = signature["achievement"]
    education = signature["education"]
    context_line = f"Available context: {context_summary}." if context_summary else "I only have limited profile context."
    if question_lower in {"hi", "hello", "hey", "hii", "hiii"}:
        if resume_text or context_summary:
            return (
                f"{simple_prefix}Hi! I have your resume context loaded, so you can ask me to find problems, "
                "rewrite sections, check ATS fit, prepare interview answers, or compare it with a job description."
            )
        return f"{simple_prefix}Hi! Ask me anything, or upload a resume if you want resume-specific help."

    if mode == "general" and not any(term in question_lower for term in career_terms):
        keywords = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+#.-]{2,}\b", user_message.lower())
        stop_words = {
            "about", "answer", "because", "could", "give", "have", "help", "like",
            "need", "please", "question", "should", "that", "their", "there",
            "this", "what", "when", "where", "which", "with", "would", "your",
        }
        focus_words = []
        for word in keywords:
            if word not in stop_words and word not in focus_words:
                focus_words.append(word)
        focus = ", ".join(focus_words[:6]) or "your question"
        if any(word in question_lower for word in ["why", "how", "what", "explain", "define"]):
            return (
                f"{simple_prefix}Here is a direct answer based on your question: \"{user_message}\"\n\n"
                f"The main topic is {focus}. The best way to handle it is to identify the exact goal, "
                "separate facts from assumptions, and then choose the simplest next action. "
                "If you share more context, I can make the answer more precise instead of giving a broad explanation."
            )
        return (
            f"{simple_prefix}I can help with that.\n\n"
            f"Your request is about {focus}. A good next step is to clarify the desired outcome, "
            "list the important constraints, and then work through the answer step by step. "
            "Share any extra details and I will tailor the response to that situation."
        )

    if any(word in question_lower for word in ["ats", "score", "shortlist"]):
        deductions = ats.get("deductions", [])
        deduction_text = "\n".join(
            f"- {item.get('severity', 'medium').title()}: {item.get('reason')}"
            for item in deductions[:4]
        ) or "- No major ATS parser issues were detected from the available text."
        section_text = "\n".join(f"- {item}" for item in ats.get("section_recommendations", [])[:5]) or "- Keep Summary, Skills, Experience, Projects, and Education clearly labeled."
        missing_text = ", ".join(ats.get("missing_keywords", [])[:8]) or "no obvious hard-skill keywords from the supplied context"
        return (
            f"{simple_prefix}ATS read: {ats.get('score', 0)}/100.\n\n"
            f"Why: the resume shows concrete signals around {top_skills}, especially through {project_name}. "
            f"The main deductions are:\n{deduction_text}\n\n"
            f"Missing or weak keywords: {missing_text}.\n\n"
            f"Section-wise recommendations:\n{section_text}\n\n"
            f"Best next move: rewrite the most relevant {project_name} bullet so it names the stack, scope, and a measurable result. {context_line}"
        )
    if any(word in question_lower for word in ["rewrite", "bullet", "summary", "headline", "improve my resume"]):
        return (
            f"{simple_prefix}Rewrite the resume around measurable outcomes, not responsibilities.\n\n"
            f"Your strongest raw material is {project_name}"
            f"{' - ' + project_detail if project_detail else ''}. "
            f"Use this pattern: Action verb + {top_skills.split(', ')[0] if top_skills else 'tool'} + scope + measurable result + business value.\n"
            f"Example direction: Built or improved {project_name} using {top_skills}, then add a real metric such as users, latency, accuracy, time saved, or adoption.\n\n"
            "Best next edits:\n"
            "1. Replace passive phrases like \"responsible for\" with ownership verbs.\n"
            "2. Add metrics where you can honestly support them.\n"
            f"3. Bring the most relevant skills forward: {top_skills}.\n\n"
            f"{context_line}"
        )
    if any(word in question_lower for word in ["keyword", "skills", "missing", "gap"]):
        missing_text = ", ".join(match.get("missing_skills", [])[:8]) or "no clear JD-specific gaps without a target job description"
        return (
            f"{simple_prefix}Your keyword strategy should separate skills you already have from skills you need to add through projects or learning.\n\n"
            f"Already visible or likely relevant: {top_skills}.\n"
            f"Missing or weak against the current target: {missing_text}.\n"
            "Add missing keywords only if they are truthful, then support them with a project, tool, or result in the Experience or Projects section.\n"
            f"The fastest improvement is to connect those terms to {project_name} or {signature['experience']} instead of only listing them in Skills.\n\n"
            f"{context_line}"
        )
    if any(word in question_lower for word in ["interview", "question", "star", "answer"]) or mode == "interview":
        return (
            f"{simple_prefix}Use {project_name} as your main interview story because it gives you concrete skills to discuss: {top_skills}.\n\n"
            "Practice question: Tell me about a project where you solved a technical problem end to end.\n\n"
            f"Answer shape: Situation: what {project_name} was for. Task: what you owned. Action: how you used {top_skills}. "
            f"Result: add the clearest measurable outcome you can support{', such as ' + achievement if achievement else ', such as accuracy, users, speed, or time saved'}."
        )
    if any(word in question_lower for word in ["job", "role", "match", "apply", "tailor"]) or mode == "job-match":
        missing_text = ", ".join(match.get("missing_skills", [])[:8]) or "no major missing skills detected from the current context"
        matched_text = ", ".join(match.get("matched_skills", [])[:8]) or top_skills
        roadmap = "\n".join(
            f"{item.get('step')}. {item.get('skill')}: {item.get('action')}"
            for item in match.get("learning_roadmap", [])[:5]
        ) or "1. Paste a target JD so I can build a sharper skill roadmap."
        return (
            f"{simple_prefix}Estimated match: {match.get('match_percentage', 0)}%.\n\n"
            f"Matched skills: {matched_text}.\n"
            f"Missing skills/keywords: {missing_text}.\n\n"
            f"Why: {project_name} and {signature['experience']} give you evidence for {top_skills}, but the resume still needs clearer proof against the target requirements.\n\n"
            f"Learning roadmap:\n{roadmap}"
        )
    if any(word in question_lower for word in ["career", "path", "next", "learn", "roadmap"]) or mode == "career":
        return (
            f"{simple_prefix}Choose the next career step by combining your current proof, market demand, and one focused skill gap.\n\n"
            f"Based on the resume, keep building around {top_skills}. "
            f"{project_name} is the best anchor for positioning, and {education} supports the academic/background signal.\n"
            "A practical next move is to create one portfolio or work story that mirrors the role you want, then rewrite your Summary and top project bullet around that target role."
        )
    if "resume" in question_lower or mode == "resume":
        return (
            f"{simple_prefix}The biggest resume gains usually come from stronger keyword alignment, clearer role targeting, and more measurable bullets. "
            f"{context_line} "
            "Start by rewriting the top 3 most relevant bullets for your target job and add missing skills only where they are genuinely true."
        )
    return (
        f"{simple_prefix}For this question, the best next step is to connect your ask to the current resume or job target.\n\n"
        f"Your question: \"{user_message}\"\n"
        f"{context_line}\n"
        "I would answer it by identifying the goal, checking the strongest evidence in your resume, then giving one prioritized action instead of generic advice."
    )


def resume_chat(
    messages: list[dict],
    context_summary: str = "",
    resume_text: str = "",
    job_description: str = "",
    mode: str = "general",
    role: str = "",
    language: str = "English",
    explain_simple: bool = False,
) -> str:
    structured_context = build_resume_reasoning_context(resume_text, job_description, role)
    system_prompt = _build_resume_chat_system_prompt(
        mode,
        context_summary,
        role,
        language,
        explain_simple,
        structured_context=structured_context,
    )
    enriched_messages = [{"role": "system", "content": system_prompt}]
    if resume_text:
        enriched_messages.append({"role": "system", "content": f"Resume context:\n{resume_text[:4000]}"})
    if job_description:
        enriched_messages.append({"role": "system", "content": f"Job description context:\n{job_description[:2500]}"})
    enriched_messages.extend(messages[-12:])

    client = _get_client()
    if client is None:
        return _fallback_resume_chat_reply(
            messages=messages,
            mode=mode,
            context_summary=context_summary,
            resume_text=resume_text,
            job_description=job_description,
            explain_simple=explain_simple,
            structured_context=structured_context,
        )

    try:
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=enriched_messages,
            temperature=0.6,
        )
        return resp.choices[0].message.content
    except Exception as exc:
        openai_error = _openai_error_message(exc)
        fallback_reply = _fallback_resume_chat_reply(
            messages=messages,
            mode=mode,
            context_summary=context_summary,
            resume_text=resume_text,
            job_description=job_description,
            explain_simple=explain_simple,
            structured_context=structured_context,
        )
        if openai_error:
            return fallback_reply
        return _fallback_resume_chat_reply(
            messages=messages,
            mode=mode,
            context_summary=context_summary,
            resume_text=resume_text,
            job_description=job_description,
            explain_simple=explain_simple,
            structured_context=structured_context,
        )


# ============================================================================
# Enhanced ATS-Focused LLM Functions
# ============================================================================

def generate_resume_bullets(prompt: str) -> list[str]:
    """Generate ATS-optimized bullet points"""
    system = """You are an expert ATS-optimized resume writer. Generate bullet points that:
1. Start with strong action verbs (Achieved, Built, Led, Improved, Drove, etc.)
2. Include quantifiable metrics (numbers, percentages, $ amounts)
3. Use simple ATS-friendly language
4. Are clear and impactful
Return ONLY bullet points, one per line, starting with •"""
    
    response = _chat(system, prompt, temperature=0.5)
    # Parse bullet points
    bullets = [line.strip().lstrip("•").strip() for line in response.split("\n") if line.strip()]
    return bullets[:7]  # Return max 7 bullets


def rewrite_resume_section(content: str, job_description: str = "", section_type: str = "experience") -> str:
    """Rewrite specific resume section for ATS optimization"""
    system = f"""You are an expert at rewriting {section_type} sections for ATS optimization and maximum impact.

Guidelines:
- Use action verbs at the start of each line
- Include quantifiable metrics (numbers, percentages, dollar amounts)
- Keep language simple and clear (no jargon)
- Use keywords from the job description when relevant
- Maintain professional tone"""
    
    job_context = f"\n\nJob Description Keywords:\n{job_description[:1000]}" if job_description else ""
    
    user = f"Rewrite this {section_type} section:\n{content}{job_context}\n\nReturn only the rewritten section."
    return _chat(system, user, temperature=0.5)


def generate_tailored_resume(prompt: str) -> str:
    """Generate fully tailored resume for specific job"""
    system = """You are an expert at tailoring resumes for specific job postings. Focus on:
- Matching keywords from the job description
- Emphasizing relevant experience and skills
- Reordering content by relevance and impact
- Maintaining ATS-friendly formatting
- Highlighting quantifiable achievements"""
    
    return _chat(system, prompt, temperature=0.5)


def generate_optimized_resume(prompt: str) -> str:
    """Generate ATS system-specific optimized resume"""
    system = """You are an expert at optimizing resumes for specific ATS systems. Ensure:
- No tables, columns, or complex formatting
- Clear section structure (Contact, Summary, Experience, Education, Skills)
- Single-column layout
- Standard fonts compatible with ATS
- Simple bullet points
- No unusual characters or special formatting"""
    
    return _chat(system, prompt, temperature=0.5)


def extract_key_sections_from_text(file_text: str) -> dict:
    """Extract structured sections from unformatted resume text"""
    system = """Extract resume sections from the given text and structure them. 
    Return a JSON-like format with sections: contact, summary, experience, education, skills, projects
    For each section, extract the key information."""
    
    user = f"Extract and structure the resume sections:\n{file_text[:8000]}\n\nReturn structured sections."
    response = _chat(system, user, temperature=0.4)
    return {"extracted_resume": response}


def enhance_bullet_point(bullet: str, job_description: str = "") -> dict:
    """Enhance single bullet point with metrics and impact"""
    system = """You are an expert at enhancing resume bullet points. Make them more impactful by:
1. Adding or emphasizing metrics (numbers, percentages, money)
2. Starting with strong action verbs if not already
3. Making the impact/outcome clear
4. Keeping it to one line
Return the enhanced bullet and the improvements made."""
    
    job_context = f"\nJob context:\n{job_description[:500]}" if job_description else ""
    user = f"Enhance this bullet:\n{bullet}{job_context}\n\nReturn: [ENHANCED] <new version> then [IMPROVEMENTS] <what changed>"
    return _chat(system, user, temperature=0.5)


def generate_cover_letter_tailored(resume_text: str, job_description: str, company_name: str = "") -> str:
    """Generate highly tailored, ATS-friendly cover letter"""
    system = """You are an expert cover letter writer. Create compelling, ATS-friendly cover letters that:
1. Reference specific skills/projects from the resume that match the job
2. Show understanding of the company and role
3. Include 2-3 quantifiable achievements
4. Use keywords from the job description
5. Keep it to 3-4 short paragraphs (200-250 words)
6. Use simple language (no fancy formatting)"""
    
    company_line = f"Company: {company_name}\n" if company_name else ""
    user = f"""{company_line}Job Description:
{job_description[:2000]}

Resume:
{resume_text[:2000]}

Generate a tailored cover letter."""
    
    return _chat(system, user, temperature=0.6)


def parse_linkedin_profile_text(text: str) -> dict:
    """Convert LinkedIn profile text to resume format"""
    system = """You are an expert at converting LinkedIn profiles to professional resumes.
    Extract and structure the information into resume format with:
    - Contact information
    - Professional summary
    - Work experience (formatted as bullets)
    - Education
    - Skills
    - Certifications/Awards"""
    
    user = f"Convert this LinkedIn profile to resume format:\n{text}\n\nReturn a well-formatted resume."
    response = _chat(system, user, temperature=0.4)
    return {"formatted_resume": response}


def suggest_keywords_for_job(job_description: str, resume_text: str = "") -> list[str]:
    """Suggest top keywords to add based on job and current resume"""
    system = """You are an ATS expert. Identify the most important keywords from a job description 
    that should appear in a resume. Focus on:
    1. Technical skills and tools
    2. Industry-specific terminology
    3. Key responsibilities and competencies
    4. Soft skills if emphasized in the job
    
    Return a ranked list of keywords (most important first)."""
    
    resume_context = f"\n\nCurrent resume keywords:\n{resume_text[:1000]}" if resume_text else ""
    user = f"Job Description:\n{job_description}{resume_context}\n\nList top 20 keywords to include."
    
    response = _chat(system, user, temperature=0.4)
    keywords = [line.strip().lstrip("- •").strip() for line in response.split("\n") if line.strip()]
    return keywords[:20]


def generate_ats_score_explanation(issues: list[dict], score: int) -> str:
    """Generate human-friendly explanation of ATS score and issues"""
    system = """You are an ATS score explainer. Explain an ATS score in simple, actionable terms.
    Focus on:
    1. Why the score is what it is
    2. Top 3 highest-impact issues to fix
    3. Quick wins for improvement
    4. Timeline to improvement"""
    
    issues_str = "\n".join([f"- {issue}" for issue in issues])
    user = f"""ATS Score: {score}/100

Issues Found:
{issues_str}

Explain this score and provide top 3 actionable fixes."""
    
    return _chat(system, user, temperature=0.6)
