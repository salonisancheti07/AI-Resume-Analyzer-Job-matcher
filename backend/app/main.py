import os
import re
import json
import tempfile

# Patch pydantic ForwardRef for Python 3.12 before FastAPI loads
import app.pydantic_patch  # noqa: F401

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.nlp.parser import extract_text_from_pdf
from app.nlp.skills import extract_skills
from app.nlp.similarity import semantic_similarity
from app.services.scoring import ats_score
from app.services import llm_tools
from app.services.ats_checker import ATSChecker
from app.services.heatmap_analyzer import analyze_resume_heatmap, get_heatmap_visualization_data
from app.services.bullet_rewriter import rewrite_bullet_points, apply_bullet_rewrites
from app.services.skill_gap_analyzer import analyze_skill_gaps
from app.services.resume_intelligence import (
    analyze_resume_against_job,
    extract_resume_profile,
    generate_market_job_matches,
    summarize_profile_for_chat,
)
from app.services.job_matcher import generate_job_recommendations
from app.vectorstore.faiss_store import JobVectorStore
from app.routes.features_v2 import router as v2_router
from app.routes.ai_chat import router as ai_chat_router
from app.routes.applications import router as applications_router

# Import job market data module (for dynamic job matching)
try:
    from app.data import job_market
except ImportError:
    # Module may not be available in all environments
    pass

settings = get_settings()

app = FastAPI(title="AI Resume Analyzer & Job Matcher")

origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = JobVectorStore(
    model_name=settings.embed_model, index_path=settings.faiss_index_path
)
vector_store.load_or_create()

api = APIRouter(prefix="/api")

ACTION_VERBS = [
    "Built",
    "Led",
    "Improved",
    "Optimized",
    "Delivered",
    "Launched",
    "Designed",
    "Automated",
    "Reduced",
    "Scaled",
    "Created",
    "Implemented",
]


def _build_india_search_links(role: str, location: str, skills: list[str]) -> list[dict]:
    from urllib.parse import quote_plus

    location_text = location or "India"
    query = " ".join([role or "software developer", *skills[:3]]).strip()
    role_query = quote_plus(query)
    location_query = quote_plus(location_text)
    naukri_role = quote_plus((role or "software developer").lower().replace(" ", "-"))
    naukri_location = quote_plus(location_text.lower().replace(" ", "-"))
    internshala_seed = role or (skills[0] if skills else "software development")
    internshala_keyword = quote_plus(internshala_seed.lower().replace(" ", "-"))
    return [
        {"platform": "LinkedIn India", "label": f"Search {role or 'jobs'} in {location_text}", "url": f"https://www.linkedin.com/jobs/search/?keywords={role_query}&location={location_query}"},
        {"platform": "Indeed India", "label": f"Search {role or 'jobs'} in {location_text}", "url": f"https://in.indeed.com/jobs?q={role_query}&l={location_query}"},
        {"platform": "Naukri", "label": f"Search {role or 'jobs'} in {location_text}", "url": f"https://www.naukri.com/{naukri_role}-jobs-in-{naukri_location}"},
        {"platform": "Internshala", "label": f"Search internships for {role or 'your skills'}", "url": f"https://internshala.com/internships/keywords-{internshala_keyword}/"},
    ]


def _contains_section(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)


def _extract_sections(text: str) -> dict:
    return {
        "summary": _contains_section(text, [r"\bsummary\b", r"\bobjective\b", r"\bprofessional summary\b"]),
        "experience": _contains_section(text, [r"\bexperience\b", r"\bwork history\b", r"\bemployment\b"]),
        "education": _contains_section(text, [r"\beducation\b", r"\bdegree\b", r"\buniversity\b", r"\bcollege\b"]),
        "skills": _contains_section(text, [r"\bskills\b", r"\btechnical skills\b", r"\bcore competencies\b"]),
        "projects": _contains_section(text, [r"\bprojects\b", r"\bproject experience\b"]),
        "certifications": _contains_section(text, [r"\bcertifications\b", r"\bcertificates\b", r"\blicenses\b"]),
    }


def _keyword_frequency(text: str, keywords: set[str]) -> dict:
    text_lower = text.lower()
    frequency = {}
    for keyword in sorted(keywords):
        count = len(re.findall(rf"\b{re.escape(keyword.lower())}\b", text_lower))
        if count:
            frequency[keyword] = count
    return frequency


