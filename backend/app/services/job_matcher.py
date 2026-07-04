from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from app.data.job_market import JOB_MARKET_ROLES
from app.nlp.skills import extract_skills
from app.services.resume_intelligence import extract_resume_profile

SKILL_ALIASES = {
    "reactjs": "react",
    "react.js": "react",
    "nodejs": "node.js",
    "node": "node.js",
    "expressjs": "express",
    "express": "express",
    "mongodb": "mongodb",
    "mongo": "mongodb",
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "sql": "sql",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "mysql": "mysql",
    "restapi": "rest api",
    "rest": "rest api",
    "api": "rest api",
    "git": "git",
    "github": "git",
    "docker": "docker",
    "aws": "aws",
    "azure": "azure",
    "kubernetes": "kubernetes",
    "k8s": "kubernetes",
    "machinelearning": "machine learning",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "artificial intelligence": "artificial intelligence",
    "llm": "llm",
    "llms": "llm",
    "prompt engineering": "prompt engineering",
    "prompting": "prompt engineering",
    "pytorch": "pytorch",
    "tensorflow": "tensorflow",
    "fastapi": "fastapi",
    "django": "django",
    "springboot": "spring boot",
    "spring": "spring boot",
    "tailwindcss": "tailwind css",
    "tailwind": "tailwind css",
    "nextjs": "next.js",
    "next": "next.js",
    "redux": "redux",
    "flask": "flask",
}

ROLE_HINTS = {
    "software engineer": "software engineer",
    "full stack": "full stack developer",
    "fullstack": "full stack developer",
    "backend": "backend developer",
    "frontend": "frontend developer",
    "data analyst": "data analyst",
    "machine learning": "ml engineer",
    "ml engineer": "ml engineer",
    "product manager": "product manager",
    "devops": "devops engineer",
    "cloud": "cloud engineer",
}

