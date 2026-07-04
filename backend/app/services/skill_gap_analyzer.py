"""
Skill Gap Intelligence System - Feature #5
Compares resume vs job and shows missing skills with priority and difficulty
"""
import os
from openai import OpenAI
from app.core.config import get_settings

settings = get_settings()


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key)


def analyze_skill_gaps(
    resume_text: str,
    job_description: str,
    resume_skills: set[str],
    job_skills: set[str]
) -> dict:
    """
    Comprehensive skill gap analysis
    
    Returns:
        {
            "missing_skills": [
                {
                    "skill": str,
                    "priority": "critical" | "high" | "medium" | "low",
                    "difficulty": "beginner" | "intermediate" | "advanced",
                    "learning_time": str,
                    "resources": [str],
                    "relevance_score": float
                }
            ],
            "matched_skills": [str],
            "skill_categories": {
                "technical": [...],
                "soft": [...],
                "domain": [...]
            },
            "learning_path": [str],
            "estimated_time_to_ready": str,
            "quick_wins": [str]
        }
    """
    
    # Identify missing skills
    missing_skills = sorted(job_skills - resume_skills)
    matched_skills = sorted(resume_skills & job_skills)
    
    # Analyze each missing skill
    skill_analysis = []
    for skill in missing_skills:
        analysis = _analyze_single_skill(
            skill,
            job_description,
            resume_text,
            job_skills,
            resume_skills
        )
        skill_analysis.append(analysis)
    
    # Sort by priority
    skill_analysis.sort(key=lambda x: _priority_order(x["priority"]))
    
    # Categorize skills
    skill_categories = _categorize_skills(matched_skills, missing_skills)
    
    # Generate learning path
    learning_path = _generate_learning_path(skill_analysis[:10])
    
    # Estimate time to ready
    time_estimate = _estimate_learning_time(skill_analysis)
    
    # Identify quick wins
    quick_wins = _identify_quick_wins(skill_analysis)
    
    return {
        "missing_skills": skill_analysis,
        "matched_skills": matched_skills,
        "skill_categories": skill_categories,
        "learning_path": learning_path,
        "estimated_time_to_ready": time_estimate,
        "quick_wins": quick_wins,
        "gap_count": len(missing_skills),
        "match_count": len(matched_skills),
        "readiness_score": _calculate_readiness_score(matched_skills, missing_skills)
    }


def _analyze_single_skill(
    skill: str,
    job_description: str,
    resume_text: str,
    job_skills: set[str],
    resume_skills: set[str]
) -> dict:
    """Analyze a single missing skill"""
    
    # Determine priority
    priority = _determine_skill_priority(skill, job_description)
    
    # Determine difficulty
    difficulty = _determine_skill_difficulty(skill)
    
    # Get learning time estimate
    learning_time = _estimate_skill_learning_time(skill, difficulty)
    
    # Get resources
    resources = _get_learning_resources(skill)
    
    # Calculate relevance score
    relevance_score = _calculate_skill_relevance(skill, job_description)
    
    return {
        "skill": skill,
        "priority": priority,
        "difficulty": difficulty,
        "learning_time": learning_time,
        "resources": resources,
        "relevance_score": relevance_score,
        "why_needed": _explain_skill_need(skill, job_description)
    }


def _determine_skill_priority(skill: str, job_description: str) -> str:
    """Determine priority of a skill"""
    
    job_lower = job_description.lower()
    skill_lower = skill.lower()
    
    # Count mentions
    mention_count = job_lower.count(skill_lower)
    
    # Check if in title or key sections
    is_in_title = skill_lower in job_description.split("\n")[0].lower()
    is_in_requirements = "required" in job_description[max(0, job_description.lower().find(skill_lower) - 100):job_description.lower().find(skill_lower) + 100].lower()
    
    if is_in_title or mention_count >= 3 or is_in_requirements:
        return "critical"
    elif mention_count >= 2:
        return "high"
    elif mention_count >= 1:
        return "medium"
    else:
        return "low"


