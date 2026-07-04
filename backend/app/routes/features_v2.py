"""
Enhanced API Routes for all 12 ATS-Focused Features
Integrates: ATS Checker, Resume Writer, Templates, Examples, Export, etc.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import tempfile
import os

from app.nlp.parser import extract_text_from_pdf
from app.services.ats_checker import ATSChecker
from app.services.resume_writer import ResimeWriter
from app.services.template_library import ResumeTemplateLibrary, ResumeExampleLibrary
from app.services import llm_tools
from app.services.export_service import ShareableResumeLink, ResumeExport, ResumePDFGenerator

# Pydantic models for request/response
class ATSCheckRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


class ATSCheckResponse(BaseModel):
    ats_score: int
    issues: list
    recommendations: list
    details: dict


class GenerateBulletsRequest(BaseModel):
    role: str
    years: int
    skills: List[str]
    achievements: List[str]
    job_description: Optional[str] = None


class TailorResumeRequest(BaseModel):
    resume_text: str
    job_description: str


class ResumeShareRequest(BaseModel):
    resume_text: str
    ats_score: int
    name: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    ats_friendly: bool
    ats_score: int


# Initialize services
ats_checker = ATSChecker()
resume_writer = ResimeWriter()

# Create router
router = APIRouter(prefix="/api/v2", tags=["ATS Features"])


# ============================================================================
# 1. COMPREHENSIVE ATS CHECKER (Feature #2)
# ============================================================================

@router.post("/ats-check", response_model=ATSCheckResponse)
async def comprehensive_ats_check(request: ATSCheckRequest):
    """
    Comprehensive ATS check with detailed issues and recommendations
    Focus: Formatting, structure, content quality, keywords, word count, contact info
    """
    result = ats_checker.check_resume(request.resume_text, request.job_description or "")
    return {
        "ats_score": result["ats_score"],
        "issues": result["issues"],
        "recommendations": result["recommendations"],
        "details": result["details"],
    }


@router.post("/ats-check/file")
async def ats_check_pdf(file: UploadFile = File(...), job_description: str = Form("")):
    """Check PDF resume for ATS compatibility"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    
    resume_text = extract_text_from_pdf(tmp_path)
    os.remove(tmp_path)
    
    result = ats_checker.check_resume(resume_text, job_description)
    return {
        "filename": file.filename,
        "ats_score": result["ats_score"],
        "issues": result["issues"],
        "recommendations": result["recommendations"],
    }


# ============================================================================
# 2. AI-POWERED RESUME WRITER (Feature #1)
# ============================================================================

@router.post("/writer/generate-bullets")
async def generate_optimized_bullets(request: GenerateBulletsRequest):
    """
    Generate ATS-optimized bullet points for a role
    Focus: Action verbs, metrics, keywords
    """
    return resume_writer.generate_bullets(
        role=request.role,
        years=request.years,
        skills=request.skills,
        achievements=request.achievements,
        job_description=request.job_description or "",
    )


@router.post("/writer/rewrite-for-ats")
async def rewrite_resume_for_ats(request: TailorResumeRequest):
    """
    Rewrite entire resume optimized for ATS
    Includes: Section rewrites, keyword optimization, formatting fixes
    """
    result = resume_writer.rewrite_for_ats(request.resume_text, request.job_description)
    return result


@router.post("/writer/tailor-for-job")
async def tailor_resume_for_job(request: TailorResumeRequest):
    """
    Tailor resume for specific job posting
    Focus: Keyword matching, experience reordering, relevant skills emphasis
    """
    result = resume_writer.tailor_for_job(request.resume_text, request.job_description)
    return result


@router.post("/writer/optimize-for-ats-system")
async def optimize_for_ats_system(resume_text: str = Form(...), ats_system: str = Form("generic")):
    """
    Optimize resume for specific ATS system (Workday, Taleo, etc.)
    Systems: generic, workday, taleo
    """
    result = resume_writer.optimize_for_ats_system(resume_text, ats_system)
    return result