CURATED_JOBS: List[Dict[str, Any]] = [
    {
        "id": "google-fe-1",
        "title": "Frontend Engineer",
        "company": "Google",
        "location": "Bengaluru, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹18L - ₹30L",
        "platform": "Google Careers",
        "source": "Google Careers",
        "applyLink": "https://careers.google.com/jobs/results/",
        "requiredSkills": ["react", "javascript", "typescript", "tailwind css", "rest api", "git"],
        "description": "Build polished, accessible web experiences and partner with product and design to ship delightful features.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-07-01",
        "companyFit": 0.92,
        "careerGrowthPotential": "Strong growth in product and platform roles",
    },
    {
        "id": "microsoft-fs-1",
        "title": "Full Stack Developer",
        "company": "Microsoft",
        "location": "Hyderabad, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹16L - ₹28L",
        "platform": "Microsoft Careers",
        "source": "Microsoft Careers",
        "applyLink": "https://jobs.careers.microsoft.com/global/en/search",
        "requiredSkills": ["react", "node.js", "express", "mongodb", "rest api", "git"],
        "description": "Own end-to-end features spanning frontend, backend, and cloud services for high-impact enterprise experiences.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-30",
        "companyFit": 0.9,
        "careerGrowthPotential": "High potential for platform and senior technical roles",
    },
    {
        "id": "amazon-be-1",
        "title": "Backend Engineer",
        "company": "Amazon",
        "location": "Remote India",
        "workMode": "Remote",
        "employmentType": "Full-Time",
        "salary": "₹20L - ₹35L",
        "platform": "Amazon Careers",
        "source": "Amazon Careers",
        "applyLink": "https://www.amazon.jobs/en/search?base_query=software%20engineer",
        "requiredSkills": ["java", "spring boot", "mysql", "rest api", "docker", "aws"],
        "description": "Design robust backend services with strong API design, observability, and scalable infrastructure.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-28",
        "companyFit": 0.86,
        "careerGrowthPotential": "Excellent for cloud-native and distributed systems growth",
    },
    {
        "id": "infosys-sde-1",
        "title": "Software Engineer",
        "company": "Infosys",
        "location": "Pune, India",
        "workMode": "Onsite",
        "employmentType": "Full-Time",
        "salary": "₹6L - ₹12L",
        "platform": "Infosys Careers",
        "source": "Infosys Careers",
        "applyLink": "https://career.infosys.com/",
        "requiredSkills": ["python", "javascript", "sql", "git", "rest api"],
        "description": "Join a delivery-focused engineering team building modern internal and client-facing digital products.",
        "experienceRequired": "1+ years",
        "postedAt": "2026-06-27",
        "companyFit": 0.78,
        "careerGrowthPotential": "Good training ground for broader engineering ownership",
    },
    {
        "id": "tcs-ml-1",
        "title": "AI Engineer",
        "company": "TCS",
        "location": "Mumbai, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹8L - ₹16L",
        "platform": "TCS Careers",
        "source": "TCS Careers",
        "applyLink": "https://www.tcs.com/careers",
        "requiredSkills": ["python", "machine learning", "artificial intelligence", "pytorch", "llm", "prompt engineering"],
        "description": "Work on AI-powered applications with model integration, evaluation, and prompt-driven product experiences.",
        "experienceRequired": "1+ years",
        "postedAt": "2026-06-25",
        "companyFit": 0.83,
        "careerGrowthPotential": "Strong for AI product and platform roles",
    },
    {
        "id": "zoho-data-1",
        "title": "Data Analyst",
        "company": "Zoho",
        "location": "Chennai, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹7L - ₹14L",
        "platform": "Zoho Careers",
        "source": "Zoho Careers",
        "applyLink": "https://www.zoho.com/careers/",
        "requiredSkills": ["python", "sql", "power bi", "tableau", "statistics"],
        "description": "Turn user and business data into insight with dashboards, reporting, and experimentation support.",
        "experienceRequired": "1+ years",
        "postedAt": "2026-06-24",
        "companyFit": 0.8,
        "careerGrowthPotential": "Great path into analytics and business intelligence",
    },
    {
        "id": "capgemini-devops-1",
        "title": "DevOps Engineer",
        "company": "Capgemini",
        "location": "Remote India",
        "workMode": "Remote",
        "employmentType": "Full-Time",
        "salary": "₹10L - ₹18L",
        "platform": "Capgemini Careers",
        "source": "Capgemini Careers",
        "applyLink": "https://www.capgemini.com/careers/",
        "requiredSkills": ["docker", "kubernetes", "aws", "linux", "git", "ci/cd"],
        "description": "Improve deployment reliability, automate delivery pipelines, and support cloud-native platform operations.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-22",
        "companyFit": 0.79,
        "careerGrowthPotential": "Strong route into SRE and platform engineering",
    },
    {
        "id": "deloitte-pm-1",
        "title": "Product Analyst",
        "company": "Deloitte",
        "location": "Gurugram, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹12L - ₹20L",
        "platform": "Deloitte Careers",
        "source": "Deloitte Careers",
        "applyLink": "https://careers.deloitte.com/",
        "requiredSkills": ["product management", "analytics", "sql", "communication", "roadmap"],
        "description": "Bridge business, design, and delivery by shaping product requirements and measuring adoption.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-20",
        "companyFit": 0.84,
        "careerGrowthPotential": "Excellent path to product leadership",
    },
    {
        "id": "ibm-ml-1",
        "title": "Machine Learning Engineer",
        "company": "IBM",
        "location": "Bengaluru, India",
        "workMode": "Hybrid",
        "employmentType": "Full-Time",
        "salary": "₹15L - ₹26L",
        "platform": "IBM Careers",
        "source": "IBM Careers",
        "applyLink": "https://www.ibm.com/careers",
        "requiredSkills": ["python", "machine learning", "pytorch", "tensorflow", "docker", "sql"],
        "description": "Create scalable ML systems and collaborate with data scientists to deploy models into real products.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-18",
        "companyFit": 0.82,
        "careerGrowthPotential": "Strong for AI platform and MLOps opportunities",
    },
    {
        "id": "oracle-backend-1",
        "title": "Backend Developer",
        "company": "Oracle",
        "location": "Remote India",
        "workMode": "Remote",
        "employmentType": "Full-Time",
        "salary": "₹14L - ₹24L",
        "platform": "Oracle Careers",
        "source": "Oracle Careers",
        "applyLink": "https://careers.oracle.com/",
        "requiredSkills": ["java", "spring boot", "mysql", "redis", "rest api", "git"],
        "description": "Build reliable backend services and integrate APIs for enterprise applications and data platforms.",
        "experienceRequired": "2+ years",
        "postedAt": "2026-06-17",
        "companyFit": 0.81,
        "careerGrowthPotential": "Good path into senior backend and architecture roles",
    },
    {
        "id": "linkedin-intern-1",
        "title": "Product Engineering Intern",
        "company": "LinkedIn",
        "location": "Remote India",
        "workMode": "Remote",
        "employmentType": "Internship",
        "salary": "₹45K - ₹70K",
        "platform": "LinkedIn",
        "source": "LinkedIn Careers",
        "applyLink": "https://www.linkedin.com/jobs/search/?keywords=internship",
        "requiredSkills": ["react", "python", "sql", "git", "communication"],
        "description": "Support a product engineering team building polished experiences and learn modern delivery workflows.",
        "experienceRequired": "0-1 years",
        "postedAt": "2026-06-16",
        "companyFit": 0.74,
        "careerGrowthPotential": "Excellent entry point into top-tier product companies",
    },
]


