"""
Smart Job Match Engine - Feature #2
Matches based on skills, experience, projects, and resume wording
Provides "Fit Type" classification
Uses real job market data for dynamic matching
"""
import os
from typing import Dict, List, Set, Optional
from openai import OpenAI
from app.core.config import get_settings
from app.nlp.skills import extract_skills, extract_experience_years
from app.nlp.similarity import semantic_similarity
from app.data.job_market import (
    JOB_MARKET_ROLES, get_matching_roles, SKILL_TO_ROLES, 
    ROLE_CATEGORIES, get_role_skills, suggest_skills_for_role
)

settings = get_settings()


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key)


# ============================================================================
# Dynamic Job Matching - Uses Real Job Market Data
# ============================================================================

def dynamic_job_match(
    resume_text: str,
    preferred_role: Optional[str] = None,
    preferred_location: Optional[str] = None
) -> dict:
    """
    Dynamically match jobs based on extracted resume data
    
    This function:
    1. Extracts skills, experience, education from resume
    2. Matches against real job market roles
    3. Ranks jobs by match quality
    4. Provides diversity in recommendations
    
    Returns:
        {
            "matched_roles": [...],
            "recommended_jobs": [...],
            "skill_gaps": [...],
            "salary_insights": {...},
            "profile_summary": {...}
        }
    """
    # Extract resume metadata
    resume_skills = set(extract_skills(resume_text))
    experience_years = extract_experience_years(resume_text)
    
    # Get matching roles from job market database
    role_matches = get_matching_roles(resume_skills, experience_years)
    
    # Filter by preferred role if specified
    if preferred_role:
        role_matches = [r for r in role_matches if preferred_role.lower() in r["role"].lower()]
    
    # Generate job recommendations
    recommended_jobs = _generate_job_recommendations(
        resume_skills, 
        experience_years, 
        role_matches,
        preferred_location
    )
    
    # Identify skill gaps
    skill_gaps = _analyze_skill_gaps_for_roles(resume_skills, role_matches[:5])
    
    # Get salary insights
    salary_insights = _get_salary_insights(role_matches, experience_years)
    
    # Profile summary
    profile_summary = {
        "extracted_skills": sorted(resume_skills),
        "experience_years": experience_years,
        "top_matching_roles": [r["role"] for r in role_matches[:3]],
        "match_scores": {r["role"]: r["match_score"] for r in role_matches[:3]},
    }
    
    return {
        "matched_roles": role_matches[:10],  # Top 10 matching roles
        "recommended_jobs": recommended_jobs,
        "skill_gaps": skill_gaps,
        "salary_insights": salary_insights,
        "profile_summary": profile_summary,
    }


def _generate_job_recommendations(
    resume_skills: Set[str],
    experience_years: int,
    role_matches: List[Dict],
    preferred_location: Optional[str] = None
) -> List[Dict]:
    """Return only real jobs supplied by a live provider or stored index.

    This service used to synthesize company names and listings from role data.
    The matcher must not fabricate recommendations; callers should use the
    resume profile and role matches to query a real jobs provider/index, then
    score those concrete listings.
    """
    return []


def _score_to_fit_type(score: float) -> str:
    """Convert match score to fit type"""
    if score >= 85:
        return "Excellent Fit"
    elif score >= 70:
        return "Strong Fit"
    elif score >= 55:
        return "Moderate Fit"
    else:
        return "Stretch Fit"


def _analyze_skill_gaps_for_roles(resume_skills: Set[str], role_matches: List[Dict]) -> List[Dict]:
    """Analyze skill gaps across top matching roles"""
    all_missing: Dict[str, int] = {}
    
    for role in role_matches:
        for skill in role.get("missing_required", []):
            all_missing[skill] = all_missing.get(skill, 0) + 1
    
    # Convert to list with priority
    gaps = []
    for skill, count in sorted(all_missing.items(), key=lambda x: x[1], reverse=True):
        priority = "critical" if count >= 3 else "high" if count >= 2 else "medium"
        gaps.append({
            "skill": skill,
            "appears_in_roles": count,
            "priority": priority,
            "action": f"Learn {skill} to improve matches in {count} roles",
        })
    
    return gaps[:10]  # Top 10 gaps


def _get_salary_insights(role_matches: List[Dict], experience_years: int) -> Dict:
    """Get salary insights based on matching roles"""
    if not role_matches:
        return {}
    
    # Get salary ranges from top matches
    salaries = []
    for role in role_matches[:5]:
        salary_parts = role["salary_range"].replace("₹", "").replace("L", "").split("-")
        if len(salary_parts) == 2:
            salaries.append(int(salary_parts[0]))
            salaries.append(int(salary_parts[1]))
    
    if salaries:
        return {
            "average_min": f"₹{sum(salaries)//len(salaries)}L",
            "range": f"₹{min(salaries)}L - ₹{max(salaries)}L",
            "top_roles": [
                {"role": r["role"], "salary": r["salary_range"]} 
                for r in role_matches[:3]
            ],
        }
    
    return {}


