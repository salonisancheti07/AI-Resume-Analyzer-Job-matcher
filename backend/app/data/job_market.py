"""
Job Market Database - Real job market requirements for dynamic matching
Contains role-specific skills, experience levels, and salary ranges
"""

from typing import Dict, List, Set, Optional
from dataclasses import dataclass


@dataclass
class JobRole:
    """Job role definition with required skills"""
    title: str
    category: str
    required_skills: Set[str]
    preferred_skills: Set[str]
    min_experience: int
    max_experience: int
    salary_range: tuple  # (min_lpa, max_lpa)
    keywords: List[str]


# Comprehensive job market data
JOB_MARKET_ROLES: Dict[str, JobRole] = {
    # Software Development
    "Software Engineer": JobRole(
        title="Software Engineer",
        category="Engineering",
        required_skills={"python", "java", "javascript", "sql", "git", "data structures"},
        preferred_skills={"docker", "kubernetes", "aws", "react", "node", "agile"},
        min_experience=1,
        max_experience=5,
        salary_range=(4, 15),
        keywords=["software", "engineer", "developer", "programming", "coding"],
    ),
    "Senior Software Engineer": JobRole(
        title="Senior Software Engineer",
        category="Engineering",
        required_skills={"python", "java", "javascript", "sql", "system design", "git"},
        preferred_skills={"aws", "docker", "kubernetes", "microservices", "rest api", "ci/cd"},
        min_experience=4,
        max_experience=8,
        salary_range=(12, 25),
        keywords=["senior", "software", "engineer", "lead", "technical"],
    ),
    "Full Stack Developer": JobRole(
        title="Full Stack Developer",
        category="Engineering",
        required_skills={"javascript", "react", "node", "sql", "html", "css", "git"},
        preferred_skills={"typescript", "nextjs", "docker", "aws", "mongodb", "postgresql"},
        min_experience=2,
        max_experience=6,
        salary_range=(6, 18),
        keywords=["full stack", "frontend", "backend", "web", "developer"],
    ),
    "Frontend Developer": JobRole(
        title="Frontend Developer",
        category="Engineering",
        required_skills={"javascript", "react", "html", "css", "git"},
        preferred_skills={"typescript", "redux", "nextjs", "webpack", "tailwind", "material-ui"},
        min_experience=1,
        max_experience=4,
        salary_range=(4, 12),
        keywords=["frontend", "ui", "react", "javascript", "web developer"],
    ),
    "Backend Developer": JobRole(
        title="Backend Developer",
        category="Engineering",
        required_skills={"python", "java", "sql", "api", "git"},
        preferred_skills={"django", "fastapi", "spring", "node", "docker", "postgresql", "redis"},
        min_experience=2,
        max_experience=5,
        salary_range=(5, 15),
        keywords=["backend", "server", "api", "developer", "python", "java"],
    ),
    
    # Data & ML
    "Data Scientist": JobRole(
        title="Data Scientist",
        category="Data Science",
        required_skills={"python", "sql", "machine learning", "statistics", "pandas"},
        preferred_skills={"tensorflow", "pytorch", "scikit-learn", "tableau", "deep learning", "nlp"},
        min_experience=2,
        max_experience=6,
        salary_range=(8, 20),
        keywords=["data scientist", "machine learning", "ml", "analytics", "statistics"],
    ),
    "ML Engineer": JobRole(
        title="ML Engineer",
        category="Data Science",
        required_skills={"python", "tensorflow", "pytorch", "sql", "docker"},
        preferred_skills={"kubernetes", "aws", "mlops", "scikit-learn", "deep learning", "nlp", "llm"},
        min_experience=3,
        max_experience=7,
        salary_range=(12, 28),
        keywords=["ml engineer", "machine learning", "ai", "deep learning", "model"],
    ),
    "Data Analyst": JobRole(
        title="Data Analyst",
        category="Analytics",
        required_skills={"python", "sql", "excel", "tableau"},
        preferred_skills={"power bi", "pandas", "statistics", "looker", "visualization"},
        min_experience=1,
        max_experience=4,
        salary_range=(4, 10),
        keywords=["data analyst", "analytics", "bi", "reporting", "dashboard"],
    ),
    "Data Engineer": JobRole(
        title="Data Engineer",
        category="Data Engineering",
        required_skills={"python", "sql", "spark", "etl"},
        preferred_skills={"aws", "airflow", "kafka", "hadoop", "databricks", "postgresql"},
        min_experience=3,
        max_experience=7,
        salary_range=(10, 22),
        keywords=["data engineer", "etl", "pipeline", "spark", "big data"],
    ),
    
    # Cloud & DevOps
    "DevOps Engineer": JobRole(
        title="DevOps Engineer",
        category="Infrastructure",
        required_skills={"docker", "kubernetes", "jenkins", "linux", "git"},
        preferred_skills={"aws", "terraform", "ansible", "azure", "ci/cd", "monitoring"},
        min_experience=3,
        max_experience=7,
        salary_range=(10, 24),
        keywords=["devops", "sre", "infrastructure", "cloud", "automation"],
    ),
    "Cloud Engineer": JobRole(
        title="Cloud Engineer",
        category="Infrastructure",
        required_skills={"aws", "docker", "linux", "networking"},
        preferred_skills={"kubernetes", "terraform", "azure", "gcp", "python"},
        min_experience=2,
        max_experience=6,
        salary_range=(8, 20),
        keywords=["cloud", "aws", "azure", "infrastructure", "architecture"],
    ),
    "Site Reliability Engineer": JobRole(
        title="SRE",
        category="Infrastructure",
        required_skills={"linux", "python", "docker", "monitoring"},
        preferred_skills={"kubernetes", "aws", "grafana", "prometheus", "chaos engineering"},
        min_experience=3,
        max_experience=7,
        salary_range=(12, 26),
        keywords=["sre", "reliability", "monitoring", "incident", "on-call"],
    ),
    
    # Product & Design
    "Product Manager": JobRole(
        title="Product Manager",
        category="Product",
        required_skills={"product management", "analytics", "communication", "roadmap"},
        preferred_skills={"agile", "sql", "figma", "user research", "jira"},
        min_experience=3,
        max_experience=8,
        salary_range=(12, 30),
        keywords=["product manager", "pm", "product", "roadmap", "strategy"],
    ),
    "UI/UX Designer": JobRole(
        title="UI/UX Designer",
        category="Design",
        required_skills={"figma", "ui design", "ux design", "prototyping"},
        preferred_skills={"adobe xd", "sketch", "user research", "design systems", "html css"},
        min_experience=1,
        max_experience=5,
        salary_range=(4, 14),
        keywords=["ui", "ux", "designer", "figma", "design", "prototype"],
    ),
    
    # Testing
    "QA Engineer": JobRole(
        title="QA Engineer",
        category="Quality",
        required_skills={"testing", "selenium", "manual testing"},
        preferred_skills={"automation", "python", "cypress", "jest", "api testing"},
        min_experience=1,
        max_experience=5,
        salary_range=(4, 12),
        keywords=["qa", "testing", "quality", "automation", "tester"],
    ),
    
    # Management
    "Engineering Manager": JobRole(
        title="Engineering Manager",
        category="Management",
        required_skills={"leadership", "agile", "project management", "technical"},
        preferred_skills={"scrum", "mentoring", "performance management", "strategy"},
        min_experience=6,
        max_experience=12,
        salary_range=(20, 40),
        keywords=["engineering manager", "tech lead", "manager", "director", "lead"],
    ),
}


