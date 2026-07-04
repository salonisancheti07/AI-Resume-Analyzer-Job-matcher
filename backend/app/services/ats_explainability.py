"""
ATS Score with Explainability - Feature #1
Provides detailed explanations for ATS scores with actionable fixes
"""
import os
from openai import OpenAI
from app.core.config import get_settings

settings = get_settings()


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key)


def analyze_ats_score_with_explanation(
    resume_text: str,
    job_description: str,
    similarity_score: float,
    skill_coverage: float,
    missing_skills: list[str],
    final_score: float
) -> dict:
    """
    Provides detailed ATS score explanation with actionable fixes
    
    Returns:
        {
            "score": float,
            "explanation": str,
            "issues": [{"issue": str, "severity": "high|medium|low", "fix": str}],
            "quick_wins": [str],
            "estimated_improvement": float
        }
    """
    
    # Analyze formatting and structure
    formatting_issues = _analyze_formatting(resume_text)
    keyword_issues = _analyze_keywords(resume_text, job_description, missing_skills)
    structure_issues = _analyze_structure(resume_text)
    
    # Get AI-powered explanation
    explanation = _get_ats_explanation(
        resume_text,
        job_description,
        final_score,
        skill_coverage,
        missing_skills,
        formatting_issues,
        keyword_issues,
        structure_issues
    )
    
    # Combine all issues with severity
    all_issues = []
    
    # High severity issues
    for issue in formatting_issues["critical"]:
        all_issues.append({
            "issue": issue["name"],
            "severity": "high",
            "fix": issue["fix"],
            "impact": "Directly affects ATS parsing"
        })
    
    for issue in keyword_issues["missing_critical"]:
        all_issues.append({
            "issue": f"Missing critical keyword: {issue}",
            "severity": "high",
            "fix": f"Add '{issue}' in relevant experience section",
            "impact": "Reduces keyword match score"
        })
    
    # Medium severity issues
    for issue in structure_issues["warnings"]:
        all_issues.append({
            "issue": issue["name"],
            "severity": "medium",
            "fix": issue["fix"],
            "impact": "May reduce readability for ATS"
        })
    
    for issue in keyword_issues["missing_important"]:
        all_issues.append({
            "issue": f"Missing important keyword: {issue}",
            "severity": "medium",
            "fix": f"Consider adding '{issue}' where relevant",
            "impact": "Reduces match percentage"
        })
    
    # Calculate quick wins (easy fixes with high impact)
    quick_wins = _calculate_quick_wins(all_issues, missing_skills)
    
    # Estimate improvement if fixes are applied
    estimated_improvement = _estimate_improvement(all_issues, skill_coverage)
    
    return {
        "score": round(final_score, 1),
        "explanation": explanation,
        "issues": all_issues[:10],  # Top 10 issues
        "quick_wins": quick_wins,
        "estimated_improvement": round(estimated_improvement, 1),
        "formatting_score": round((1 - len(formatting_issues["critical"]) * 0.1) * 100, 1),
        "keyword_score": round(skill_coverage * 100, 1),
        "structure_score": round((1 - len(structure_issues["warnings"]) * 0.05) * 100, 1)
    }


def _analyze_formatting(resume_text: str) -> dict:
    """Analyze formatting issues that affect ATS parsing"""
    issues = {
        "critical": [],
        "warnings": []
    }
    
    # Check for common formatting problems
    if resume_text.count("\n") < 5:
        issues["critical"].append({
            "name": "Poor line breaks - content may be unreadable",
            "fix": "Add proper line breaks between sections"
        })
    
    if "•" not in resume_text and "-" not in resume_text:
        issues["critical"].append({
            "name": "No bullet points - reduces readability",
            "fix": "Use bullet points (•) for achievements and responsibilities"
        })
    
    # Check for special characters that break ATS
    problematic_chars = ["©", "®", "™", "§", "¶"]
    for char in problematic_chars:
        if char in resume_text:
            issues["critical"].append({
                "name": f"Special character '{char}' may break ATS parsing",
                "fix": f"Replace '{char}' with plain text equivalent"
            })
    
    # Check for tables (ATS doesn't parse well)
    if "|" in resume_text and resume_text.count("|") > 5:
        issues["warnings"].append({
            "name": "Possible table format - ATS may not parse correctly",
            "fix": "Convert tables to simple text format with line breaks"
        })
    
    return issues