def get_jobs_for_skills(
    skills: List[str],
    experience: int = 0,
    limit: int = 10
) -> List[Dict]:
    """
    Get jobs for a specific set of skills (API endpoint helper)
    
    This allows the frontend to get dynamic job recommendations
    based on extracted skills without needing a full resume parse.
    """
    skill_set = set(skills)
    role_matches = get_matching_roles(skill_set, experience)
    
    return _generate_job_recommendations(
        skill_set,
        experience,
        role_matches,
        None
    )[:limit]


def smart_job_match(
    resume_text: str,
    job_description: str,
    resume_skills: set[str],
    job_skills: set[str],
    semantic_sim: float
) -> dict:
    """
    Comprehensive job matching beyond simple percentage
    
    Returns:
        {
            "overall_match": float (0-100),
            "fit_type": "Strong Fit" | "Moderate Fit" | "Weak Fit",
            "match_breakdown": {
                "skills_match": float,
                "experience_match": float,
                "project_match": float,
                "wording_match": float
            },
            "strengths": [str],
            "gaps": [str],
            "recommendation": str,
            "match_confidence": float
        }
    """
    
    # Calculate individual match components
    skills_match = _calculate_skills_match(resume_skills, job_skills)
    experience_match = _calculate_experience_match(resume_text, job_description)
    project_match = _calculate_project_match(resume_text, job_description)
    wording_match = semantic_sim * 100
    
    # Weighted overall match
    overall_match = (
        skills_match * 0.35 +
        experience_match * 0.30 +
        project_match * 0.20 +
        wording_match * 0.15
    )
    
    # Determine fit type
    fit_type = _determine_fit_type(overall_match, skills_match, experience_match)
    
    # Get strengths and gaps
    strengths = _identify_strengths(
        resume_text,
        job_description,
        resume_skills,
        job_skills,
        experience_match,
        project_match
    )
    
    gaps = _identify_gaps(
        resume_text,
        job_description,
        resume_skills,
        job_skills,
        experience_match
    )
    
    # Get AI recommendation
    recommendation = _get_match_recommendation(
        fit_type,
        overall_match,
        strengths,
        gaps,
        resume_text,
        job_description
    )
    
    # Calculate confidence
    confidence = _calculate_confidence(
        skills_match,
        experience_match,
        project_match,
        wording_match
    )
    
    return {
        "overall_match": round(overall_match, 1),
        "fit_type": fit_type,
        "match_breakdown": {
            "skills_match": round(skills_match, 1),
            "experience_match": round(experience_match, 1),
            "project_match": round(project_match, 1),
            "wording_match": round(wording_match, 1)
        },
        "strengths": strengths,
        "gaps": gaps,
        "recommendation": recommendation,
        "match_confidence": round(confidence, 1)
    }


def _calculate_skills_match(resume_skills: set[str], job_skills: set[str]) -> float:
    """Calculate skills match percentage"""
    if not job_skills:
        return 0.0
    
    matched = len(resume_skills & job_skills)
    total = len(job_skills)
    
    # Bonus for having extra skills
    extra_skills = len(resume_skills - job_skills)
    bonus = min(10, extra_skills * 0.5)
    
    return min(100, (matched / total) * 100 + bonus)


def _calculate_experience_match(resume_text: str, job_description: str) -> float:
    """Calculate experience level match"""
    resume_lower = resume_text.lower()
    job_lower = job_description.lower()
    
    # Extract experience indicators
    experience_keywords = {
        "senior": ["senior", "lead", "principal", "architect"],
        "mid": ["mid-level", "intermediate", "3-5 years", "4-6 years"],
        "junior": ["junior", "entry", "0-2 years", "graduate", "fresher"]
    }
    
    # Determine required level from job
    required_level = "mid"
    for level, keywords in experience_keywords.items():
        if any(kw in job_lower for kw in keywords):
            required_level = level
            break
    
    # Determine candidate level from resume
    candidate_level = "mid"
    for level, keywords in experience_keywords.items():
        if any(kw in resume_lower for kw in keywords):
            candidate_level = level
            break
    
    # Calculate match
    level_order = {"junior": 0, "mid": 1, "senior": 2}
    required_idx = level_order.get(required_level, 1)
    candidate_idx = level_order.get(candidate_level, 1)
    
    # Perfect match = 100, one level below = 70, two levels = 40
    if candidate_idx == required_idx:
        return 100.0
    elif candidate_idx == required_idx - 1:
        return 70.0
    elif candidate_idx == required_idx + 1:
        return 85.0
    else:
        return 40.0


