"""
Resume Heatmap Analyzer - Feature #3
Visual heatmap showing strong sections (green) and weak sections (red)
"""
import re
from typing import Dict, List, Tuple


def analyze_resume_heatmap(resume_text: str, job_description: str) -> dict:
    """
    Analyze resume sections and create heatmap data
    
    Returns:
        {
            "sections": [
                {
                    "name": str,
                    "score": float (0-100),
                    "color": "green" | "yellow" | "red",
                    "metrics": {
                        "word_count": int,
                        "keyword_density": float,
                        "quality_score": float
                    },
                    "feedback": str
                }
            ],
            "overall_health": float,
            "strongest_section": str,
            "weakest_section": str,
            "heatmap_data": [[float, ...], ...]  # For visualization
        }
    """
    
    # Extract sections
    sections = _extract_resume_sections(resume_text)
    
    # Analyze each section
    section_scores = []
    for section_name, section_text in sections.items():
        score = _score_section(section_name, section_text, job_description, resume_text)
        section_scores.append({
            "name": section_name,
            "score": score,
            "color": _get_color(score),
            "metrics": _calculate_section_metrics(section_name, section_text, job_description),
            "feedback": _get_section_feedback(section_name, score, section_text)
        })
    
    # Sort by score
    section_scores.sort(key=lambda x: x["score"], reverse=True)
    
    # Calculate overall health
    overall_health = sum(s["score"] for s in section_scores) / len(section_scores) if section_scores else 0
    
    # Get strongest and weakest
    strongest = section_scores[0]["name"] if section_scores else "N/A"
    weakest = section_scores[-1]["name"] if section_scores else "N/A"
    
    # Create heatmap data for visualization
    heatmap_data = _create_heatmap_data(section_scores)
    
    return {
        "sections": section_scores,
        "overall_health": round(overall_health, 1),
        "strongest_section": strongest,
        "weakest_section": weakest,
        "heatmap_data": heatmap_data,
        "section_count": len(section_scores)
    }


def _extract_resume_sections(resume_text: str) -> Dict[str, str]:
    """Extract major resume sections"""
    sections = {
        "summary": "",
        "experience": "",
        "education": "",
        "skills": "",
        "projects": "",
        "certifications": "",
        "other": ""
    }
    
    text_lower = resume_text.lower()
    
    # Define section patterns
    section_patterns = {
        "summary": r"(professional summary|summary|objective|profile)[\s\n]+(.*?)(?=\n(?:experience|work|education|skills|projects|certification|other|$))",
        "experience": r"(experience|work history|employment)[\s\n]+(.*?)(?=\n(?:education|skills|projects|certification|summary|other|$))",
        "education": r"(education|academic|degree)[\s\n]+(.*?)(?=\n(?:experience|skills|projects|certification|summary|other|$))",
        "skills": r"(skills|technical skills|competencies)[\s\n]+(.*?)(?=\n(?:experience|education|projects|certification|summary|other|$))",
        "projects": r"(projects|portfolio|work samples)[\s\n]+(.*?)(?=\n(?:experience|education|skills|certification|summary|other|$))",
        "certifications": r"(certifications?|licenses?|awards?)[\s\n]+(.*?)(?=\n(?:experience|education|skills|projects|summary|other|$))"
    }
    
    for section, pattern in section_patterns.items():
        match = re.search(pattern, resume_text, re.IGNORECASE | re.DOTALL)
        if match:
            sections[section] = match.group(2).strip()
    
    # Remaining text goes to "other"
    used_text = "".join(sections.values())
    sections["other"] = resume_text.replace(used_text, "").strip()
    
    # Remove empty sections
    return {k: v for k, v in sections.items() if v}


