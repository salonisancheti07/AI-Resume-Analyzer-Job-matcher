import re
from typing import Dict, List, Set, Tuple, Optional
from app.nlp.skills import (
    extract_skills, extract_experience_years, extract_education_level,
    extract_job_titles, extract_tools, extract_certifications, SKILL_TAXONOMY
)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _length_score(word_count: int) -> float:
    """Score based on resume length - optimal range is 450-950 words"""
    if 450 <= word_count <= 950:
        return 100.0
    if 350 <= word_count < 450:
        return 82.0
    if 950 < word_count <= 1200:
        return 78.0
    if 250 <= word_count < 350:
        return 64.0
    if 1200 < word_count <= 1400:
        return 60.0
    return 42.0


def _formatting_quality_score(text: str) -> float:
    """Score resume formatting quality for ATS compatibility"""
    score = 100.0
    
    # Check for tables (negative)
    if re.search(r'<table|┌|┐|└|┘|─|│', text):
        score -= 20
    
    # Check for columns (negative)
    if re.search(r'column|multi-col|text-column', text.lower()):
        score -= 15
    
    # Check for special characters
    if re.search(r'[©®™†‡¶§]', text):
        score -= 10
    
    # Check for proper section headers
    has_sections = bool(re.search(r'(?:experience|education|skills|projects|summary|objective)', text.lower()))
    if not has_sections:
        score -= 15
    
    # Check for bullet points
    bullet_count = len(re.findall(r'^[•\-\*]\s', text, re.MULTILINE))
    if bullet_count < 3:
        score -= 10
    elif bullet_count > 30:
        score -= 5  # Too many bullets
    
    # Check for contact info
    has_email = bool(re.search(r'[^\s@]+@[^\s@]+\.\w+', text))
    has_phone = bool(re.search(r'(\+\d{1,3})?[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}', text))
    if not has_email:
        score -= 10
    if not has_phone:
        score -= 5
    
    return _clamp(score)


def _content_quality_score(text: str) -> float:
    """Score content quality - action verbs, metrics, quantifiable achievements"""
    score = 50.0  # Base score
    
    text_lower = text.lower()
    
    # Action verbs presence
    action_verbs = [
        'achieved', 'built', 'created', 'designed', 'developed', 'drove',
        'enhanced', 'expanded', 'improved', 'increased', 'launched', 'led',
        'managed', 'optimized', 'orchestrated', 'performed', 'reduced',
        'streamlined', 'transformed', 'implemented', 'established'
    ]
    action_count = sum(1 for verb in action_verbs if verb in text_lower)
    score += min(action_count * 2, 20)  # Up to +20
    
    # Quantifiable metrics
    metrics_patterns = [
        r'\d+%',  # Percentages
        r'\$\d+[KMB]?',  # Dollar amounts
        r'\d+x\s',  # Multipliers
        r'\d+\s*(?:users?|customers?|clients?|employees?|team members?)',
    ]
    metrics_count = sum(len(re.findall(p, text)) for p in metrics_patterns)
    score += min(metrics_count * 3, 25)  # Up to +25
    
    # Check for weak words (negative)
    weak_words = ['responsible for', 'duties include', 'worked on', 'helped with', 'assisted']
    weak_count = sum(1 for word in weak_words if word in text_lower)
    score -= weak_count * 3  # Up to -15
    
    return _clamp(score)


def _keyword_optimization_score(text: str, job_skills: Set[str]) -> float:
    """Score keyword optimization against job requirements"""
    if not job_skills:
        return 75.0  # Default if no job description
    
    text_lower = text.lower()
    matched = sum(1 for skill in job_skills if skill in text_lower)
    coverage = matched / len(job_skills)
    
    # Also check for variations and related terms
    variations_matched = 0
    for skill in job_skills:
        # Check for common variations
        if skill in ['python', 'java', 'javascript', 'typescript']:
            if skill in text_lower:
                variations_matched += 1
        elif skill in ['aws', 'azure', 'gcp']:
            if skill in text_lower:
                variations_matched += 1
        elif skill in ['react', 'angular', 'vue']:
            if skill in text_lower:
                variations_matched += 1
    
    # Weighted score
    base_score = coverage * 70
    variation_bonus = (variations_matched / max(1, len(job_skills))) * 30
    
    return _clamp(base_score + variation_bonus)