def _calculate_project_match(resume_text: str, job_description: str) -> float:
    """Calculate project relevance match"""
    # Look for project indicators
    project_keywords = ["project", "built", "developed", "created", "implemented", "designed"]
    
    resume_has_projects = sum(1 for kw in project_keywords if kw in resume_text.lower())
    
    # Extract domain from job description
    domains = ["web", "mobile", "data", "ml", "ai", "cloud", "devops", "backend", "frontend"]
    job_domains = [d for d in domains if d in job_description.lower()]
    resume_domains = [d for d in domains if d in resume_text.lower()]
    
    # Calculate domain overlap
    if job_domains:
        domain_match = len(set(job_domains) & set(resume_domains)) / len(job_domains)
    else:
        domain_match = 0.5
    
    # Project presence score
    project_score = min(100, resume_has_projects * 15)
    
    # Combined
    return (project_score * 0.4) + (domain_match * 100 * 0.6)


def _determine_fit_type(overall_match: float, skills_match: float, experience_match: float) -> str:
    """Determine fit type based on scores"""
    if overall_match >= 75 and skills_match >= 70 and experience_match >= 70:
        return "Strong Fit"
    elif overall_match >= 50 and skills_match >= 50:
        return "Moderate Fit"
    else:
        return "Weak Fit"


def _identify_strengths(
    resume_text: str,
    job_description: str,
    resume_skills: set[str],
    job_skills: set[str],
    experience_match: float,
    project_match: float
) -> list[str]:
    """Identify candidate strengths for this role"""
    strengths = []
    
    # Skill strengths
    matched_skills = resume_skills & job_skills
    if matched_skills:
        top_skills = sorted(list(matched_skills))[:3]
        strengths.append(f"Strong in {', '.join(top_skills)}")
    
    # Experience strength
    if experience_match >= 85:
        strengths.append("Experience level matches job requirements")
    
    # Project strength
    if project_match >= 75:
        strengths.append("Relevant project experience in required domain")
    
    # Extra skills
    extra_skills = resume_skills - job_skills
    if extra_skills:
        strengths.append(f"Additional skills: {', '.join(sorted(list(extra_skills))[:2])}")
    
    return strengths[:4]


def _identify_gaps(
    resume_text: str,
    job_description: str,
    resume_skills: set[str],
    job_skills: set[str],
    experience_match: float
) -> list[str]:
    """Identify gaps between candidate and job"""
    gaps = []
    
    # Skill gaps
    missing_skills = job_skills - resume_skills
    if missing_skills:
        top_missing = sorted(list(missing_skills))[:3]
        gaps.append(f"Missing skills: {', '.join(top_missing)}")
    
    # Experience gap
    if experience_match < 70:
        gaps.append("Experience level below job requirements")
    
    # Domain gap
    job_domains = ["web", "mobile", "data", "ml", "ai", "cloud"]
    resume_domains = [d for d in job_domains if d in resume_text.lower()]
    job_domain_keywords = [d for d in job_domains if d in job_description.lower()]
    
    if job_domain_keywords and not resume_domains:
        gaps.append(f"No experience in {job_domain_keywords[0]} domain")
    
    return gaps[:3]


def _get_match_recommendation(
    fit_type: str,
    overall_match: float,
    strengths: list[str],
    gaps: list[str],
    resume_text: str,
    job_description: str
) -> str:
    """Get AI-powered recommendation"""
    
    system = """You are a career advisor. Provide a brief, actionable recommendation about applying for a job.
Be encouraging but honest. Keep it to 1-2 sentences."""
    
    user = f"""Fit Type: {fit_type}
Overall Match: {overall_match}%
Strengths: {', '.join(strengths)}
Gaps: {', '.join(gaps)}

Should this candidate apply? What's your recommendation?"""
    
    resp = _get_client().chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=0.6,
        max_tokens=150
    )
    
    return resp.choices[0].message.content


def _calculate_confidence(
    skills_match: float,
    experience_match: float,
    project_match: float,
    wording_match: float
) -> float:
    """Calculate confidence in the match score"""
    # Higher variance = lower confidence
    scores = [skills_match, experience_match, project_match, wording_match]
    avg = sum(scores) / len(scores)
    variance = sum((s - avg) ** 2 for s in scores) / len(scores)
    
    # Confidence decreases with variance
    confidence = 100 - (variance ** 0.5)
    return max(0, min(100, confidence))