def _score_section(section_name: str, section_text: str, job_description: str, full_resume: str) -> float:
    """Score a resume section (0-100)"""
    if not section_text:
        return 0.0
    
    score = 50.0  # Base score
    
    # Length scoring
    word_count = len(section_text.split())
    if section_name == "summary":
        if 50 <= word_count <= 150:
            score += 15
        elif word_count > 200:
            score -= 10
    elif section_name == "experience":
        if word_count >= 200:
            score += 15
        elif word_count < 50:
            score -= 15
    elif section_name == "education":
        if 30 <= word_count <= 200:
            score += 10
    elif section_name == "skills":
        if word_count >= 30:
            score += 15
    
    # Quality indicators
    if "•" in section_text or "-" in section_text:
        score += 10  # Has bullet points
    
    if section_name == "experience":
        # Check for action verbs
        action_verbs = ["developed", "led", "managed", "created", "implemented", "designed", "built", "improved"]
        verb_count = sum(1 for verb in action_verbs if verb in section_text.lower())
        score += min(15, verb_count * 2)
    
    # Keyword relevance
    job_keywords = set(job_description.lower().split())
    section_keywords = set(section_text.lower().split())
    keyword_overlap = len(job_keywords & section_keywords) / max(1, len(job_keywords))
    score += keyword_overlap * 20
    
    # Formatting quality
    lines = section_text.split("\n")
    if len(lines) >= 3:
        score += 5
    
    # Cap at 100
    return min(100, max(0, score))


def _get_color(score: float) -> str:
    """Get color based on score"""
    if score >= 75:
        return "green"
    elif score >= 50:
        return "yellow"
    else:
        return "red"


def _calculate_section_metrics(section_name: str, section_text: str, job_description: str) -> dict:
    """Calculate detailed metrics for a section"""
    word_count = len(section_text.split())
    
    # Keyword density
    job_keywords = set(job_description.lower().split())
    section_keywords = set(section_text.lower().split())
    keyword_density = len(job_keywords & section_keywords) / max(1, len(section_keywords))
    
    # Quality score based on formatting
    quality_score = 0
    if "•" in section_text:
        quality_score += 25
    if "-" in section_text:
        quality_score += 25
    if len(section_text.split("\n")) >= 3:
        quality_score += 25
    
    # Action verb count (for experience)
    action_verbs = ["developed", "led", "managed", "created", "implemented", "designed", "built", "improved"]
    action_verb_count = sum(1 for verb in action_verbs if verb in section_text.lower())
    quality_score += min(25, action_verb_count * 5)
    
    return {
        "word_count": word_count,
        "keyword_density": round(keyword_density, 2),
        "quality_score": min(100, quality_score),
        "line_count": len(section_text.split("\n"))
    }


def _get_section_feedback(section_name: str, score: float, section_text: str) -> str:
    """Get feedback for a section"""
    if score >= 75:
        return f"✓ {section_name.capitalize()} section is strong"
    elif score >= 50:
        if "•" not in section_text and "-" not in section_text:
            return f"⚠ Add bullet points to {section_name} section"
        elif len(section_text.split()) < 50:
            return f"⚠ Expand {section_name} section with more details"
        else:
            return f"⚠ Improve {section_name} section formatting"
    else:
        return f"✗ {section_name.capitalize()} section needs improvement"


def _create_heatmap_data(section_scores: List[dict]) -> List[List[float]]:
    """Create heatmap visualization data"""
    # Create a simple grid representation
    # Each row represents a section, columns represent score ranges
    heatmap = []
    
    for section in section_scores:
        score = section["score"]
        # Create 10 columns (0-10, 10-20, ..., 90-100)
        row = []
        for i in range(10):
            threshold = (i + 1) * 10
            if score >= threshold:
                row.append(1.0)
            elif score >= threshold - 10:
                row.append((score - (threshold - 10)) / 10)
            else:
                row.append(0.0)
        heatmap.append(row)
    
    return heatmap


def get_heatmap_visualization_data(heatmap_analysis: dict) -> dict:
    """
    Format heatmap data for frontend visualization
    Returns data suitable for charting libraries
    """
    sections = heatmap_analysis["sections"]
    
    # Prepare data for bar chart
    chart_data = {
        "labels": [s["name"].capitalize() for s in sections],
        "scores": [s["score"] for s in sections],
        "colors": [s["color"] for s in sections]
    }
    
    # Prepare detailed breakdown
    breakdown = []
    for section in sections:
        breakdown.append({
            "section": section["name"],
            "score": section["score"],
            "color": section["color"],
            "metrics": section["metrics"],
            "feedback": section["feedback"]
        })
    
    return {
        "chart_data": chart_data,
        "breakdown": breakdown,
        "overall_health": heatmap_analysis["overall_health"],
        "strongest": heatmap_analysis["strongest_section"],
        "weakest": heatmap_analysis["weakest_section"]
    }
