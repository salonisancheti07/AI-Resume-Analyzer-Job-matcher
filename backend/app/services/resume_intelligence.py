import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Set

from app.data.job_market import JOB_MARKET_ROLES, get_matching_roles
from app.nlp.similarity import semantic_similarity
from app.nlp.skills import (
    SKILL_TAXONOMY,
    extract_certifications,
    extract_education_level,
    extract_experience_years,
    extract_job_titles,
    extract_skills,
    extract_tools,
)
from app.services.ats_checker import ATSChecker

SECTION_PATTERNS = {
    "summary": [r"\bsummary\b", r"\bobjective\b", r"\bprofessional summary\b"],
    "experience": [r"\bexperience\b", r"\bwork history\b", r"\bemployment\b"],
    "education": [r"\beducation\b", r"\bacademics\b", r"\bqualification"],
    "skills": [r"\bskills\b", r"\btechnical skills\b", r"\bcore competencies\b"],
    "projects": [r"\bprojects\b", r"\bproject experience\b", r"\bacademic projects\b"],
    "certifications": [r"\bcertifications\b", r"\blicenses\b", r"\bcertificates\b"],
}

EXPERIENCE_HINTS = {
    "intern": 0,
    "junior": 1,
    "associate": 2,
    "engineer": 2,
    "developer": 2,
    "analyst": 2,
    "specialist": 2,
    "senior": 4,
    "lead": 5,
    "staff": 6,
    "principal": 7,
    "manager": 6,
    "architect": 6,
}

STOPWORDS = {
    "with", "that", "this", "from", "your", "have", "will", "into", "using", "used",
    "their", "about", "years", "year", "team", "work", "role", "must", "should",
    "ability", "strong", "build", "building", "develop", "experience", "required",
    "preferred", "plus", "good", "knowledge", "understanding", "skills", "skill",
}

ACTION_VERBS = {
    "achieved", "built", "created", "designed", "developed", "drove", "enhanced",
    "improved", "implemented", "increased", "launched", "led", "managed", "optimized",
    "reduced", "scaled", "streamlined", "delivered", "automated",
}

INDIA_LOCATIONS = {
    "india", "remote india", "remote - india", "remote (india)", "pan india",
    "pune", "bengaluru", "bangalore", "hyderabad", "mumbai", "chennai",
    "noida", "gurugram", "gurgaon", "delhi ncr", "new delhi", "delhi",
}

FOREIGN_LOCATION_BLOCKLIST = {
    "brazil", "latin america", "latam", "europe", "united states", "usa", "us only",
    "canada", "uk", "united kingdom", "germany", "france", "spain", "portugal",
    "mexico", "argentina", "colombia",
}

ENTRY_LEVEL_TITLES = {
    "intern", "internship", "graduate", "associate", "junior", "trainee",
    "entry level", "entry-level", "fresher",
}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _normalize_space(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text or "").strip()


def _contains_section(text: str, patterns: List[str]) -> bool:
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)


def extract_sections(text: str) -> Dict[str, bool]:
    return {
        name: _contains_section(text, patterns)
        for name, patterns in SECTION_PATTERNS.items()
    }


def _extract_section_block(text: str, name: str) -> str:
    patterns = SECTION_PATTERNS.get(name, [])
    lines = text.splitlines()
    start_idx = None
    for idx, line in enumerate(lines):
        if any(re.search(pattern, line, re.IGNORECASE) for pattern in patterns):
            start_idx = idx + 1
            break
    if start_idx is None:
        return ""
    block: List[str] = []
    for line in lines[start_idx:]:
        if not line.strip():
            if block:
                break
            continue
        if any(
            other != name and any(re.search(pattern, line, re.IGNORECASE) for pattern in SECTION_PATTERNS[other])
            for other in SECTION_PATTERNS
        ):
            break
        block.append(line.rstrip())
    return "\n".join(block).strip()