@router.post("/writer/enhance-bullet")
async def enhance_single_bullet(
    bullet: str = Form(...),
    job_description: Optional[str] = Form(None),
):
    """Enhance a single bullet point with metrics and impact"""
    result = llm_tools.enhance_bullet_point(bullet, job_description or "")
    return {"enhanced_bullet": result}


# ============================================================================
# 3. TEMPLATE LIBRARY (Feature #8)
# ============================================================================

@router.get("/templates")
async def get_all_templates():
    """Get all ATS-friendly resume templates"""
    templates = ResumeTemplateLibrary.get_all_templates()
    return {
        "total": len(templates),
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "industry": t.industry,
                "level": t.level,
                "ats_score": t.ats_score,
                "ats_friendly": t.is_ats_friendly,
            }
            for t in templates.values()
        ],
    }


@router.get("/templates/ats-friendly")
async def get_ats_friendly_templates():
    """Get only ATS-optimized templates (score >= 85)"""
    templates = ResumeTemplateLibrary.get_ats_friendly_templates()
    return {"templates": [t.name for t in templates.values()]}


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get specific template"""
    template = ResumeTemplateLibrary.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/templates/by-level/{level}")
async def get_templates_by_level(level: str):
    """Get templates for career level (entry, mid, senior, executive)"""
    templates = ResumeTemplateLibrary.get_templates_by_level(level)
    return {"templates": list(templates.keys())}


# ============================================================================
# 4. RESUME EXAMPLES LIBRARY  (Feature #9)
# ============================================================================

@router.get("/examples")
async def get_all_examples():
    """Get all resume examples"""
    examples = ResumeExampleLibrary.get_all_examples()
    return {
        "total": len(examples),
        "examples": [
            {
                "id": e.id,
                "title": e.title,
                "role": e.role,
                "industry": e.industry,
                "level": e.level,
                "company": e.company,
                "ats_score": e.ats_score,
                "keywords": e.keywords,
            }
            for e in examples
        ],
    }


@router.get("/examples/role/{role}")
async def get_examples_by_role(role: str):
    """Get resume examples for specific role"""
    examples = ResumeExampleLibrary.get_examples_by_role(role)
    return {"examples": [e.title for e in examples]}


@router.get("/examples/level/{level}")
async def get_examples_by_level(level: str):
    """Get examples by level (entry, mid, senior)"""
    examples = ResumeExampleLibrary.get_examples_by_level(level)
    return {"examples": [e.title for e in examples]}


@router.get("/examples/high-ats-score")
async def get_high_ats_examples(min_score: int = 85):
    """Get examples with high ATS scores"""
    examples = ResumeExampleLibrary.get_high_ats_score_examples(min_score)
    return {"examples": [e.title for e in examples], "min_score": min_score}


@router.get("/examples/search")
async def search_examples(query: str):
    """Search examples by keywords, role, industry"""
    examples = ResumeExampleLibrary.search_examples(query)
    return {
        "query": query,
        "results_count": len(examples),
        "examples": [e.title for e in examples],
    }


# ============================================================================
# 5. IMPORT FROM LINKEDIN / EXISTING RESUME (Feature #10)
# ============================================================================

@router.post("/import/pdf")
async def import_resume_pdf(file: UploadFile = File(...)):
    """Import and parse resume from PDF"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    
    resume_text = extract_text_from_pdf(tmp_path)
    os.remove(tmp_path)
    
    # Extract structured sections
    sections = resume_writer._parse_resume_sections(resume_text)
    
    return {
        "filename": file.filename,
        "text": resume_text,
        "sections": sections,
        "word_count": len(resume_text.split()),
    }


@router.post("/import/linkedin-text")
async def import_linkedin_profile(profile_text: str = Form(...)):
    """Convert LinkedIn profile to professional resume format"""
    formatted = llm_tools.parse_linkedin_profile_text(profile_text)
    return formatted