# Role categories for grouping
ROLE_CATEGORIES = {
    "Engineering": ["Software Engineer", "Senior Software Engineer", "Full Stack Developer", "Frontend Developer", "Backend Developer"],
    "Data Science": ["Data Scientist", "ML Engineer", "Data Analyst", "Data Engineer"],
    "Infrastructure": ["DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer"],
    "Product": ["Product Manager"],
    "Design": ["UI/UX Designer"],
    "Quality": ["QA Engineer"],
    "Management": ["Engineering Manager"],
}


# Skill to roles mapping (inverse index)
SKILL_TO_ROLES: Dict[str, List[str]] = {}

for role_name, role in JOB_MARKET_ROLES.items():
    for skill in role.required_skills | role.preferred_skills:
        if skill not in SKILL_TO_ROLES:
            SKILL_TO_ROLES[skill] = []
        if role_name not in SKILL_TO_ROLES[skill]:
            SKILL_TO_ROLES[skill].append(role_name)


def get_matching_roles(user_skills: Set[str], experience_years: int = 0) -> List[Dict]:
    """
    Get matching roles based on user skills and experience
    
    Returns list of roles sorted by match score
    """
    matches = []
    
    for role_name, role in JOB_MARKET_ROLES.items():
        # Skip if experience doesn't match
        if experience_years > 0:
            if experience_years < role.min_experience or experience_years > role.max_experience:
                continue
        
        # Calculate skill match
        all_role_skills = role.required_skills | role.preferred_skills
        matched = user_skills & all_role_skills
        required_matched = user_skills & role.required_skills
        
        # Calculate scores
        required_match_pct = len(required_matched) / max(1, len(role.required_skills))
        preferred_match_pct = len(matched - role.required_skills) / max(1, len(role.preferred_skills))
        overall_match = (required_match_pct * 0.7) + (preferred_match_pct * 0.3)
        
        if overall_match > 0.1:  # Only include if there's some match
            matches.append({
                "role": role_name,
                "category": role.category,
                "match_score": round(overall_match * 100, 1),
                "required_match": round(required_match_pct * 100, 1),
                "preferred_match": round(preferred_match_pct * 100, 1),
                "matched_skills": sorted(matched),
                "missing_required": sorted(role.required_skills - user_skills),
                "missing_preferred": sorted(role.preferred_skills - user_skills - (role.required_skills - user_skills)),
                "experience_range": f"{role.min_experience}-{role.max_experience} years",
                "salary_range": f"₹{role.salary_range[0]}L-₹{role.salary_range[1]}L",
            })
    
    # Sort by match score
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return matches