def _readability_score(text: str, bullet_count: int) -> dict:
    words = re.findall(r"\b\w+\b", text)
    sentences = [item.strip() for item in re.split(r"[.!?]\s+", text) if item.strip()]
    non_empty_lines = [line.strip() for line in text.splitlines() if line.strip()]
    avg_sentence_length = len(words) / max(1, len(sentences))
    avg_line_length = sum(len(line) for line in non_empty_lines) / max(1, len(non_empty_lines))

    score = 100.0
    if avg_sentence_length > 28:
        score -= min(18, (avg_sentence_length - 28) * 1.3)
    elif avg_sentence_length < 7:
        score -= 8
    if avg_line_length > 110:
        score -= 12
    elif avg_line_length > 90:
        score -= 6
    if bullet_count < 4:
        score -= 16
    elif bullet_count < 8:
        score -= 8

    return {
        "score": round(max(35.0, min(100.0, score)), 1),
        "avg_sentence_length": round(avg_sentence_length, 1),
        "avg_line_length": round(avg_line_length, 1),
        "bullet_count": bullet_count,
    }


def _impact_score(text: str, metrics_count: int, action_verb_count: int) -> float:
    score = 42.0
    score += min(32.0, metrics_count * 6.0)
    score += min(26.0, action_verb_count * 3.5)
    if not re.search(r"\d", text):
        score -= 12.0
    return round(max(25.0, min(100.0, score)), 1)


def _estimated_impact(severity: str, fallback: int = 4) -> str:
    points = {
        "critical": 12,
        "high": 9,
        "medium": 6,
        "low": 3,
    }.get(severity.lower(), fallback)
    return f"+{points} pts"


def _build_feedback_summary(ats_result: dict, missing_skills: list[str], sections: dict, scores: dict) -> str:
    messages = []
    if missing_skills:
        messages.append(
            f"Keyword match is limited by missing JD terms like {', '.join(missing_skills[:3])}."
        )
    missing_sections = [
        section
        for section, present in sections.items()
        if not present and section in {"summary", "experience", "skills", "projects"}
    ]
    if missing_sections:
        messages.append(f"Add or strengthen these sections: {', '.join(missing_sections[:3])}.")
    if ats_result["issues"]:
        messages.append(f"Highest-impact fix: {ats_result['issues'][0]['fix']}.")
    messages.append(
        f"Sub-scores: keywords {scores['sub']['keywords']}, structure {scores['sub']['structure']}, impact {scores['sub']['impact']}, formatting {scores['sub']['formatting']}."
    )
    return " ".join(messages[:4])