# ============================================================================
# 6. AI COVER LETTER Generator (Feature #6)
# ============================================================================

@router.post("/cover-letter/generate")
async def generate_cover_letter(
    resume_text: str = Form(...),
    job_description: str = Form(...),
    company_name: Optional[str] = Form(None),
):
    """Generate tailored, ATS-friendly cover letter"""
    cover_letter = llm_tools.generate_cover_letter_tailored(
        resume_text, job_description, company_name or ""
    )
    return {"cover_letter": cover_letter}


# ============================================================================
# 7. PDF EXPORT & SHAREABLE LINKS (Feature #12)
# ============================================================================

@router.post("/export/pdf")
async def export_pdf(resume_text: str = Form(...), ats_score: int = Form(0)):
    """Export resume as PDF"""
    pdf_export = ResumeExport.export_pdf(resume_text, ats_score=ats_score)
    return pdf_export


@router.post("/export/txt")
async def export_txt(resume_text: str = Form(...)):
    """Export resume as plain text"""
    txt_export = ResumeExport.export_txt(resume_text)
    return txt_export


@router.post("/exports/json")
async def export_json(resume_data: dict):
    """Export resume as structured JSON"""
    json_export = ResumeExport.export_json(resume_data)
    return json_export


@router.post("/share/create")
async def create_shareable_link(request: ResumeShareRequest):
    """Create shareable public link for resume"""
    share = ShareableResumeLink.create_share(
        resume_text=request.resume_text,
        ats_score=request.ats_score,
        metadata={"name": request.name},
    )
    return share


@router.get("/share/{share_id}")
async def get_shared_resume(share_id: str):
    """Get publicly shared resume"""
    share = ShareableResumeLink.get_share(share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found or expired")
    
    return {
        "resume": share["resume"],
        "ats_score": share["ats_score"],
        "metadata": share["metadata"],
    }


@router.delete("/share/{share_id}")
async def revoke_share(share_id: str):
    """Revoke a shared resume link"""
    success = ShareableResumeLink.revoke_share(share_id)
    if not success:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"status": "revoked"}