def _extract_bullets(text: str) -> List[str]:
    bullets = []
    for line in text.splitlines():
        line = _normalize_space(line)
        if re.match(r"^(?:[-*•]\s+|\d+\.\s+)", line):
            bullets.append(re.sub(r"^(?:[-*•]\s+|\d+\.\s+)", "", line))
    return bullets


def _extract_projects(text: str) -> List[Dict[str, str]]:
    block = _extract_section_block(text, "projects")
    source_lines = block.splitlines() if block else text.splitlines()
    projects: List[Dict[str, str]] = []
    current: Optional[Dict[str, str]] = None
    for raw_line in source_lines:
        line = _normalize_space(raw_line)
        if not line:
            continue
        if re.match(r"^(?:[-*•]\s+|\d+\.\s+)", raw_line):
            content = re.sub(r"^(?:[-*•]\s+|\d+\.\s+)", "", line)
            if current:
                current["description"] += (" " if current["description"] else "") + content
            else:
                current = {"name": content[:80], "description": content}
                projects.append(current)
            continue
        if len(line.split()) <= 10 and not re.search(r"\b(project|built|developed|implemented)\b", line, re.IGNORECASE):
            current = {"name": line, "description": ""}
            projects.append(current)
            continue
        if re.search(r"\b(project|built|developed|implemented|designed|created)\b", line, re.IGNORECASE):
            current = {"name": line[:80], "description": line}
            projects.append(current)
    return projects[:6]


def _extract_education_entries(text: str) -> List[str]:
    block = _extract_section_block(text, "education")
    source = block or text
    patterns = [
        r"(b\.?tech|bachelor|master|m\.?tech|m\.?s|b\.?s|mba|phd|doctorate|diploma)[^\n]*",
        r"[^\n]*(university|college|institute)[^\n]*",
    ]
    entries: List[str] = []
    for pattern in patterns:
        entries.extend(re.findall(pattern, source, flags=re.IGNORECASE))
    cleaned = []
    for item in entries:
        if isinstance(item, tuple):
            item = " ".join([part for part in item if part]).strip()
        cleaned.append(_normalize_space(item))
    return list(dict.fromkeys([item for item in cleaned if item]))[:5]


def _extract_candidate_name(text: str) -> str:
    for line in text.splitlines()[:10]:
        cleaned = _normalize_space(re.sub(r"[^A-Za-z .'-]", " ", line))
        if not cleaned or "resume" in cleaned.lower() or "curriculum" in cleaned.lower():
            continue
        words = cleaned.split()
        if 2 <= len(words) <= 4 and all(word[:1].isupper() for word in words if word):
            return cleaned
    return ""


def _extract_location(text: str) -> str:
    lower = text.lower()
    found = [loc for loc in INDIA_LOCATIONS if re.search(rf"\b{re.escape(loc)}\b", lower)]
    return ", ".join(sorted(set(found))) if found else ""


def _career_level(years: int, text: str) -> str:
    lower = text.lower()
    if years < 2 or any(token in lower for token in ["fresher", "internship", "intern ", "trainee", "graduate"]):
        return "Fresher" if years == 0 else "Entry Level"
    if years < 5:
        return "Early Career"
    if years < 9:
        return "Mid Level"
    return "Senior"


def _split_skill_categories(skills: Set[str]) -> Dict[str, List[str]]:
    soft = set(SKILL_TAXONOMY.get("soft_skills", set()))
    technical = set().union(
        SKILL_TAXONOMY.get("languages", set()),
        SKILL_TAXONOMY.get("frontend", set()),
        SKILL_TAXONOMY.get("backend", set()),
        SKILL_TAXONOMY.get("cloud_devops", set()),
        SKILL_TAXONOMY.get("data_ml", set()),
        SKILL_TAXONOMY.get("databases", set()),
        SKILL_TAXONOMY.get("tools", set()),
    )
    return {
        "technical_skills": sorted(skills & technical),
        "soft_skills": sorted(skills & soft),
    }


