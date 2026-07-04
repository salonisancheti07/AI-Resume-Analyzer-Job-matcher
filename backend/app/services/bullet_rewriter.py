"""
AI Bullet Point Rewriter - Feature #4
Converts basic bullet points to impactful achievement-focused statements
"""
import os
import re
from openai import OpenAI
from app.core.config import get_settings

settings = get_settings()


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key)


def rewrite_bullet_points(resume_text: str, job_description: str = "") -> dict:
    """
    Rewrite resume bullet points to be more impactful
    
    Returns:
        {
            "original_bullets": [str],
            "rewritten_bullets": [str],
            "improvements": [
                {
                    "original": str,
                    "rewritten": str,
                    "improvement_type": str,
                    "impact_score": float
                }
            ],
            "tips": [str]
        }
    """
    
    # Extract bullet points
    bullets = _extract_bullets(resume_text)
    
    if not bullets:
        return {
            "original_bullets": [],
            "rewritten_bullets": [],
            "improvements": [],
            "tips": ["Add bullet points to your resume for better formatting"]
        }
    
    # Rewrite each bullet
    improvements = []
    for bullet in bullets:
        rewritten = _rewrite_single_bullet(bullet, job_description)
        improvement_type = _classify_improvement(bullet, rewritten)
        impact_score = _calculate_impact_score(bullet, rewritten)
        
        improvements.append({
            "original": bullet,
            "rewritten": rewritten,
            "improvement_type": improvement_type,
            "impact_score": impact_score
        })
    
    # Sort by impact
    improvements.sort(key=lambda x: x["impact_score"], reverse=True)
    
    # Generate tips
    tips = _generate_rewriting_tips(bullets)
    
    return {
        "original_bullets": bullets,
        "rewritten_bullets": [imp["rewritten"] for imp in improvements],
        "improvements": improvements[:20],  # Top 20 improvements
        "tips": tips
    }


def _extract_bullets(resume_text: str) -> list[str]:
    """Extract bullet points from resume"""
    bullets = []
    
    # Match lines starting with bullet characters
    bullet_patterns = [
        r"^[\s]*[•\-\*]\s+(.+)$",  # Bullet, dash, or asterisk
        r"^[\s]*\d+\.\s+(.+)$",     # Numbered list
    ]
    
    for line in resume_text.split("\n"):
        for pattern in bullet_patterns:
            match = re.match(pattern, line.strip())
            if match:
                bullet_text = match.group(1).strip()
                if len(bullet_text) > 10:  # Filter out very short lines
                    bullets.append(bullet_text)
                break
    
    return bullets


def _rewrite_single_bullet(bullet: str, job_description: str = "") -> str:
    """Rewrite a single bullet point using AI"""
    
    system = """You are an expert resume writer. Rewrite bullet points to be:
1. Action-oriented (start with strong verbs)
2. Quantifiable (include metrics/numbers when possible)
3. Impact-focused (show business value)
4. Concise (under 15 words)

Return ONLY the rewritten bullet point, no explanation."""
    
    context = f"\nJob context: {job_description[:500]}" if job_description else ""
    user = f"Rewrite this bullet point to be more impactful:{context}\n\nOriginal: {bullet}"
    
    try:
        resp = _get_client().chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=0.7,
            max_tokens=100
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        # Fallback to rule-based rewriting
        return _rule_based_rewrite(bullet)


def _rule_based_rewrite(bullet: str) -> str:
    """Fallback rule-based bullet rewriting"""
    
    # Common weak verbs to strong verbs
    verb_replacements = {
        "did": "Executed",
        "made": "Developed",
        "helped": "Facilitated",
        "worked on": "Engineered",
        "was responsible for": "Owned",
        "involved in": "Spearheaded",
        "participated in": "Contributed to",
        "used": "Leveraged",
        "tried": "Implemented",
        "managed": "Led",
        "handled": "Orchestrated",
        "created": "Architected",
        "built": "Engineered",
        "improved": "Optimized",
        "increased": "Accelerated",
        "decreased": "Reduced",
        "fixed": "Resolved",
        "changed": "Transformed",
        "added": "Integrated",
        "removed": "Eliminated"
    }
    
    rewritten = bullet
    
    # Replace weak verbs
    for weak, strong in verb_replacements.items():
        pattern = rf"\b{weak}\b"
        rewritten = re.sub(pattern, strong, rewritten, flags=re.IGNORECASE)
    
    # Add metrics if missing
    if not re.search(r"\d+%|\d+x|\$\d+|increased|decreased|improved", rewritten):
        # Try to infer metrics
        if "performance" in rewritten.lower():
            rewritten += " by 20%"
        elif "efficiency" in rewritten.lower():
            rewritten += " by 15%"
        elif "revenue" in rewritten.lower() or "sales" in rewritten.lower():
            rewritten += " by $50K"
    
    # Ensure starts with action verb
    if not re.match(r"^[A-Z][a-z]+ed?\s", rewritten):
        action_verbs = ["Developed", "Engineered", "Led", "Implemented", "Optimized"]
        rewritten = f"{action_verbs[0]} {rewritten[0].lower() + rewritten[1:]}"
    
    return rewritten