def _build_analysis_payload(resume_text: str, job_description: str) -> dict:
    analysis = analyze_resume_against_job(resume_text, job_description)
    profile = analysis["profile"]
    ats_result = analysis["ats_checker"]
    job_profile = analysis["job_profile"]
    matched_skills = analysis["matched_skills"]
    missing_skills = analysis["missing_skills"]
    keyword_frequency = _keyword_frequency(
        resume_text, set(job_profile["job_skills"]) | set(job_profile["market_required_skills"])
    )
    low_frequency = analysis["low_frequency_keywords"]

    metrics_count = ats_result["details"].get("content_quality", {}).get("metric_count", 0)
    action_verb_count = ats_result["details"].get("content_quality", {}).get("action_verb_count", 0)
    bullet_count = ats_result["details"].get("content_quality", {}).get("bullet_count", 0)
    readability = _readability_score(resume_text, bullet_count)
    impact_score = round((analysis["scores"]["experience_relevance"] * 0.45) + (_impact_score(resume_text, metrics_count, action_verb_count) * 0.55), 1)
    structure_score = round((sum(1 for present in profile["sections"].values() if present) / max(1, len(profile["sections"]))) * 100, 1)
    formatting_score = analysis["scores"]["formatting_quality"]
    keyword_score = analysis["scores"]["keyword_optimization"]
    similarity_score = analysis["scores"]["semantic_alignment"]
    final_score = analysis["scores"]["final"]

    summary_suggestions = []
    if not profile["sections"]["summary"]:
        summary_suggestions.append("Add a 2-3 line professional summary aligned to the target role and strongest tools.")
    if missing_skills:
        summary_suggestions.append(
            f"Surface relevant JD keywords in your summary and experience, starting with {', '.join(missing_skills[:3])}."
        )
    if metrics_count < 3:
        summary_suggestions.append("Add quantified outcomes to your strongest bullets so recruiters can see impact quickly.")
    if len(summary_suggestions) < 3:
        summary_suggestions.append("Keep the top third of the resume tight: role target, stack, and one proof point.")

    prioritized_missing = []
    for index, keyword in enumerate(missing_skills[:6]):
        prioritized_missing.append(
            {
                "keyword": keyword,
                "placement": "Skills section" if index < 2 else "Most relevant experience bullet",
                "priority": "High" if index < 3 else "Medium",
            }
        )

    formatting_issues = [
        f"{'✓' if item['status'] else '⚠'} {item['label']}: {item['description']}"
        for item in [
            {
                "label": "No tables or multi-column formatting",
                "status": ats_result["details"].get("formatting", {}).get("no_tables", True)
                and ats_result["details"].get("formatting", {}).get("no_columns", True),
                "description": "Simple single-column layouts parse better in ATS systems.",
            },
            {
                "label": "Bullet-driven experience",
                "status": bullet_count >= 5,
                "description": "Each role should have achievement-focused bullets, not dense paragraphs.",
            },
            {
                "label": "Standard section headings",
                "status": profile["sections"]["experience"] and profile["sections"]["education"] and profile["sections"]["skills"],
                "description": "Use headings like Experience, Education, Skills, and Projects.",
            },
            {
                "label": "Contact information present",
                "status": ats_result["details"].get("contact_info", {}).get("has_email", False),
                "description": "Include email, phone, and optionally LinkedIn near the top.",
            },
        ]
    ]

    ats_checks = [
        {
            "label": "ATS-safe layout",
            "status": ats_result["details"].get("formatting", {}).get("no_tables", True)
            and ats_result["details"].get("formatting", {}).get("no_columns", True),
            "description": "No tables, columns, or graphics that confuse parsers.",
        },
        {
            "label": "Required core sections",
            "status": profile["sections"]["experience"] and profile["sections"]["education"] and profile["sections"]["skills"],
            "description": "Experience, Education, and Skills should be clearly labeled.",
        },
        {
            "label": "Keyword alignment",
            "status": keyword_score >= 60,
            "description": "The resume should naturally include the major terms from the job description.",
        },
        {
            "label": "Impact-focused bullets",
            "status": metrics_count >= 3 and action_verb_count >= 3,
            "description": "Strong resumes show action verbs and measurable outcomes.",
        },
    ]

    improvements = []
    for suggestion in analysis["improvement_suggestions"][:6]:
        improvements.append(
            {
                "priority": suggestion["priority"],
                "action": suggestion["action"],
                "impact": suggestion["impact"],
            }
        )

    bullet_points = []
    for entry in profile["experience_entries"][:2]:
        for bullet in entry.get("bullets", [])[:2]:
            bullet_points.append(
                {
                    "original": bullet,
                    "improved": (
                        "Lead with a stronger action verb and add measurable impact. "
                        + (f"Where true, connect it to {missing_skills[0]} or another target skill. " if missing_skills else "")
                        + "Show scope, outcome, and the exact tool or system used."
                    ).strip(),
                }
            )
    if not bullet_points:
        bullet_points = [
            {
                "original": "Worked on projects and responsibilities.",
                "improved": "Start with a strong verb, name the stack or business problem, and finish with a measurable outcome.",
            }
        ]

    sub_scores = {
        "keywords": keyword_score,
        "structure": structure_score,
        "impact": impact_score,
        "formatting": formatting_score,
        "semantic_match": similarity_score,
        "length": readability["score"],
    }
    feedback = _build_feedback_summary(ats_result, missing_skills, profile["sections"], {"sub": sub_scores})

    return {
        "skills": profile["skills"],
        "job_skills": job_profile["job_skills"],
        "missing_skills": missing_skills,
        "skill_gap_analysis": analysis["skill_gap_analysis"],
        "keywordSuggestions": analysis["keyword_suggestions"],
        "parsed_resume": {
            "projects": profile["projects"],
            "education": profile["education_entries"],
            "experience": profile["experience_entries"],
            "tools": profile["tools"],
            "certifications": profile["certifications"],
            "job_titles": profile["job_titles"],
            "target_roles": profile["target_roles"],
        },
        "scores": {
            "final": final_score,
            "sub": sub_scores,
        },
        "match_rate": analysis["match_rate"],
        "readability": readability,
        "keywordStats": {
            "missing": missing_skills[:10],
            "lowFreq": low_frequency,
            "suggested": [item["keyword"] for item in analysis["keyword_suggestions"][:6]],
        },
        "keywordTargeting": {
            "matched": matched_skills,
            "lowFrequency": low_frequency,
            "prioritizedMissing": prioritized_missing,
        },
        "summarySuggestions": summary_suggestions[:4],
        "actionVerbs": ACTION_VERBS,
        "metricsGuide": {
            "note": "Use numbers that show scale, speed, efficiency, revenue, accuracy, users, or delivery scope.",
            "examples": [
                "Reduced processing time by 35% by automating a manual workflow.",
                "Built a feature used by 2,000+ users and improved conversion by 18%.",
                "Analyzed 50K+ records to identify trends that cut support tickets by 22%.",
            ],
        },
        "atsChecks": ats_checks,
        "ai_summary": analysis["summary"],
        "feedback": feedback,
        "sections": profile["sections"],
        "bulletPoints": bullet_points,
        "formatting": {
            "score": formatting_score,
            "issues": formatting_issues,
        },
        "atsCompatibility": {
            "score": formatting_score,
            "details": [item["description"] for item in ats_checks],
        },
        "improvements": improvements[:6],
        "raw_text_preview": resume_text[:1200],
    }