def _extract_experience_entries(text: str) -> List[Dict[str, Any]]:
    lines = [line.rstrip() for line in text.splitlines()]
    entries: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    for raw_line in lines:
        line = _normalize_space(raw_line)
        if not line:
            continue
        if re.search(r"(20\d{2}|present|current)", line, re.IGNORECASE) and len(line.split()) <= 14:
            if current:
                entries.append(current)
            current = {"header": line, "bullets": []}
            continue
        if re.match(r"^(?:[-*•]\s+|\d+\.\s+)", raw_line):
            if not current:
                current = {"header": "", "bullets": []}
            current["bullets"].append(re.sub(r"^(?:[-*•]\s+|\d+\.\s+)", "", line))
            continue
        if current and not current.get("title") and len(line.split()) <= 12:
            current["title"] = line
            continue
        if current:
            current.setdefault("details", [])
            current["details"].append(line)

    if current:
        entries.append(current)

    normalized = []
    for item in entries:
        normalized.append(
            {
                "title": item.get("title") or item.get("header") or "Experience",
                "timeline": item.get("header", ""),
                "bullets": item.get("bullets", []),
                "details": item.get("details", []),
            }
        )
    return normalized[:8]


def _extract_keywords(job_description: str) -> List[str]:
    tokens = re.findall(r"\b[a-zA-Z][a-zA-Z+.#/-]{2,}\b", (job_description or "").lower())
    counts = Counter(token for token in tokens if token not in STOPWORDS and len(token) > 2)
    ranked = [token for token, _ in counts.most_common(25)]
    return ranked


def _extract_required_years(job_description: str) -> Optional[int]:
    patterns = [
        r"(\d+)\+?\s*(?:years|yrs).*?(?:experience|exp)",
        r"(?:experience|exp).*?(\d+)\+?\s*(?:years|yrs)",
    ]
    for pattern in patterns:
        match = re.search(pattern, job_description.lower())
        if match:
            return int(match.group(1))
    return None


def _infer_target_roles(resume_text: str, skills: Set[str], preferred_role: str = "") -> List[str]:
    ranked_roles = get_matching_roles(skills, extract_experience_years(resume_text))
    roles = [role["role"] for role in ranked_roles[:4]]
    rules = [
        ({"react", "node", "mongodb"}, "Full Stack Developer"),
        ({"java", "spring"}, "Backend Developer"),
        ({"python", "machine learning"}, "ML Engineer"),
        ({"power bi", "sql"}, "Data Analyst"),
        ({"android", "kotlin"}, "Android Developer"),
    ]
    for required, role_name in rules:
        if required <= skills and role_name not in roles:
            roles.insert(0, role_name)
    lowered = preferred_role.lower().strip()
    if lowered:
        direct = [name for name in JOB_MARKET_ROLES if lowered in name.lower()]
        roles = direct + [role for role in roles if role not in direct]
    title_hits = extract_job_titles(resume_text)
    for title in title_hits:
        for role_name in JOB_MARKET_ROLES:
            if title and title in role_name.lower() and role_name not in roles:
                roles.append(role_name)
    return roles[:5]