def _classify_improvement(original: str, rewritten: str) -> str:
    """Classify the type of improvement made"""
    
    improvements = []
    
    # Check for verb improvement
    weak_verbs = ["did", "made", "helped", "worked", "was", "involved", "participated", "used", "tried"]
    if any(verb in original.lower() for verb in weak_verbs):
        improvements.append("Stronger Verb")
    
    # Check for metrics addition
    if not re.search(r"\d+%|\d+x|\$\d+", original) and re.search(r"\d+%|\d+x|\$\d+", rewritten):
        improvements.append("Added Metrics")
    
    # Check for clarity improvement
    if len(rewritten) < len(original) * 0.9:
        improvements.append("More Concise")
    
    # Check for impact focus
    impact_words = ["increased", "improved", "optimized", "accelerated", "reduced", "transformed"]
    if any(word in rewritten.lower() for word in impact_words):
        improvements.append("Impact-Focused")
    
    return " + ".join(improvements) if improvements else "Refined"


def _calculate_impact_score(original: str, rewritten: str) -> float:
    """Calculate impact score of the rewrite (0-100)"""
    
    score = 50.0  # Base score
    
    # Verb strength
    strong_verbs = ["developed", "engineered", "led", "implemented", "optimized", "accelerated", "transformed"]
    if any(verb in rewritten.lower() for verb in strong_verbs):
        score += 15
    
    # Metrics presence
    if re.search(r"\d+%|\d+x|\$\d+", rewritten):
        score += 20
    
    # Conciseness
    if len(rewritten) < len(original):
        score += 10
    
    # Impact words
    impact_words = ["increased", "improved", "optimized", "reduced", "transformed", "accelerated"]
    if any(word in rewritten.lower() for word in impact_words):
        score += 15
    
    # Avoid generic words
    generic_words = ["did", "made", "helped", "worked", "was", "involved"]
    if not any(word in rewritten.lower() for word in generic_words):
        score += 10
    
    return min(100, score)


def _generate_rewriting_tips(bullets: list[str]) -> list[str]:
    """Generate tips based on current bullet points"""
    
    tips = []
    
    # Check for weak verbs
    weak_verb_count = 0
    for bullet in bullets:
        weak_verbs = ["did", "made", "helped", "worked", "was", "involved", "participated", "used"]
        if any(verb in bullet.lower() for verb in weak_verbs):
            weak_verb_count += 1
    
    if weak_verb_count > len(bullets) * 0.3:
        tips.append("💡 Use stronger action verbs (Developed, Led, Engineered instead of Did, Made, Helped)")
    
    # Check for metrics
    metrics_count = sum(1 for b in bullets if re.search(r"\d+%|\d+x|\$\d+", b))
    if metrics_count < len(bullets) * 0.5:
        tips.append("📊 Add quantifiable metrics (%, $, x improvement) to show impact")
    
    # Check for length
    avg_length = sum(len(b.split()) for b in bullets) / len(bullets)
    if avg_length > 20:
        tips.append("✂️ Keep bullets concise (under 15 words) for better readability")
    
    # Check for impact words
    impact_words = ["increased", "improved", "optimized", "reduced", "transformed"]
    impact_count = sum(1 for b in bullets for w in impact_words if w in b.lower())
    if impact_count < len(bullets) * 0.3:
        tips.append("🎯 Focus on business impact and results, not just tasks")
    
    # Check for consistency
    if tips:
        tips.append("✨ Apply these improvements to all bullet points for consistency")
    
    return tips[:5]


def apply_bullet_rewrites(resume_text: str, improvements: list[dict]) -> str:
    """Apply bullet point rewrites to resume text"""
    
    updated_resume = resume_text
    
    for improvement in improvements:
        original = improvement["original"]
        rewritten = improvement["rewritten"]
        
        # Replace in resume (with bullet formatting)
        patterns = [
            f"• {original}",
            f"- {original}",
            f"* {original}",
            original
        ]
        
        for pattern in patterns:
            if pattern in updated_resume:
                updated_resume = updated_resume.replace(pattern, f"• {rewritten}")
                break
    
    return updated_resume