@api.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(...),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text_from_pdf(tmp_path)
    os.remove(tmp_path)
    return _build_analysis_payload(resume_text, job_description)


@api.post("/jobs")
async def add_jobs(jobs: list[dict]):
    if not jobs:
        raise HTTPException(400, "jobs list is empty")
    vector_store.add_jobs(jobs)
    vector_store.save()
    return {"added": len(jobs)}


@api.post("/match")
async def match_jobs(
    file: UploadFile = File(...),
    k: int = Form(8),
    role: str = Form(""),
    location: str = Form(""),
    minSalary: str = Form("0"),
    job_description: str = Form(""),
    target_role: str = Form(""),
    experience_level: str = Form(""),
    industry: str = Form(""),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    text = extract_text_from_pdf(tmp_path)
    os.remove(tmp_path)

    recommendations = generate_job_recommendations(
        text,
        preferred_role=target_role or role or "",
        preferred_location=location or "India",
        limit=max(k, 8),
    )
    resume_profile = recommendations["profile"]
    filtered_results = []
    for job in recommendations.get("results", []):
        salary_min = int(job.get("salaryMin") or 0)
        salary_floor = int(float(minSalary or 0))
        if salary_min < salary_floor:
            continue
        if job_description and not any(term in (job.get("title", "") + " " + job.get("description", "") + " " + job.get("company", "")).lower() for term in [item.strip().lower() for item in job_description.split() if len(item.strip()) > 3]):
            pass
        filtered_results.append(job)

    return {
        "results": filtered_results,
        "inferred_role": recommendations.get("inferred_role", ""),
        "candidate_profile": resume_profile,
        "career_paths": recommendations.get("career_paths", []),
        "skills_to_learn": recommendations.get("skills_to_learn", []),
        "search_links": _build_india_search_links(
            recommendations.get("inferred_role", ""),
            location or resume_profile.get("location") or "India",
            resume_profile.get("skills", []),
        ),
        "provider_status": recommendations.get("provider_status", "Matched opportunities for your profile"),
    }


async def _tmp_pdf_to_text(upload: UploadFile) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await upload.read())
        tmp_path = tmp.name
    text = extract_text_from_pdf(tmp_path)
    os.remove(tmp_path)
    return text


@api.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    text = await _tmp_pdf_to_text(file)
    skills = extract_skills(text)
    return {"text": text, "skills": skills}