def extract_resume_profile(resume_text: str, preferred_role: str = "") -> Dict[str, Any]:
    skills = set(extract_skills(resume_text))
    sections = extract_sections(resume_text)
    projects = _extract_projects(resume_text)
    experience_entries = _extract_experience_entries(resume_text)
    bullets = _extract_bullets(resume_text)
    experience_years = extract_experience_years(resume_text)
    tools = extract_tools(resume_text)
    certifications = extract_certifications(resume_text)
    titles = extract_job_titles(resume_text)
    target_roles = _infer_target_roles(resume_text, skills, preferred_role)
    skill_groups = _split_skill_categories(skills)
    location = _extract_location(resume_text)
    career_level = _career_level(experience_years, resume_text)

    return {
        "candidate_name": _extract_candidate_name(resume_text),
        "skills": sorted(skills),
        "technical_skills": skill_groups["technical_skills"],
        "soft_skills": skill_groups["soft_skills"],
        "tools": tools,
        "certifications": certifications,
        "education_level": extract_education_level(resume_text),
        "education_entries": _extract_education_entries(resume_text),
        "job_titles": titles,
        "preferred_domains": target_roles,
        "location": location,
        "projects": projects,
        "experience_entries": experience_entries,
        "experience_years": experience_years,
        "years_of_experience": experience_years,
        "career_level": career_level,
        "internship_experience": [
            entry for entry in experience_entries
            if "intern" in f"{entry.get('title', '')} {entry.get('timeline', '')}".lower()
        ],
        "work_experience": [
            entry for entry in experience_entries
            if "intern" not in f"{entry.get('title', '')} {entry.get('timeline', '')}".lower()
        ],
        "sections": sections,
        "bullet_count": len(bullets),
        "word_count": len(resume_text.split()),
        "target_roles": target_roles,
    }


def _is_india_relevant_location(location: str, explicit_location: str = "") -> bool:
    text = f"{location or ''} {explicit_location or ''}".lower()
    if not text.strip():
        return False
    if any(blocked in text for blocked in FOREIGN_LOCATION_BLOCKLIST):
        return False
    if any(loc in text for loc in INDIA_LOCATIONS):
        return True
    return False


def _location_score(location: str, preferred_location: str = "") -> float:
    text = (location or "").lower()
    preferred = (preferred_location or "").lower()
    if not _is_india_relevant_location(text, preferred):
        return 0.0
    if preferred and preferred != "any" and preferred in text:
        return 100.0
    if "remote" in text and "india" in text:
        return 95.0
    if any(city in text for city in INDIA_LOCATIONS):
        return 85.0
    return 70.0


def _job_experience_years(job_text: str) -> Optional[int]:
    return _extract_required_years(job_text)


def _job_matches_fresher_level(job_text: str, years: int) -> bool:
    lower = job_text.lower()
    if years >= 2:
        return True
    if any(senior in lower for senior in ["senior", "lead", "principal", "architect", "manager", "5+ years", "6+ years"]):
        return False
    required_years = _job_experience_years(lower)
    if required_years is not None and required_years > 2:
        return False
    return True