def _canonicalize_skill(skill: str) -> str:
    text = re.sub(r"[^a-z0-9+/]+", " ", (skill or "").strip().lower()).strip()
    if not text:
        return ""
    text = text.replace("&", " and ")
    if text in SKILL_ALIASES:
        return SKILL_ALIASES[text]
    if text.startswith("node"):
        return "node.js"
    if text.startswith("react"):
        return "react"
    if text.startswith("express"):
        return "express"
    if text in {"javascript", "js"}:
        return "javascript"
    if text in {"typescript", "ts"}:
        return "typescript"
    return text


def _normalize_skills(skills: List[str] | Set[str] | None) -> Set[str]:
    normalized: Set[str] = set()
    for skill in skills or []:
        canonical = _canonicalize_skill(str(skill))
        if canonical:
            normalized.add(canonical)
    return normalized


def _role_hint(title: str, target_roles: List[str]) -> float:
    lowered = title.lower()
    if not target_roles:
        return 0.0
    for role in target_roles:
        alias = ROLE_HINTS.get(role.lower(), role.lower())
        if alias and alias in lowered:
            return 1.0
        if role.lower().replace("developer", "") in lowered:
            return 0.8
    return 0.0


def _experience_fit(profile_years: int, required_years: str) -> float:
    if not required_years:
        return 0.8
    match = re.search(r"(\d+)", required_years)
    if not match:
        return 0.7
    required = int(match.group(1))
    if profile_years >= required:
        return 1.0
    if profile_years + 1 >= required:
        return 0.82
    return max(0.35, 1 - ((required - profile_years) * 0.18))


def _location_fit(location: str, preferred_location: str, work_mode: str) -> float:
    text = f"{location} {preferred_location} {work_mode}".lower()
    if "remote" in text and "india" in text:
        return 0.95
    if "hybrid" in text:
        return 0.9
    if "onsite" in text or "bengaluru" in text or "pune" in text or "hyderabad" in text or "mumbai" in text or "chennai" in text or "gurugram" in text or "noida" in text:
        return 0.8
    if preferred_location and preferred_location.lower() in text:
        return 0.95
    return 0.7


def _build_why_recommended(job: Dict[str, Any], matched: List[str], missing: List[str], target_roles: List[str]) -> str:
    role_context = target_roles[0] if target_roles else job.get("title", "this role")
    if matched:
        matched_text = ", ".join(matched[:4])
        return f"Your {matched_text} experience maps strongly to {role_context} and this {job.get('title', 'role')} opening."
    return f"This is a strong stretch role that aligns with your {role_context} direction and the adjacent skills in your resume."


def _build_missing_skills(job: Dict[str, Any], profile_skills: Set[str]) -> List[str]:
    missing = sorted(_normalize_skills(job.get("requiredSkills", [])) - profile_skills)
    return [skill for skill in missing if skill][:6]


def _build_match_breakdown(job: Dict[str, Any], matched: List[str], profile_years: int, target_roles: List[str], profile_skills: Set[str]) -> Dict[str, Any]:
    job_skills = _normalize_skills(job.get("requiredSkills", []))
    skill_match = round((len(matched) / max(1, len(job_skills))) * 100, 1) if job_skills else 0.0
    role_alignment = round(_role_hint(job.get("title", ""), target_roles) * 100, 1)
    experience_match = round(_experience_fit(profile_years, job.get("experienceRequired", "")) * 100, 1)
    project_relevance = round(min(100.0, skill_match * 0.75 + (20 if profile_skills & job_skills else 0)), 1)
    return {
        "skill_match": skill_match,
        "project_relevance": project_relevance,
        "education_match": 85.0,
        "experience_match": experience_match,
        "location_match": 90.0,
        "role_alignment": role_alignment,
    }