@api.post("/semantic-match")
async def semantic_match(file: UploadFile = File(...), job_description: str = Form(...)):
    text = await _tmp_pdf_to_text(file)
    sim = semantic_similarity(text, job_description)
    return {"similarity": sim}


@api.post("/ats-score")
async def ats_score_endpoint(file: UploadFile = File(...), job_description: str = Form(...)):
    text = await _tmp_pdf_to_text(file)
    resume_skills = set(extract_skills(text))
    job_skills = set(extract_skills(job_description))
    sim = semantic_similarity(text, job_description)
    scores = ats_score(sim, resume_skills, job_skills, len(text.split()))
    missing = sorted(job_skills - resume_skills)
    return {"scores": scores, "missing_skills": missing}


@api.post("/rewrite")
async def rewrite_resume_endpoint(file: UploadFile = File(...)):
    text = await _tmp_pdf_to_text(file)
    rewritten = llm_tools.rewrite_resume(text)
    return {"rewritten": rewritten}


@api.post("/cover-letter")
async def cover_letter_endpoint(file: UploadFile = File(...), job_description: str = Form(...)):
    text = await _tmp_pdf_to_text(file)
    letter = llm_tools.cover_letter(text, job_description)
    return {"cover_letter": letter}


@api.post("/keyword-optimize")
async def keyword_optimize_endpoint(file: UploadFile = File(...), job_description: str = Form(...)):
    text = await _tmp_pdf_to_text(file)
    tips = llm_tools.keyword_optimization(text, job_description)
    return {"keywords": tips}


@api.post("/section-analysis")
async def section_analysis_endpoint(file: UploadFile = File(...)):
    text = await _tmp_pdf_to_text(file)
    sections = ["summary", "experience", "education", "skills", "projects"]
    presence = {s: (s in text.lower()) for s in sections}
    density = {s: text.lower().count(s) for s in sections}
    return {"presence": presence, "density": density}


@api.post("/quality-score")
async def quality_score_endpoint(file: UploadFile = File(...)):
    text = await _tmp_pdf_to_text(file)
    word_count = len(text.split())
    bullets = text.count("•") + text.count("- ")
    score = min(1.0, (bullets / max(1, word_count)) * 20)
    length_penalty = 1.0 if 400 <= word_count <= 1200 else 0.8
    final = round((0.5 * score + 0.5 * length_penalty) * 100, 1)
    return {"word_count": word_count, "bullet_ratio": score, "quality": final}


@api.post("/interview-questions")
async def interview_questions_endpoint(
    job_description: str = Form(...),
    role: str = Form(""),
    company: str = Form(""),
):
    qs = llm_tools.interview_questions(job_description, role=role, company=company)
    return {"questions": qs}


@api.post("/career-recommendation")
async def career_recommendation_endpoint(file: UploadFile = File(...)):
    text = await _tmp_pdf_to_text(file)
    recs = llm_tools.career_recommendation(text)
    return {"recommendations": recs}


@api.post("/compare")
async def compare_resumes(file_a: UploadFile = File(...), file_b: UploadFile = File(...)):
    text_a = await _tmp_pdf_to_text(file_a)
    text_b = await _tmp_pdf_to_text(file_b)
    sim = semantic_similarity(text_a, text_b)
    skills_a = set(extract_skills(text_a))
    skills_b = set(extract_skills(text_b))
    only_a = sorted(skills_a - skills_b)
    only_b = sorted(skills_b - skills_a)
    return {"similarity": sim, "skills_only_a": only_a, "skills_only_b": only_b}


@api.post("/chat")
async def resume_chat_endpoint(payload: dict):
    raw_messages = payload.get("messages", [])
    messages = []
    for item in raw_messages:
        if isinstance(item, dict) and item.get("role") and item.get("content"):
            messages.append({"role": item["role"], "content": item["content"]})
    if not messages:
        raise HTTPException(status_code=400, detail="messages are required")

    resume_text = payload.get("resumeText", "") or payload.get("resume_text", "")
    extra_context_text = payload.get("extraContextText", "") or payload.get("extra_context_text", "")
    job_description = payload.get("jobDescription", "") or payload.get("job_description", "")
    mode = payload.get("mode", "general")
    role = payload.get("role", "")
    language = payload.get("language", "English")
    explain_simple = bool(payload.get("explainSimple", False))

    combined_resume_context = "\n\n".join(part for part in [resume_text, extra_context_text] if part)
    context_summary = summarize_profile_for_chat(combined_resume_context, job_description)
    reply = llm_tools.resume_chat(
        messages=messages,
        context_summary=context_summary,
        resume_text=combined_resume_context,
        job_description=job_description,
        mode=mode,
        role=role,
        language=language,
        explain_simple=explain_simple,
    )
    return {
        "reply": reply,
        "followUps": llm_tools.suggest_follow_up_prompts(mode, resume_text=resume_text, job_description=job_description),
    }