def score_real_job_match(
    resume_text: str,
    job: Dict[str, Any],
    preferred_location: str = "",
) -> Optional[Dict[str, Any]]:
    profile = extract_resume_profile(resume_text)
    job_text = " ".join(
        str(job.get(key, ""))
        for key in ("title", "role", "description", "company", "location", "salary")
    )
    if not _is_india_relevant_location(str(job.get("location", "")), preferred_location):
        return None
    if not _job_matches_fresher_level(job_text, profile["experience_years"]):
        return None

    resume_skills = set(profile["skills"])
    job_skills = set(extract_skills(job_text))
    if not job_skills:
        inferred_roles = profile.get("target_roles", [])
        for role_name in inferred_roles[:2]:
            role = JOB_MARKET_ROLES.get(role_name)
            if role:
                job_skills.update(role.required_skills | role.preferred_skills)

    matched_skills = sorted(resume_skills & job_skills)
    missing_skills = sorted(job_skills - resume_skills)
    skill_match = (len(matched_skills) / max(1, len(job_skills))) * 100 if job_skills else 0.0

    project_blob = " ".join(
        f"{project.get('name', '')} {project.get('description', '')}"
        for project in profile["projects"]
    )
    project_skills = set(extract_skills(project_blob))
    project_relevance = (len(project_skills & job_skills) / max(1, len(job_skills))) * 100 if job_skills else 0.0
    if profile["projects"] and not job_skills:
        project_relevance = 55.0

    education_match = 100.0 if profile["education_level"] != "Not specified" else 40.0

    required_years = _job_experience_years(job_text)
    if required_years is None:
        experience_match = 85.0 if profile["experience_years"] < 2 else 75.0
    elif profile["experience_years"] >= required_years:
        experience_match = 100.0
    else:
        experience_match = _clamp(100 - ((required_years - profile["experience_years"]) * 25), 0, 100)

    location_match = _location_score(str(job.get("location", "")), preferred_location)
    overall = round(_clamp(
        (skill_match * 0.40)
        + (project_relevance * 0.20)
        + (education_match * 0.10)
        + (experience_match * 0.20)
        + (location_match * 0.10)
    ), 1)

    inferred_role = profile["target_roles"][0] if profile["target_roles"] else ""
    title_role_match = inferred_role and inferred_role.lower().replace("developer", "").replace("engineer", "").strip() in str(job.get("title", "")).lower()
    if overall < 62 or (not matched_skills and not title_role_match):
        return None

    relevant_projects = [
        project.get("name", "")
        for project in profile["projects"]
        if set(extract_skills(f"{project.get('name', '')} {project.get('description', '')}")) & set(matched_skills)
    ][:3]
    why = (
        f"Recommended because your {', '.join(relevant_projects[:1]) or 'resume'} demonstrates "
        f"{', '.join(matched_skills[:4]) or 'role-aligned'} experience that fits this {job.get('title', 'role')} listing."
    )
    return {
        **job,
        "candidate_profile": profile,
        "match": overall,
        "score": overall,
        "match_percentage": overall,
        "matched_skills": matched_skills[:8],
        "missing_skills": missing_skills[:6],
        "relevant_projects": relevant_projects,
        "experience_required": f"{required_years}+ years" if required_years is not None else "Not specified",
        "match_breakdown": {
            "skill_match": round(skill_match, 1),
            "project_relevance": round(project_relevance, 1),
            "education_match": round(education_match, 1),
            "experience_match": round(experience_match, 1),
            "location_match": round(location_match, 1),
        },
        "why_recommended": why,
        "career_growth_potential": "Good growth fit" if overall >= 75 else "Possible fit if gaps are closed",
        "why_this_job": [
            why,
            f"Matched skills: {', '.join(matched_skills[:5]) or 'none detected'}.",
            f"Missing skills: {', '.join(missing_skills[:4]) or 'no major gaps detected'}.",
        ],
        "source": job.get("source") or "stored-job",
        "posted_date": job.get("posted_date") or job.get("postedAt") or job.get("posted_at") or "Not specified",
        "apply_link": job.get("apply_link") or job.get("apply_url") or job.get("url") or "",
    }


def build_job_profile(job_description: str, fallback_roles: Optional[List[str]] = None) -> Dict[str, Any]:
    job_skills = set(extract_skills(job_description))
    keywords = _extract_keywords(job_description)
    required_years = _extract_required_years(job_description)
    preferred_roles = []
    lowered = (job_description or "").lower()
    for role_name, role in JOB_MARKET_ROLES.items():
        if role_name.lower() in lowered or any(keyword in lowered for keyword in role.keywords):
            preferred_roles.append(role_name)
    roles = preferred_roles or (fallback_roles or [])
    role_requirements = []
    market_required: Set[str] = set()
    market_preferred: Set[str] = set()
    for role_name in roles[:3]:
        role = JOB_MARKET_ROLES.get(role_name)
        if not role:
            continue
        role_requirements.append(role_name)
        market_required.update(role.required_skills)
        market_preferred.update(role.preferred_skills)
    if job_skills:
        market_required.update(job_skills)
    return {
        "job_skills": sorted(job_skills),
        "keywords": keywords,
        "required_years": required_years,
        "target_roles": role_requirements,
        "market_required_skills": sorted(market_required),
        "market_preferred_skills": sorted(market_preferred),
    }


