"""
AI-Powered Resume Writer with ATS Optimization
Generates, rewrites, and tailors resume content for maximum ATS score
"""
from app.services import llm_tools
from app.services.ats_checker import ATSChecker


class ResimeWriter:
    """AI resume writing service with ATS focus"""

    ATS_OPTIMIZED_PROMPT = """
You are an expert ATS-optimized resume writer. Generate professional resume content that:
1. Starts each bullet with a strong action verb (Achieved, Built, Led, Improved, Drove, etc.)
2. Includes quantifiable metrics (numbers, percentages, dollar amounts)
3. Uses simple, ATS-friendly language (no special characters, tables, or complex formatting)
4. Incorporates relevant keywords from the job description
5. Keeps bullet points concise (one line each)
6. Uses standard section structure (Summary, Experience, Education, Skills)

Resume Context:
- Role: {role}
- Years of Experience: {years}
- Current Skills: {skills}
- Achievements: {achievements}
- Job Description: {job_description}

Generate 5-7 professional bullet points for the experience section that will maximize ATS score and appeal to recruiters.
"""

    def __init__(self):
        self.ats_checker = ATSChecker()

    def generate_bullets(
        self,
        role: str,
        years: int,
        skills: list[str],
        achievements: list[str],
        job_description: str = "",
    ) -> dict:
        """Generate ATS-optimized bullet points"""
        prompt = self.ATS_OPTIMIZED_PROMPT.format(
            role=role,
            years=years,
            skills=", ".join(skills),
            achievements=", ".join(achievements),
            job_description=job_description,
        )

        # Call LLM
        bullets = llm_tools.generate_resume_bullets(prompt)

        # Check ATS compliance
        bullet_text = "\n".join(bullets)
        ats_check = self.ats_checker.check_resume(bullet_text, job_description)

        return {
            "bullets": bullets,
            "ats_score": ats_check["ats_score"],
            "issues": ats_check["issues"],
            "recommendations": ats_check["recommendations"],
        }

    def rewrite_for_ats(self, resume_text: str, job_description: str = "") -> dict:
        """Rewrite entire resume for ATS optimization"""
        # Parse current resume sections
        sections = self._parse_resume_sections(resume_text)

        # Check current ATS score
        current_ats = self.ats_checker.check_resume(resume_text, job_description)

        # Rewrite each section
        rewritten_sections = {}
        for section, content in sections.items():
            if section == "experience":
                rewritten_sections[section] = llm_tools.rewrite_resume_section(
                    content,
                    job_description,
                    section_type="experience",
                )
            elif section == "skills":
                rewritten_sections[section] = llm_tools.rewrite_resume_section(
                    content,
                    job_description,
                    section_type="skills",
                )

        # Reconstruct resume
        rewritten_resume = self._reconstruct_resume(sections, rewritten_sections)

        # Check new ATS score
        new_ats = self.ats_checker.check_resume(rewritten_resume, job_description)

        return {
            "original_ats_score": current_ats["ats_score"],
            "new_ats_score": new_ats["ats_score"],
            "improvement": new_ats["ats_score"] - current_ats["ats_score"],
            "rewritten_resume": rewritten_resume,
            "issues_fixed": len(current_ats["issues"]) - len(new_ats["issues"]),
            "remaining_issues": new_ats["issues"],
            "recommendations": new_ats["recommendations"],
        }

    def tailor_for_job(self, resume_text: str, job_description: str) -> dict:
        """Tailor resume for specific job/ATS system"""
        prompt = f"""
Tailor this resume for the following job description. Focus on:
1. Adding missing keywords from the job posting
2. Reordering experience to match job requirements priority
3. Emphasizing relevant skills and achievements
4. Maintaining ATS-friendly formatting

Resume:
{resume_text}

Job Description:
{job_description}

Return the tailored resume with improvements highlighted.
"""
        tailored = llm_tools.generate_tailored_resume(prompt)
        ats_check = self.ats_checker.check_resume(tailored, job_description)

        return {
            "tailored_resume": tailored,
            "ats_score": ats_check["ats_score"],
            "keyword_optimization": ats_check["details"].get("keywords", {}),
            "recommendations": ats_check["recommendations"],
        }

    def optimize_for_ats_system(
        self,
        resume_text: str,
        ats_system_type: str = "generic",
    ) -> dict:
        """Optimize for specific ATS system (Workday, Taleo, etc.)"""
        ats_specifics = {
            "workday": {
                "avoid": ["tables", "graphics", "unusual formatting"],
                "prefer": ["simple line breaks", "standard fonts", "plain text"],
            },
            "taleo": {
                "avoid": ["columns", "text boxes", "headers/footers"],
                "prefer": ["one-column layout", "no special characters"],
            },
            "generic": {
                "avoid": ["complex formatting"],
                "prefer": ["clear structure", "standard sections"],
            },
        }

        specifics = ats_specifics.get(ats_system_type, ats_specifics["generic"])

        prompt = f"""
Optimize this resume for the {ats_system_type} ATS system.
Avoid: {', '.join(specifics['avoid'])}
Prefer: {', '.join(specifics['prefer'])}

Resume:
{resume_text}

Return an optimized version that will parse correctly.
"""
        optimized = llm_tools.generate_optimized_resume(prompt)
        ats_check = self.ats_checker.check_resume(optimized)

        return {
            "optimized_resume": optimized,
            "ats_score": ats_check["ats_score"],
            "ats_system": ats_system_type,
            "compliance_check": ats_check["details"],
            "issues": ats_check["issues"],
        }

    def _parse_resume_sections(self, text: str) -> dict:
        """Parse resume into sections"""
        sections = {
            "header": "",
            "summary": "",
            "experience": "",
            "education": "",
            "skills": "",
            "projects": "",
            "other": "",
        }

        # Simple regex-based parsing
        import re

        section_patterns = {
            "summary": r"(professional summary|summary|profile)(.*?)(experience|education|skills)",
            "experience": r"(experience|work history)(.*?)(education|skills|other)",
            "education": r"(education|certifications)(.*?)(skills|projects|other)",
            "skills": r"(skills|technical skills|competencies)(.*?)(?=projects|other|$)",
            "projects": r"(projects|portfolio)(.*?)$",
        }

        for section, pattern in section_patterns.items():
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section] = match.group(2).strip() if len(match.groups()) > 1 else match.group(0).strip()

        return sections

    def _reconstruct_resume(self, original: dict, rewritten: dict) -> str:
        """Reconstruct resume from sections"""
        result = []

        if original.get("header"):
            result.append(original["header"])
        if rewritten.get("summary") or original.get("summary"):
            result.append(f"\nSUMMARY\n{rewritten.get('summary') or original.get('summary')}")
        if rewritten.get("experience") or original.get("experience"):
            result.append(f"\nEXPERIENCE\n{rewritten.get('experience') or original.get('experience')}")
        if rewritten.get("education") or original.get("education"):
            result.append(f"\nEDUCATION\n{rewritten.get('education') or original.get('education')}")
        if rewritten.get("skills") or original.get("skills"):
            result.append(f"\nSKILLS\n{rewritten.get('skills') or original.get('skills')}")
        if original.get("projects"):
            result.append(f"\nPROJECTS\n{original.get('projects')}")

        return "\n".join(result)