@router.get("/share/{share_id}/stats")
async def get_share_stats(share_id: str):
    """Get viewing statistics for shared resume"""
    stats = ShareableResumeLink.get_share_stats(share_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Share not found")
    return stats


# ============================================================================
# 8. KEYWORD OPTIMIZATION & TARGETING (Feature #3)
# ============================================================================

@router.post("/keywords/suggest")
async def suggest_keywords(
    job_description: str = Form(...),
    resume_text: Optional[str] = Form(None),
):
    """Suggest top keywords to add from job description"""
    keywords = llm_tools.suggest_keywords_for_job(job_description, resume_text or "")
    return {"keywords": keywords}


@router.post("/keywords/optimize-resume")
async def optimize_with_keywords(
    resume_text: str = Form(...),
    job_description: str = Form(...),
):
    """Rewrite resume to include more job-specific keywords"""
    optimized = llm_tools.rewrite_resume_section(
        resume_text,
        job_description,
        section_type="full",
    )
    return {"optimized_resume": optimized}


# ============================================================================
# 9. REZI SCORE / ATS SCORE EXPLANATION (Feature #4)
# ============================================================================

@router.post("/score/explain")
async def explain_score(
    ats_score: int = Form(...),
    issues: list = Form(...),
):
    """Get human-friendly explanation of ATS score"""
    explanation = llm_tools.generate_ats_score_explanation(issues, ats_score)
    return {"explanation": explanation}


# ============================================================================
# 10. REAL-TIME FEEDBACK (Feature #5)
# ============================================================================

@router.post("/feedback/analyze-text")
async def analyze_text_snippet(
    snippet: str = Form(...),
    context: Optional[str] = Form(None),
):
    """Get real-time feedback on resume snippet"""
    feedback_request = {
        "snippet": snippet,
        "context": context or "experience",
    }
    
    ats_result = ats_checker.check_resume(snippet, "")
    
    return {
        "issues": ats_result["issues"][:5],
        "recommendations": ats_result["recommendations"][:3],
        "snippet_quality": {
            "has_metrics": any("metric" in i["issue"].lower() for i in ats_result["issues"]),
            "has_actionverbs": any("action verb" in i["issue"].lower() for i in ats_result["issues"]),
        },
    }


# ============================================================================
# 11. JOB-SPECIFIC RESUME TAILORING (Feature #7)
# ============================================================================

@router.post("/tailor/job-specific")
async def tailor_complete_resume(request: TailorResumeRequest):
    """Complete job-specific tailoring with multiple optimizations"""
    # Parse resume
    sections = resume_writer._parse_resume_sections(request.resume_text)
    
    # Rewrite each section for job
    rewritten_sections = {}
    for section, content in sections.items():
        if section in ["experience", "skills"]:
            rewritten_sections[section] = llm_tools.rewrite_resume_section(
                content,
                request.job_description,
                section_type=section,
            )
        else:
            rewritten_sections[section] = content
    
    # Reconstruct and check
    tailored = resume_writer._reconstruct_resume(sections, rewritten_sections)
    ats_check = ats_checker.check_resume(tailored, request.job_description)
    
    return {
        "tailored_resume": tailored,
        "ats_score": ats_check["ats_score"],
        "sections_optimized": list(rewritten_sections.keys()),
        "keyword_coverage": ats_check["details"].get("keywords", {}),
        "next_steps": ats_check["recommendations"][:3],
    }


# ============================================================================
# 12. INTERVIEW PREP & PRACTICE (Feature #11)
# ============================================================================

@router.post("/interview/generate-questions")
async def generate_interview_questions(
    job_description: str = Form(...),
    role: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
):
    """Generate interview questions for role"""
    questions_response = llm_tools.interview_questions(
        job_description,
        role=role or "",
        company=company or "",
    )
    return {"questions": questions_response}


@router.post("/interview/practice")
async def get_practice_scenario(
    role: str = Form(...),
    question_type: str = Form("behavioral"),  # behavioral, technical, situational
):
    """Get a specific practice question scenario"""
    prompt = f"Give me a {question_type} interview question for a {role} position"
    question = llm_tools.interview_questions(prompt, role=role)
    
    return {
        "role": role,
        "question_type": question_type,
        "question": question,
        "tips": f"Tips for answering {question_type} questions...",
    }


# ============================================================================
# 13. DYNAMIC JOB MATCHING (Feature #2 - Enhanced)
# ============================================================================

class DynamicJobMatchRequest(BaseModel):
    resume_text: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[int] = None
    preferred_role: Optional[str] = None
    preferred_location: Optional[str] = None
    limit: Optional[int] = 10


@router.post("/jobs/dynamic-match")
async def dynamic_job_matching(request: DynamicJobMatchRequest):
    """
    Dynamically match jobs based on resume skills and experience
    
    This endpoint:
    1. Extracts skills from resume (or uses provided skills)
    2. Matches against real job market roles
    3. Ranks jobs by match quality
    4. Provides diverse recommendations
    
    Different resumes → Different job recommendations
    """
    from app.services.smart_job_match import dynamic_job_match, get_jobs_for_skills
    
    # Use provided skills or extract from resume
    if request.skills:
        skill_set = set(request.skills)
        experience = request.experience_years or 0
        
        # Get matching roles
        from app.data.job_market import get_matching_roles
        role_matches = get_matching_roles(skill_set, experience)
        
        # Generate job recommendations
        from app.services.smart_job_match import _generate_job_recommendations
        jobs = _generate_job_recommendations(
            skill_set,
            experience,
            role_matches,
            request.preferred_location
        )[:request.limit or 10]
        
        return {
            "matched_roles": role_matches[:10],
            "recommended_jobs": jobs,
            "profile_summary": {
                "provided_skills": request.skills,
                "experience_years": experience,
                "top_matching_roles": [r["role"] for r in role_matches[:3]],
            },
        }
    elif request.resume_text:
        # Use full resume parsing
        result = dynamic_job_match(
            request.resume_text,
            preferred_role=request.preferred_role,
            preferred_location=request.preferred_location,
        )
        return {
            "recommended_jobs": result["recommended_jobs"][:request.limit or 10],
            "matched_roles": result["matched_roles"],
            "skill_gaps": result["skill_gaps"],
            "salary_insights": result["salary_insights"],
            "profile_summary": result["profile_summary"],
        }
    else:
        raise HTTPException(
            status_code=400, 
            detail="Either resume_text or skills must be provided"
        )


@router.get("/jobs/by-skills")
async def get_jobs_by_skills(
    skills: str,  # comma-separated skills
    experience: int = 0,
    limit: int = 10,
):
    """
    Get job recommendations by skills (simple endpoint)
    
    Example: /jobs/by-skills?skills=python,react,docker&experience=3&limit=5
    """
    skill_list = [s.strip() for s in skills.split(",")]
    jobs = get_jobs_for_skills(skill_list, experience, limit)
    
    return {
        "skills": skill_list,
        "experience_years": experience,
        "jobs": jobs,
        "count": len(jobs),
    }


@router.get("/jobs/roles")
async def get_all_roles():
    """Get all available job roles in the market database"""
    from app.data.job_market import JOB_MARKET_ROLES, ROLE_CATEGORIES
    
    return {
        "roles": list(JOB_MARKET_ROLES.keys()),
        "categories": ROLE_CATEGORIES,
        "total": len(JOB_MARKET_ROLES),
    }


@router.get("/jobs/role/{role_name}/skills")
async def get_role_required_skills(role_name: str):
    """Get required and preferred skills for a specific role"""
    from app.data.job_market import get_role_skills, suggest_skills_for_role
    
    skills = get_role_skills(role_name)
    if not skills:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {
        "role": role_name,
        "skills": skills,
    }


# ============================================================================
# 14. ENHANCED ATS SCORING (Feature #1 - Enhanced)
# ============================================================================

class EnhancedATSRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


@router.post("/ats/enhanced-score")
async def enhanced_ats_scoring(request: EnhancedATSRequest):
    """
    Enhanced ATS scoring with deep NLP analysis
    
    Returns:
    - Accurate ATS Score (dynamic, not fixed range)
    - Missing Skills (prioritized)
    - Skill Gap Analysis
    - Resume Improvement Suggestions (actionable)
    - Keyword suggestions for ATS optimization
    """
    from app.services.scoring import ats_score
    from app.nlp.skills import extract_skills, extract_experience_years
    from app.nlp.similarity import semantic_similarity
    
    # Extract resume skills
    resume_skills = set(extract_skills(request.resume_text))
    
    # Extract job skills if job description provided
    job_skills = set()
    if request.job_description:
        job_skills = set(extract_skills(request.job_description))
    
    # Calculate semantic similarity
    similarity = 0.5
    if request.job_description:
        similarity = semantic_similarity(request.resume_text, request.job_description)
    
    # Get word count
    word_count = len(request.resume_text.split())
    
    # Calculate enhanced ATS score
    score_result = ats_score(
        similarity=similarity,
        resume_skills=resume_skills,
        job_skills=job_skills,
        word_count=word_count,
        resume_text=request.resume_text,
        job_description=request.job_description or "",
    )
    
    return {
        "ats_score": score_result["final"],
        "score_breakdown": score_result["sub"],
        "matched_skills": score_result["matched_skills"],
        "missing_skills": score_result["missing_skills"],
        "metadata": score_result["metadata"],
        "improvement_suggestions": score_result["improvement_suggestions"],
        "word_count": word_count,
    }