def _keyword_frequency(text: str, keywords: Set[str]) -> Dict[str, int]:
    text_lower = text.lower()
    frequency = {}
    for keyword in sorted(keywords):
        count = len(re.findall(rf"\b{re.escape(keyword.lower())}\b", text_lower))
        if count:
            frequency[keyword] = count
    return frequency


def _formatting_quality(text: str, profile: Dict[str, Any], ats_result: Dict[str, Any]) -> float:
    score = 100.0
    sections = profile["sections"]
    missing_core = sum(
        1
        for name in ("experience", "education", "skills")
        if not sections.get(name)
    )
    score -= missing_core * 9
    score -= 10 if profile["bullet_count"] < 4 else 0
    score -= 6 if profile["word_count"] < 250 else 0
    score -= 5 if profile["word_count"] > 1200 else 0
    for issue in ats_result.get("issues", []):
        severity = issue.get("severity", "low")
        score -= {"critical": 12, "high": 8, "medium": 4, "low": 2}.get(severity, 2)
    return round(_clamp(score), 1)


def _experience_relevance(profile: Dict[str, Any], job_profile: Dict[str, Any]) -> float:
    resume_years = profile["experience_years"]
    target_roles = job_profile["target_roles"] or profile["target_roles"]
    if target_roles:
        scores = []
        for role_name in target_roles[:3]:
            role = JOB_MARKET_ROLES.get(role_name)
            if not role:
                continue
            if resume_years == 0:
                scores.append(45.0)
                continue
            if role.min_experience <= resume_years <= role.max_experience:
                scores.append(92.0)
            elif resume_years < role.min_experience:
                gap = role.min_experience - resume_years
                scores.append(_clamp(88 - (gap * 14), 30, 88))
            else:
                over = resume_years - role.max_experience
                scores.append(_clamp(90 - (over * 6), 50, 90))
        if scores:
            return round(sum(scores) / len(scores), 1)
    required_years = job_profile.get("required_years")
    if required_years is not None:
        if resume_years >= required_years:
            return 90.0
        return round(_clamp(90 - ((required_years - resume_years) * 15), 25, 90), 1)
    return 68.0 if resume_years else 42.0


def _project_relevance(profile: Dict[str, Any], job_profile: Dict[str, Any]) -> float:
    projects = profile["projects"]
    if not projects:
        return 35.0
    combined_text = " ".join(
        [project.get("name", "") + " " + project.get("description", "") for project in projects]
    )
    market_skills = set(job_profile["market_required_skills"]) | set(job_profile["market_preferred_skills"])
    if not market_skills:
        return 60.0
    matched = len(set(extract_skills(combined_text)) & market_skills)
    density = matched / max(1, len(market_skills))
    return round(_clamp(45 + density * 55), 1)