def get_role_skills(role_name: str) -> Dict:
    """Get required and preferred skills for a role"""
    role = JOB_MARKET_ROLES.get(role_name)
    if not role:
        return {}
    
    return {
        "required": list(role.required_skills),
        "preferred": list(role.preferred_skills),
        "category": role.category,
        "experience_range": f"{role.min_experience}-{role.max_experience}",
        "salary_range": role.salary_range,
    }


def suggest_skills_for_role(role_name: str, current_skills: Set[str]) -> List[Dict]:
    """Suggest skills to learn for a specific role"""
    role = JOB_MARKET_ROLES.get(role_name)
    if not role:
        return []
    
    all_needed = (role.required_skills | role.preferred_skills) - current_skills
    
    suggestions = []
    for skill in all_needed:
        is_required = skill in role.required_skills
        suggestions.append({
            "skill": skill,
            "type": "required" if is_required else "preferred",
            "priority": "high" if is_required else "medium",
        })
    
    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: priority_order.get(x["priority"], 2))
    
    return suggestions


def get_salary_benchmark(role_name: str, experience: int) -> Dict:
    """Get salary benchmark for a role with given experience"""
    role = JOB_MARKET_ROLES.get(role_name)
    if not role:
        return {}
    
    # Interpolate based on experience
    exp_range = role.max_experience - role.min_experience
    if exp_range > 0:
        exp_factor = (experience - role.min_experience) / exp_range
        exp_factor = max(0, min(1, exp_factor))
    else:
        exp_factor = 0.5
    
    min_sal = role.salary_range[0]
    max_sal = role.salary_range[1]
    estimated = min_sal + (max_sal - min_sal) * exp_factor
    
    return {
        "role": role_name,
        "experience": experience,
        "estimated_salary": f"₹{round(estimated)}L",
        "range": f"₹{min_sal}L-₹{max_sal}L",
        "category": role.category,
    }