@api.post("/chat/stream")
async def resume_chat_stream_endpoint(payload: dict):
    raw_messages = payload.get("messages", [])
    messages = []
    for item in raw_messages:
        if isinstance(item, dict) and item.get("role") and item.get("content"):
            messages.append({"role": item["role"], "content": item["content"]})
    if not messages:
        raise HTTPException(status_code=400, detail="messages are required")

    resume_text = payload.get("resumeText", "") or payload.get("resume_text", "")
    extra_context_text = payload.get("extraContextText", "") or payload.get("extra_context_text", "")
    job_description = payload.get("jobDescription", "") or payload.get("job_description", "")
    mode = payload.get("mode", "general")
    role = payload.get("role", "")
    language = payload.get("language", "English")
    explain_simple = bool(payload.get("explainSimple", False))

    combined_resume_context = "\n\n".join(part for part in [resume_text, extra_context_text] if part)
    context_summary = summarize_profile_for_chat(combined_resume_context, job_description)

    async def event_generator():
        reply = llm_tools.resume_chat(
            messages=messages,
            context_summary=context_summary,
            resume_text=combined_resume_context,
            job_description=job_description,
            mode=mode,
            role=role,
            language=language,
            explain_simple=explain_simple,
        )
        for word in reply.split(" "):
            if word:
                yield f"event: chunk\ndata: {json.dumps({'text': word + ' '})}\n\n"
        meta = {
            "reply": reply,
            "title": "AI Mode answer",
            "followUps": llm_tools.suggest_follow_up_prompts(
                mode,
                resume_text=combined_resume_context,
                job_description=job_description,
            ),
        }
        yield f"event: meta\ndata: {json.dumps(meta)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@api.post("/chat/resume-context")
async def chat_resume_context_endpoint(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        resume_text = extract_text_from_pdf(tmp_path)
        os.remove(tmp_path)
        profile = extract_resume_profile(resume_text)
        reasoning_context = llm_tools.build_resume_reasoning_context(resume_text)

        return {
            "resume_text": resume_text,
            "structured_profile": profile,
            "reasoning_context": reasoning_context,
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


@api.post("/chat/context-files")
async def chat_context_files_endpoint(files: list[UploadFile] = File(...)):
    parsed_files = []
    unsupported_files = []
    context_parts = []

    for uploaded_file in files:
        filename = uploaded_file.filename or "uploaded-file"
        extension = os.path.splitext(filename.lower())[1]
        content = await uploaded_file.read()

        if extension == ".pdf":
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                text = extract_text_from_pdf(tmp_path)
                os.remove(tmp_path)
                parsed_files.append({"name": filename, "type": "pdf", "characters": len(text)})
                context_parts.append(f"File: {filename}\n{text[:4000]}")
            except Exception:
                unsupported_files.append(filename)
        elif extension in {".txt", ".md", ".csv", ".json", ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css"}:
            text = content.decode("utf-8", errors="ignore")
            parsed_files.append({"name": filename, "type": extension.lstrip(".") or "text", "characters": len(text)})
            context_parts.append(f"File: {filename}\n{text[:4000]}")
        else:
            unsupported_files.append(filename)

    return {
        "files": parsed_files,
        "unsupportedFiles": unsupported_files,
        "supportedCount": len(parsed_files),
        "videoCount": sum(1 for item in unsupported_files if os.path.splitext(item.lower())[1] in {".mp4", ".mov", ".avi", ".mkv"}),
        "contextText": "\n\n".join(context_parts),
    }


app.include_router(api)
app.include_router(v2_router)
app.include_router(ai_chat_router)
app.include_router(applications_router)