def analyze_resume_against_job(resume_text: str, job_description: str = "", preferred_role: str = "") -> Dict[str, Any]:
    profile = extract_resume_profile(resume_text, preferred_role=preferred_role)
    role_seed = profile["target_roles"]
    job_profile = build_job_profile(job_description, fallback_roles=role_seed)
    ats_result = ATSChecker().check_resume(resume_text, job_description)

    resume_skills = set(profile["skills"])
    target_required = set(job_profile["market_required_skills"])
    target_preferred = set(job_profile["market_preferred_skills"])
    matched_required = resume_skills & target_required
    matched_preferred = resume_skills & target_preferred
    missing_required = sorted(target_required - resume_skills)
    missing_preferred = sorted(target_preferred - resume_skills)

    similarity = semantic_similarity(resume_text, job_description) if job_description.strip() else 0.0
    keyword_frequency = _keyword_frequency(resume_text, set(job_profile["keywords"]) | target_required)
    low_frequency_keywords = sorted(
        [kw for kw in keyword_frequency if keyword_frequency[kw] == 1]
    )[:8]

    skill_match_score = (
        (len(matched_required) / max(1, len(target_required))) * 80
        + (len(matched_preferred) / max(1, len(target_preferred))) * 20
        if (target_required or target_preferred)
        else 58.0 + (min(len(resume_skills), 16) * 2.0)
    )
    keyword_score = (
        (sum(1 for keyword in job_profile["keywords"] if keyword in resume_text.lower()) / max(1, len(job_profile["keywords"]))) * 100
        if job_profile["keywords"]
        else (len(resume_skills) / max(1, len(resume_skills) + len(missing_required))) * 100 if resume_skills else 40.0
    )
    experience_score = _experience_relevance(profile, job_profile)
    formatting_score = _formatting_quality(resume_text, profile, ats_result)
    project_score = _project_relevance(profile, job_profile)
    semantic_score = similarity * 100

    final_score = round(
        _clamp(
            (skill_match_score * 0.35)
            + (experience_score * 0.2)
            + (keyword_score * 0.18)
            + (formatting_score * 0.15)
            + (project_score * 0.07)
            + (semantic_score * 0.05)
        ),
        1,
    )

    gap_counter = Counter()
    for role_name in job_profile["target_roles"] or profile["target_roles"]:
        role = JOB_MARKET_ROLES.get(role_name)
        if not role:
            continue
        for skill in sorted((role.required_skills | role.preferred_skills) - resume_skills):
            gap_counter[skill] += 1

    skill_gap = []
    for skill, frequency in gap_counter.most_common(10):
        skill_gap.append(
            {
                "skill": skill,
                "priority": "critical" if skill in missing_required[:5] else "high" if frequency > 1 else "medium",
                "market_demand_roles": frequency,
                "action": f"Add {skill} through a real project, certification, or measurable work bullet before using it as a keyword.",
            }
        )

    improvement_suggestions = []
    if missing_required:
        improvement_suggestions.append(
            {
                "priority": "High",
                "action": f"Close the biggest hard-skill gaps first: {', '.join(missing_required[:4])}.",
                "impact": "+8 to +15 pts",
            }
        )
    if experience_score < 65:
        target = ", ".join((job_profile["target_roles"] or profile["target_roles"])[:2]) or "the target role"
        improvement_suggestions.append(
            {
                "priority": "High",
                "action": f"Reframe experience toward {target} by highlighting relevant ownership, scope, and shipped outcomes.",
                "impact": "+6 to +10 pts",
            }
        )
    if formatting_score < 75:
        improvement_suggestions.append(
            {
                "priority": "Medium",
                "action": "Use ATS-safe headings, single-column formatting, and more bullet-led experience entries.",
                "impact": "+4 to +8 pts",
            }
        )
    if profile["projects"] and project_score < 60:
        improvement_suggestions.append(
            {
                "priority": "Medium",
                "action": "Rename projects with clearer business context and mention the stack, outcome, and domain relevance in each project bullet.",
                "impact": "+4 to +7 pts",
            }
        )
    if len(improvement_suggestions) < 4:
        improvement_suggestions.append(
            {
                "priority": "Medium",
                "action": "Increase keyword repetition naturally by using important JD terms in summary, skills, and the most relevant 3 experience bullets.",
                "impact": "+3 to +6 pts",
            }
        )

    keyword_suggestions = []
    for keyword in job_profile["keywords"][:12]:
        current_freq = keyword_frequency.get(keyword, 0)
        if current_freq == 0:
            keyword_suggestions.append({"keyword": keyword, "status": "missing", "suggested_usage": "Add if it truthfully matches your work."})
        elif current_freq == 1:
            keyword_suggestions.append({"keyword": keyword, "status": "low-frequency", "suggested_usage": "Mention once more in a stronger bullet or skills section."})

    summary = []
    if job_profile["target_roles"]:
        summary.append(f"Benchmarking against {', '.join(job_profile['target_roles'][:2])}.")
    if missing_required:
        summary.append(f"Biggest ATS blocker: missing skills like {', '.join(missing_required[:3])}.")
    if profile["projects"] and project_score >= 70:
        summary.append("Projects add relevant proof, which is helping the score.")
    if formatting_score < 75:
        summary.append("Formatting and section structure are also pulling the score down.")

    return {
        "profile": profile,
        "job_profile": job_profile,
        "ats_score": final_score,
        "match_rate": round(len(matched_required) / max(1, len(target_required)), 3) if target_required else 0.0,
        "missing_skills": missing_required[:12],
        "skill_gap_analysis": skill_gap,
        "keyword_suggestions": keyword_suggestions[:12],
        "improvement_suggestions": improvement_suggestions[:6],
        "low_frequency_keywords": low_frequency_keywords,
        "matched_skills": sorted(matched_required | matched_preferred),
        "scores": {
            "skill_match": round(_clamp(skill_match_score), 1),
            "experience_relevance": round(_clamp(experience_score), 1),
            "keyword_optimization": round(_clamp(keyword_score), 1),
            "formatting_quality": round(_clamp(formatting_score), 1),
            "project_relevance": round(_clamp(project_score), 1),
            "semantic_alignment": round(_clamp(semantic_score), 1),
            "final": final_score,
        },
        "ats_checker": ats_result,
        "summary": " ".join(summary) if summary else "Analysis complete.",
    }


