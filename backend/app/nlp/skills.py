import re
from typing import Dict, List, Set, Tuple

try:
    import spacy
except Exception:
    spacy = None

try:
    from sentence_transformers import SentenceTransformer, util
except Exception:
    SentenceTransformer = None
    util = None


def _load_nlp():
    if spacy is None:
        return None
    try:
        return spacy.load("en_core_web_sm")
    except Exception:
        return spacy.blank("en")


_nlp = _load_nlp()
try:
    _model = SentenceTransformer("all-MiniLM-L6-v2") if SentenceTransformer is not None else None
except Exception:
    _model = None

# Comprehensive skill taxonomy with categories
SKILL_TAXONOMY: Dict[str, Set[str]] = {
    # Programming Languages
    "languages": {
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "golang",
        "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab",
        "perl", "shell", "bash", "powershell", "sql", "html", "css", "scala",
    },
    # Frontend/UI
    "frontend": {
        "react", "reactjs", "vue", "vuejs", "angular", "nextjs", "next.js",
        "javascript", "typescript", "html", "css", "sass", "less", "tailwind",
        "bootstrap", "material-ui", "mui", "chakra", "redux", "zustand",
        "webpack", "vite", "rollup", "babel", "frontend", "ui", "ux",
    },
    # Backend/Server
    "backend": {
        "node", "nodejs", "express", "fastapi", "flask", "django", "spring",
        "rails", "laravel", "asp.net", ".net", "grpc", "graphql", "rest",
        "api", "microservices", "backend", "server",
    },
    # Cloud & DevOps
    "cloud_devops": {
        "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
        "terraform", "ansible", "jenkins", "ci/cd", "cicd", "devops", "cloud",
        "ec2", "s3", "lambda", "ecs", "eks", "azure devops", "github actions",
    },
    # Data & ML
    "data_ml": {
        "pandas", "numpy", "tensorflow", "pytorch", "keras", "scikit-learn",
        "sklearn", "ml", "machine learning", "deep learning", "nlp", "llm",
        "gpt", "chatgpt", "data science", "data analysis", "analytics",
        "tableau", "power bi", "looker", "spark", "hadoop", "hive",
        "etl", "data pipeline", "data engineering", "mlops", "mlops",
    },
    # Databases
    "databases": {
        "sql", "mysql", "postgresql", "postgres", "mongodb", "redis",
        "elasticsearch", "cassandra", "dynamodb", "firebase", "supabase",
        "nosql", "database", "db", "sqlite", "oracle", "mariadb",
    },
    # Tools & Platforms
    "tools": {
        "git", "github", "gitlab", "bitbucket", "jira", "confluence",
        "notion", "slack", "zoom", "postman", "insomnia", "docker",
        "linux", "unix", "windows", "macos", "ubuntu", "centos",
    },
    # Soft Skills
    "soft_skills": {
        "leadership", "communication", "teamwork", "problem-solving",
        "analytical", "critical thinking", "project management", "agile",
        "scrum", "kanban", "mentoring", "collaboration", "presentation",
    },
    # Certifications
    "certifications": {
        "aws certified", "azure certified", "gcp certified", "pmp", "scrum master",
        "cissp", "ceh", "comptia", "google cloud certified",
    },
}

# Flatten all skills for matching
ALL_SKILLS: Set[str] = set()
for category_skills in SKILL_TAXONOMY.values():
    ALL_SKILLS.update(category_skills)


def extract_skills(text: str) -> list[str]:
    """Extract skills from resume text with category mapping"""
    candidates: set[str] = set()

    # Extract from named entities when spaCy is available
    if _nlp is not None:
        doc = _nlp(text)
        for ent in getattr(doc, "ents", []):
            if ent.label_ in {"ORG", "PRODUCT", "LANGUAGE", "TECHNOLOGY"}:
                candidates.add(ent.text.lower())
    
    # Extract from text tokens (exact matches)
    text_lower = text.lower()
    for skill in ALL_SKILLS:
        if skill in text_lower:
            candidates.add(skill)
    
    # Use semantic similarity for fuzzy matching when the model is available
    if candidates and _model is not None and util is not None:
        canon_emb = _model.encode(list(ALL_SKILLS), convert_to_tensor=True)
        final: set[str] = set()
        for cand in candidates:
            cand_emb = _model.encode(cand, convert_to_tensor=True)
            scores = util.cos_sim(cand_emb, canon_emb)
            max_score = scores.max().item()
            if max_score > 0.50:
                # Get the best matching skill
                best_idx = scores.argmax().item()
                final.add(list(ALL_SKILLS)[best_idx])
            else:
                final.add(cand)
        return sorted(final)

    return sorted(candidates)