def _determine_skill_difficulty(skill: str) -> str:
    """Determine difficulty level of a skill"""
    
    skill_lower = skill.lower()
    
    # Beginner skills
    beginner_keywords = ["excel", "word", "powerpoint", "google", "basic", "fundamentals", "intro"]
    if any(kw in skill_lower for kw in beginner_keywords):
        return "beginner"
    
    # Advanced skills
    advanced_keywords = ["machine learning", "deep learning", "kubernetes", "distributed", "architecture", "system design", "ml", "ai"]
    if any(kw in skill_lower for kw in advanced_keywords):
        return "advanced"
    
    # Intermediate (default)
    return "intermediate"


def _estimate_skill_learning_time(skill: str, difficulty: str) -> str:
    """Estimate time to learn a skill"""
    
    time_map = {
        "beginner": "1-2 weeks",
        "intermediate": "4-8 weeks",
        "advanced": "3-6 months"
    }
    
    return time_map.get(difficulty, "4-8 weeks")


def _get_learning_resources(skill: str) -> list[str]:
    """Get learning resources for a skill"""
    
    resources = []
    skill_lower = skill.lower()
    
    # Common resources
    resource_map = {
        "python": ["Codecademy Python Course", "Real Python", "DataCamp"],
        "javascript": ["MDN Web Docs", "Codecademy JS", "freeCodeCamp"],
        "react": ["React Official Docs", "Scrimba React Course", "Udemy React"],
        "sql": ["SQLZoo", "Mode Analytics SQL Tutorial", "DataCamp SQL"],
        "machine learning": ["Coursera ML Specialization", "Fast.ai", "Kaggle Learn"],
        "aws": ["AWS Training", "A Cloud Guru", "Linux Academy"],
        "docker": ["Docker Official Docs", "Udemy Docker", "Linux Academy"],
        "kubernetes": ["Kubernetes Official Docs", "Linux Academy", "Udemy Kubernetes"],
        "git": ["Git Official Docs", "Atlassian Git Tutorial", "GitHub Learning Lab"],
        "communication": ["Toastmasters", "Dale Carnegie", "Coursera Communication"],
        "leadership": ["Coursera Leadership", "LinkedIn Learning", "Udemy Leadership"],
        "project management": ["Coursera PM", "PMI CAPM", "Udemy PM"]
    }
    
    for key, res in resource_map.items():
        if key in skill_lower:
            resources = res
            break
    
    if not resources:
        resources = [
            f"Udemy {skill} Course",
            f"Coursera {skill}",
            f"{skill} Official Documentation"
        ]
    
    return resources[:3]


def _calculate_skill_relevance(skill: str, job_description: str) -> float:
    """Calculate how relevant a skill is to the job (0-100)"""
    
    job_lower = job_description.lower()
    skill_lower = skill.lower()
    
    # Base relevance on mentions
    mention_count = job_lower.count(skill_lower)
    relevance = min(100, mention_count * 20)
    
    # Boost if in key sections
    if "required" in job_description[max(0, job_description.lower().find(skill_lower) - 100):job_description.lower().find(skill_lower) + 100].lower():
        relevance += 20
    
    if "must have" in job_description[max(0, job_description.lower().find(skill_lower) - 100):job_description.lower().find(skill_lower) + 100].lower():
        relevance += 15
    
    return min(100, relevance)


def _explain_skill_need(skill: str, job_description: str) -> str:
    """Explain why this skill is needed"""
    
    system = "You are a career advisor. Explain in 1 sentence why a skill is important for a job."
    user = f"Skill: {skill}\nJob Description excerpt: {job_description[:500]}\n\nWhy is {skill} important for this role?"
    
    try:
        resp = _get_client().chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=0.6,
            max_tokens=100
        )
        return resp.choices[0].message.content.strip()
    except:
        return f"This skill is mentioned in the job description and is important for the role."