def _analyze_keywords(resume_text: str, job_description: str, missing_skills: list[str]) -> dict:
    """Analyze keyword coverage"""
    issues = {
        "missing_critical": [],
        "missing_important": []
    }
    
    # Prioritize missing skills
    if missing_skills:
        # Top 3 are critical
        for skill in missing_skills[:3]:
            issues["missing_critical"].append(skill)
        
        # Next 5 are important
        for skill in missing_skills[3:8]:
            issues["missing_important"].append(skill)
    
    return issues


def _analyze_structure(resume_text: str) -> dict:
    """Analyze resume structure"""
    issues = {
        "warnings": []
    }
    
    text_lower = resume_text.lower()
    
    # Check for required sections
    required_sections = {
        "summary": ["summary", "objective", "professional summary"],
        "experience": ["experience", "work history", "employment"],
        "education": ["education", "degree", "university"],
        "skills": ["skills", "technical skills", "competencies"]
    }
    
    missing_sections = []
    for section, keywords in required_sections.items():
        if not any(kw in text_lower for kw in keywords):
            missing_sections.append(section)
    
    if missing_sections:
        issues["warnings"].append({
            "name": f"Missing sections: {', '.join(missing_sections)}",
            "fix": f"Add {', '.join(missing_sections)} sections to your resume"
        })
    
    # Check for contact info
    if "@" not in resume_text:
        issues["warnings"].append({
            "name": "No email address found",
            "fix": "Add your email address at the top of resume"
        })
    
    return issues


def _get_ats_explanation(
    resume_text: str,
    job_description: str,
    score: float,
    skill_coverage: float,
    missing_skills: list[str],
    formatting_issues: dict,
    keyword_issues: dict,
    structure_issues: dict
) -> str:
    """Get AI-powered explanation of ATS score"""
    
    system = """You are an ATS (Applicant Tracking System) expert. Explain why a resume got a specific ATS score.
Be concise, specific, and actionable. Focus on the most impactful factors."""
    
    issues_summary = f"""
Formatting Issues: {len(formatting_issues['critical'])} critical, {len(formatting_issues['warnings'])} warnings
Keyword Issues: Missing {len(missing_skills)} skills
Structure Issues: {len(structure_issues['warnings'])} warnings
Skill Coverage: {skill_coverage*100:.0f}%
"""
    
    user = f"""Resume ATS Score: {score}/100
Skill Coverage: {skill_coverage*100:.0f}%
Missing Skills: {', '.join(missing_skills[:5]) if missing_skills else 'None'}

{issues_summary}

Provide a 2-3 sentence explanation of why this score is what it is, focusing on the biggest impact factors."""
    
    resp = _get_client().chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=0.5,
        max_tokens=200
    )
    
    return resp.choices[0].message.content


def _calculate_quick_wins(issues: list[dict], missing_skills: list[str]) -> list[str]:
    """Calculate quick wins - easy fixes with high impact"""
    quick_wins = []
    
    # Add top 3 missing skills as quick wins
    for skill in missing_skills[:3]:
        quick_wins.append(f"Add '{skill}' to your skills section")
    
    # Add formatting fixes
    high_severity = [i for i in issues if i["severity"] == "high"]
    for issue in high_severity[:2]:
        quick_wins.append(issue["fix"])
    
    return quick_wins[:5]


def _estimate_improvement(issues: list[dict], current_coverage: float) -> float:
    """Estimate score improvement if issues are fixed"""
    # Each high severity fix = ~5 points
    # Each medium severity fix = ~2 points
    
    high_count = len([i for i in issues if i["severity"] == "high"])
    medium_count = len([i for i in issues if i["severity"] == "medium"])
    
    improvement = (high_count * 5) + (medium_count * 2)
    
    # Cap at 100
    return min(100, improvement)