def _experience_relevance_score(resume_text: str, job_description: str) -> float:
    """Score experience relevance to the job"""
    if not job_description:
        return 70.0
    
    # Extract job requirements keywords
    job_lower = job_description.lower()
    
    # Key requirement patterns
    required_patterns = [
        r'(?:required|must have|essential|minimum)\s+(?:years?|experience)',
        r'(?:preferred|nice to have|desired)\s+(?:years?|experience)',
        r'(?:senior|junior|lead|principal|staff)',
    ]
    
    # Calculate relevance based on overlap
    resume_lower = resume_text.lower()
    
    # Check for role-level keywords matching
    role_keywords = ['engineer', 'developer', 'manager', 'analyst', 'scientist', 'designer']
    job_roles = [kw for kw in role_keywords if kw in job_lower]
    resume_roles = [kw for kw in role_keywords if kw in resume_lower]
    
    if job_roles and resume_roles:
        role_match = len(set(job_roles) & set(resume_roles)) / len(job_roles)
        return _clamp(50 + role_match * 50)
    
    return 70.0


def ats_score(similarity: float, resume_skills: Set[str], job_skills: Set[str], word_count: int, resume_text: str = "", job_description: str = "") -> dict:
    """
    Dynamic ATS scoring with multiple factors
    
    Produces varied scores based on:
    - Skill match percentage (weighted heavily)
    - Experience relevance
    - Keyword optimization
    - Formatting quality
    - Content quality (action verbs, metrics)
    """
    
    # Extract resume metadata for dynamic scoring
    experience_years = extract_experience_years(resume_text) if resume_text else 0
    education_level = extract_education_level(resume_text) if resume_text else "Not specified"
    job_titles = extract_job_titles(resume_text) if resume_text else []
    tools = extract_tools(resume_text) if resume_text else []
    certifications = extract_certifications(resume_text) if resume_text else []
    
    # Core skill matching
    overlap = resume_skills & job_skills
    coverage = len(overlap) / max(1, len(job_skills)) if job_skills else 0
    
    # Semantic similarity scoring (stretched for wider range)
    normalized_sim = (similarity - 0.3) / (0.9 - 0.3) if similarity > 0.3 else 0
    similarity_score = _clamp(normalized_sim * 100)
    
    # Keyword matching score
    keyword_score = _keyword_optimization_score(resume_text, job_skills) if resume_text else 75.0
    
    # Formatting quality
    formatting_score = _formatting_quality_score(resume_text) if resume_text else 80.0
    
    # Content quality
    content_score = _content_quality_score(resume_text) if resume_text else 60.0
    
    # Experience relevance
    experience_score = _experience_relevance_score(resume_text, job_description) if resume_text and job_description else 70.0
    
    # Length score
    length_score = _length_score(word_count)
    
    # Dynamic weighting based on what's available
    # More factors = more varied scores
    weights = {
        "similarity": 0.20,
        "keyword": 0.25,
        "formatting": 0.15,
        "content": 0.15,
        "experience": 0.15,
        "length": 0.10,
    }
    
    final = (
        weights["similarity"] * similarity_score +
        weights["keyword"] * keyword_score +
        weights["formatting"] * formatting_score +
        weights["content"] * content_score +
        weights["experience"] * experience_score +
        weights["length"] * length_score
    )
    
    # Determine missing skills with priority
    missing_skills = sorted(job_skills - resume_skills) if job_skills else []
    missing_with_priority = _prioritize_missing_skills(missing_skills, job_description)
    
    return {
        "similarity": round(similarity, 3),
        "coverage": round(coverage, 3),
        "matched_skills": sorted(overlap),
        "missing_skills": missing_with_priority,
        "word_count": word_count,
        "length_score": round(length_score, 1),
        "final": round(_clamp(final), 1),
        "sub": {
            "semantic_match": round(similarity_score, 1),
            "keyword_match": round(keyword_score, 1),
            "formatting": round(formatting_score, 1),
            "content_quality": round(content_score, 1),
            "experience_relevance": round(experience_score, 1),
            "length": round(length_score, 1),
        },
        "metadata": {
            "experience_years": experience_years,
            "education_level": education_level,
            "detected_titles": job_titles,
            "tools": tools,
            "certifications": certifications,
        },
        "improvement_suggestions": _generate_improvement_suggestions(
            missing_skills, formatting_score, content_score, length_score, job_skills
        ),
    }