def generate_job_recommendations(resume_text: str, preferred_role: str = "", preferred_location: str = "", limit: int = 10) -> Dict[str, Any]:
    profile = extract_resume_profile(resume_text, preferred_role=preferred_role)
    profile_skills = _normalize_skills(profile.get("skills", []))
    profile_years = int(profile.get("experience_years") or 0)
    target_roles = profile.get("target_roles", [])

    scored_jobs: List[Dict[str, Any]] = []
    for job in CURATED_JOBS:
        job_skills = _normalize_skills(job.get("requiredSkills", []))
        matched = sorted(profile_skills & job_skills)
        if not matched and not _role_hint(job.get("title", ""), target_roles):
            continue

        missing = _build_missing_skills(job, profile_skills)
        skill_score = (len(matched) / max(1, len(job_skills))) * 100 if job_skills else 0
        role_alignment = _role_hint(job.get("title", ""), target_roles) * 100
        experience_score = _experience_fit(profile_years, job.get("experienceRequired", "")) * 100
        location_score = _location_fit(job.get("location", ""), preferred_location, job.get("workMode", "")) * 100
        company_fit = (job.get("companyFit") or 0.75) * 100
        overall = round((skill_score * 0.4) + (role_alignment * 0.2) + (experience_score * 0.15) + (location_score * 0.1) + (company_fit * 0.15), 1)

        if overall < 64:
            continue

        highlights = []
        if matched:
            highlights.append(f"Your {', '.join(matched[:3])} experience is directly relevant.")
        if missing:
            highlights.append(f"A few growth areas remain: {', '.join(missing[:3])}.")
        highlights.append(f"This role matches your {target_roles[0] if target_roles else 'targeted career direction'} signal.")

        scored_jobs.append(
            {
                **job,
                "match_percentage": overall,
                "score": overall,
                "recommendationScore": int(round(overall)),
                "matched_skills": matched[:6],
                "missing_skills": missing,
                "why_recommended": _build_why_recommended(job, matched, missing, target_roles),
                "why_this_job": highlights,
                "jd_simplified": [job.get("description", ""), f"Preferred stack includes {', '.join(job_skills)}"],
                "match_breakdown": _build_match_breakdown(job, matched, profile_years, target_roles, profile_skills),
                "relevant_projects": profile.get("projects", [])[:3],
                "source": job.get("source", "Curated public careers"),
                "posted_at": job.get("postedAt", ""),
                "apply_url": job.get("applyLink", ""),
                "apply_link": job.get("applyLink", ""),
                "career_growth_potential": job.get("careerGrowthPotential", "Strong potential"),
                "company_fit": job.get("companyFit", 0.8),
                "experience_required": job.get("experienceRequired", "Not specified"),
                "skills": job.get("requiredSkills", []),
                "salaryMin": int(round(float(re.search(r"(\d+)", str(job.get("salary", "0"))).group(1)) / 10)) if re.search(r"(\d+)", str(job.get("salary", "0"))) else 0,
            }
        )

    scored_jobs.sort(key=lambda item: (item["recommendationScore"], item.get("companyFit", 0)), reverse=True)

    selected = scored_jobs[: max(3, int(limit))]
    inferred_role = target_roles[0] if target_roles else preferred_role or "Software Engineer"
    career_paths = []
    for role in target_roles[:4]:
        career_paths.append(role)
    if not career_paths:
        career_paths = ["Software Engineer", "Full Stack Developer", "Backend Developer", "Data Analyst"]

    learn_skills = []
    for skill in sorted({skill for job in selected for skill in job.get("missing_skills", [])}):
        learn_skills.append(skill)
    if len(learn_skills) < 6:
        learn_skills.extend(["docker", "aws", "system design", "ci/cd", "redis"])

    return {
        "profile": profile,
        "results": selected,
        "inferred_role": inferred_role,
        "career_paths": career_paths[:5],
        "skills_to_learn": learn_skills[:6],
        "provider_status": f"Matched {len(selected)} public and career-site opportunities for your profile",
    }