def _categorize_skills(matched_skills: list[str], missing_skills: list[str]) -> dict:
    """Categorize skills into technical, soft, and domain"""
    
    categories = {
        "technical": [],
        "soft": [],
        "domain": []
    }
    
    technical_keywords = ["python", "java", "javascript", "sql", "react", "aws", "docker", "kubernetes", "git", "api", "database", "html", "css", "node", "express", "mongodb", "postgresql"]
    soft_keywords = ["communication", "leadership", "teamwork", "problem solving", "time management", "critical thinking", "collaboration", "presentation"]
    domain_keywords = ["data", "ml", "ai", "blockchain", "devops", "cloud", "web", "mobile", "backend", "frontend", "fullstack"]
    
    for skill in matched_skills + missing_skills:
        skill_lower = skill.lower()
        
        if any(kw in skill_lower for kw in technical_keywords):
            categories["technical"].append(skill)
        elif any(kw in skill_lower for kw in soft_keywords):
            categories["soft"].append(skill)
        elif any(kw in skill_lower for kw in domain_keywords):
            categories["domain"].append(skill)
        else:
            categories["technical"].append(skill)  # Default to technical
    
    return categories


def _generate_learning_path(skill_analysis: list[dict]) -> list[str]:
    """Generate a learning path based on skill priorities"""
    
    path = []
    
    # Group by priority
    critical = [s for s in skill_analysis if s["priority"] == "critical"]
    high = [s for s in skill_analysis if s["priority"] == "high"]
    medium = [s for s in skill_analysis if s["priority"] == "medium"]
    
    # Build path
    if critical:
        path.append(f"Phase 1 (Weeks 1-4): Master critical skills - {', '.join([s['skill'] for s in critical[:2]])}")
    
    if high:
        path.append(f"Phase 2 (Weeks 5-8): Learn high-priority skills - {', '.join([s['skill'] for s in high[:2]])}")
    
    if medium:
        path.append(f"Phase 3 (Weeks 9-12): Develop medium-priority skills - {', '.join([s['skill'] for s in medium[:2]])}")
    
    path.append("Phase 4: Build projects to demonstrate skills")
    path.append("Phase 5: Apply to jobs and interview prep")
    
    return path


def _estimate_learning_time(skill_analysis: list[dict]) -> str:
    """Estimate total time to learn all missing skills"""
    
    if not skill_analysis:
        return "Ready to apply!"
    
    # Map difficulty to weeks
    time_map = {
        "beginner": 2,
        "intermediate": 6,
        "advanced": 12
    }
    
    # Calculate total for critical and high priority
    critical_high = [s for s in skill_analysis if s["priority"] in ["critical", "high"]]
    
    total_weeks = sum(time_map.get(s["difficulty"], 6) for s in critical_high[:5])
    
    if total_weeks <= 4:
        return "1-2 weeks"
    elif total_weeks <= 8:
        return "2-4 weeks"
    elif total_weeks <= 16:
        return "1-3 months"
    else:
        return "3-6 months"


def _identify_quick_wins(skill_analysis: list[dict]) -> list[str]:
    """Identify quick wins - easy skills to learn with high impact"""
    
    quick_wins = []
    
    for skill in skill_analysis:
        if skill["priority"] in ["critical", "high"] and skill["difficulty"] == "beginner":
            quick_wins.append(f"Learn {skill['skill']} ({skill['learning_time']})")
    
    return quick_wins[:3]


def _priority_order(priority: str) -> int:
    """Get priority order for sorting"""
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return order.get(priority, 3)


def _calculate_readiness_score(matched_skills: list[str], missing_skills: list[str]) -> float:
    """Calculate readiness score (0-100)"""
    
    total = len(matched_skills) + len(missing_skills)
    if total == 0:
        return 0.0
    
    readiness = (len(matched_skills) / total) * 100
    return round(readiness, 1)