def _prioritize_missing_skills(missing_skills: List[str], job_description: str) -> List[Dict]:
    """Prioritize missing skills based on job description importance"""
    if not job_description:
        return [{"skill": s, "priority": "medium"} for s in missing_skills]
    
    job_lower = job_description.lower()
    prioritized = []
    
    for skill in missing_skills:
        skill_lower = skill.lower()
        
        # Check frequency in job description
        frequency = job_lower.count(skill_lower)
        
        # Check if in requirements section
        in_requirements = "required" in job_lower and skill_lower in job_lower
        
        # Determine priority
        if in_requirements or frequency >= 3:
            priority = "critical"
        elif frequency >= 2:
            priority = "high"
        elif frequency >= 1:
            priority = "medium"
        else:
            priority = "low"
        
        prioritized.append({
            "skill": skill,
            "priority": priority,
            "frequency": frequency,
        })
    
    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    prioritized.sort(key=lambda x: priority_order.get(x["priority"], 3))
    
    return prioritized


def _generate_improvement_suggestions(
    missing_skills: List[str],
    formatting_score: float,
    content_score: float,
    length_score: float,
    job_skills: Set[str]
) -> List[Dict]:
    """Generate actionable improvement suggestions"""
    suggestions = []
    
    # Missing skills suggestions
    if missing_skills:
        critical = [s["skill"] for s in missing_skills if isinstance(s, dict) and s.get("priority") == "critical"]
        if critical:
            suggestions.append({
                "category": "keywords",
                "priority": "high",
                "suggestion": f"Add these critical skills: {', '.join(critical[:5])}",
                "action": "Incorporate these keywords naturally into your experience descriptions",
            })
    
    # Formatting suggestions
    if formatting_score < 70:
        suggestions.append({
            "category": "formatting",
            "priority": "high",
            "suggestion": "Improve ATS formatting",
            "action": "Remove tables, columns, and special characters. Use standard section headers.",
        })
    
    # Content quality suggestions
    if content_score < 60:
        suggestions.append({
            "category": "content",
            "priority": "medium",
            "suggestion": "Strengthen achievement descriptions",
            "action": "Use action verbs and add quantifiable metrics (%, $, numbers) to demonstrate impact.",
        })
    
    # Length suggestions
    if length_score < 70:
        if length_score < 50:
            suggestions.append({
                "category": "length",
                "priority": "medium",
                "suggestion": "Expand your resume content",
                "action": "Add more detail to your experience and projects. Aim for 450-950 words.",
            })
        else:
            suggestions.append({
                "category": "length",
                "priority": "low",
                "suggestion": "Trim excessive content",
                "action": "Remove redundant information to stay within optimal word count range.",
            })
    
    # General suggestions
    if not suggestions:
        suggestions.append({
            "category": "optimization",
            "priority": "low",
            "suggestion": "Consider tailoring for specific roles",
            "action": "Customize your resume keywords for each job application to improve match scores.",
        })
    
    return suggestions