def extract_skills_with_categories(text: str) -> Dict[str, List[str]]:
    """Extract skills and categorize them"""
    skills = extract_skills(text)
    categorized: Dict[str, List[str]] = {cat: [] for cat in SKILL_TAXONOMY}
    categorized["other"] = []
    
    for skill in skills:
        found = False
        for category, category_skills in SKILL_TAXONOMY.items():
            if skill in category_skills:
                categorized[category].append(skill)
                found = True
                break
        if not found:
            categorized["other"].append(skill)
    
    # Remove empty categories
    return {k: v for k, v in categorized.items() if v}


def extract_experience_years(text: str) -> int:
    """Extract years of experience from resume"""
    patterns = [
        r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)",
        r"(\d+)\s*-\s*\d+\s*(?:years?|yrs?)",
        r"experience[:\s]*(\d+)\+?\s*(?:years?|yrs?)",
    ]
    
    max_years = 0
    for pattern in patterns:
        matches = re.findall(pattern, text.lower())
        for match in matches:
            years = int(match)
            if years > max_years:
                max_years = years
    
    # Also check for explicit year ranges
    year_range_pattern = r"(20\d{2})\s*[-–]\s*(?:present|current|20\d{2})"
    ranges = re.findall(year_range_pattern, text)
    if ranges:
        # Calculate span from earliest to latest
        years_list = [int(y) for y in ranges]
        span = max(years_list) - min(years_list) + 1
        if span > max_years:
            max_years = span
    
    return max_years


def extract_education_level(text: str) -> str:
    """Extract highest education level"""
    text_lower = text.lower()
    
    if "phd" in text_lower or "doctorate" in text_lower:
        return "PhD"
    elif "master" in text_lower or "m.s" in text_lower or "m.sc" in text_lower:
        return "Masters"
    elif "bachelor" in text_lower or "b.s" in text_lower or "b.sc" in text_lower or "b.tech" in text_lower:
        return "Bachelors"
    elif "diploma" in text_lower:
        return "Diploma"
    else:
        return "Not specified"


def extract_job_titles(text: str) -> List[str]:
    """Extract job titles from resume"""
    # Common job title patterns
    title_patterns = [
        r"(?:senior|lead|principal|staff|junior|intern|associate)?\s*(?:software|full.?stack|frontend|backend|fullstack|data|ml|machine learning|ai|product|project|program|technical)?\s*(?:engineer|developer|manager|analyst|scientist|designer|architect|lead|director|consultant|associate|specialist|intern)",
    ]
    
    titles = []
    for pattern in title_patterns:
        matches = re.findall(pattern, text.lower())
        titles.extend(matches)
    
    return list(set(titles))[:5]  # Limit to 5 titles


def extract_tools(text: str) -> List[str]:
    """Extract tools and technologies"""
    tools = {
        "jira", "confluence", "notion", "slack", "teams", "zoom",
        "postman", "insomnia", "swagger", "docker desktop", "virtualbox",
        "figma", "sketch", "adobe xd", "photoshop", "illustrator",
        "excel", "powerpoint", "word", "google docs", "sheets",
        "tableau", "power bi", "looker studio", "metabase",
        "grafana", "prometheus", "datadog", "new relic",
    }
    
    text_lower = text.lower()
    found_tools = [tool for tool in tools if tool in text_lower]
    return found_tools


def extract_certifications(text: str) -> List[str]:
    """Extract certifications"""
    cert_patterns = [
        r"(?:aws|azure|gcp|google|cloud)?\s*(?:certified|certification)",
        r"(?:pmp|csm|cspo|scrum master)",
        r"(?:cissp|ceh|comptia|ccna|ccnp)",
    ]
    
    certs = []
    for pattern in cert_patterns:
        matches = re.findall(pattern, text.lower())
        certs.extend(matches)
    
    return list(set(certs))[:5]