def _experience_alignment(role_name: str, experience_years: int) -> float:
    role = JOB_MARKET_ROLES.get(role_name)
    if not role:
        return 0.0
    if role.min_experience <= experience_years <= role.max_experience:
        return 100.0
    if experience_years < role.min_experience:
        return _clamp(100 - ((role.min_experience - experience_years) * 18), 25, 100)
    return _clamp(100 - ((experience_years - role.max_experience) * 10), 45, 100)


def generate_market_job_matches(
    resume_text: str,
    preferred_role: str = "",
    preferred_location: str = "",
    limit: int = 10,
) -> Dict[str, Any]:
    profile = extract_resume_profile(resume_text, preferred_role=preferred_role)
    return {
        "profile": profile,
        "results": [],
        "inferred_role": profile["target_roles"][0] if profile["target_roles"] else "",
        "provider_status": "No relevant jobs found",
    }


def summarize_profile_for_chat(resume_text: str = "", job_description: str = "") -> str:
    snippets = []
    if resume_text:
        profile = extract_resume_profile(resume_text)
        if profile["target_roles"]:
            snippets.append(f"Target role signals: {', '.join(profile['target_roles'][:3])}")
        if profile["skills"]:
            snippets.append(f"Skills: {', '.join(profile['skills'][:10])}")
        if profile["experience_years"]:
            snippets.append(f"Experience: {profile['experience_years']} years")
        if profile["experience_entries"]:
            titles = [entry.get("title", "") for entry in profile["experience_entries"][:3] if entry.get("title")]
            if titles:
                snippets.append(f"Experience entries: {', '.join(titles)}")
        if profile["projects"]:
            project_names = [project.get("name", "") for project in profile["projects"][:4] if project.get("name")]
            snippets.append(f"Projects: {', '.join(project_names) if project_names else len(profile['projects'])}")
        if profile["certifications"]:
            snippets.append(f"Certifications: {', '.join(profile['certifications'][:4])}")
        if profile["education_entries"]:
            snippets.append(f"Education: {', '.join(profile['education_entries'][:2])}")
    if job_description:
        job_profile = build_job_profile(job_description)
        if job_profile["target_roles"]:
            snippets.append(f"JD roles: {', '.join(job_profile['target_roles'][:2])}")
        if job_profile["job_skills"]:
            snippets.append(f"JD skills: {', '.join(job_profile['job_skills'][:10])}")
        if job_profile["keywords"]:
            snippets.append(f"JD keywords: {', '.join(job_profile['keywords'][:8])}")
    return " | ".join(snippets) if snippets else "No structured context available."
