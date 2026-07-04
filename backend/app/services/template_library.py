"""
Resume Templates and Examples Library
Provides ATS-friendly templates and industry-specific examples
"""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class TemplateMetadata(BaseModel):
    id: str
    name: str
    description: str
    industry: str
    level: str  # entry, mid, senior, executive
    ats_score: int
    is_ats_friendly: bool
    colors: list[str]
    fonts: list[str]


class ResumeTemplate(BaseModel):
    metadata: TemplateMetadata
    html: str  # HTML/CSS for the template
    sections: dict  # Section structure
    ats_check: dict  # ATS compatibility details


class ResumeExample(BaseModel):
    id: str
    title: str
    role: str
    industry: str
    level: str  # entry, mid, senior
    company: str
    ats_score: int
    full_text: str
    key_achievements: list[str]
    keywords: list[str]


class ResumeTemplateLibrary:
    """Template library for ATS-friendly designs"""

    TEMPLATES = {
        "professional-minimal": TemplateMetadata(
            id="professional-minimal",
            name="Professional Minimal",
            description="Clean, single-column layout optimized for ATS",
            industry="general",
            level="all",
            ats_score=95,
            is_ats_friendly=True,
            colors=["#000000", "#1C3144"],
            fonts=["Arial", "Calibri"],
        ),
        "modern-clean": TemplateMetadata(
            id="modern-clean",
            name="Modern Clean",
            description="Contemporary design with clear sections",
            industry="tech",
            level="mid",
            ats_score=92,
            is_ats_friendly=True,
            colors=["#1A73E8", "#FFFFFF", "#F3F3F3"],
            fonts=["Helvetica", "Calibri"],
        ),
        "executive-bold": TemplateMetadata(
            id="executive-bold",
            name="Executive Bold",
            description="Professional design for leadership roles",
            industry="general",
            level="senior",
            ats_score=88,
            is_ats_friendly=True,
            colors=["#2C3E50", "#FFFFFF"],
            fonts=["Times New Roman", "Georgia"],
        ),
    }

    @staticmethod
    def get_all_templates() -> dict:
        """Get all available templates"""
        return ResumeTemplateLibrary.TEMPLATES

    @staticmethod
    def get_template(template_id: str) -> Optional[TemplateMetadata]:
        """Get single template"""
        return ResumeTemplateLibrary.TEMPLATES.get(template_id)

    @staticmethod
    def get_templates_by_level(level: str) -> dict:
        """Filter templates by career level"""
        return {
            k: v
            for k, v in ResumeTemplateLibrary.TEMPLATES.items()
            if v.level == "all" or v.level == level
        }

    @staticmethod
    def get_ats_friendly_templates() -> dict:
        """Get only ATS-optimized templates"""
        return {
            k: v
            for k, v in ResumeTemplateLibrary.TEMPLATES.items()
            if v.is_ats_friendly and v.ats_score >= 85
        }


class ResumeExampleLibrary:
    """Example resumes database"""

    EXAMPLES = [
        ResumeExample(
            id="ex-1",
            title="Senior Software Engineer - AI Company",
            role="Senior Software Engineer",
            industry="Technology",
            level="senior",
            company="TechCorp",
            ats_score=94,
            full_text="""
ALEX CHEN
San Francisco, CA | alex.chen@email.com | +1-415-555-0147 | linkedin.com/in/alexchen

PROFESSIONAL SUMMARY
Results-driven Senior Software Engineer with 8+ years of experience building scalable 
infrastructure and AI-powered systems. Proven track record of leading cross-functional teams, 
optimizing system performance, and delivering products that serve 5M+ users. Expert in Python, 
TypeScript, and cloud architecture.

EXPERIENCE
Senior Software Engineer | TechCorp AI Lab | San Francisco, CA | Jan 2022 - Present
• Led development of real-time ML pipeline serving 2M+ daily requests, reducing latency by 65%
• Architected microservices infrastructure on Kubernetes, improving deployment efficiency by 45%
• Mentored team of 5 engineers, conducting code reviews and technical design sessions
• Implemented A/B testing framework, enabling data-driven decisions increasing revenue 28%
• Reduced cloud infrastructure costs by $180K annually through optimization initiatives

Software Engineer | CloudSys Inc. | San Francisco, CA | Jun 2018 - Dec 2021
• Developed distributed tracing system handling 100B+ events daily, used by 50+ teams
• Optimized database queries reducing P99 latency from 500ms to 45ms (91% improvement)
• Built real-time analytics dashboard, enabling faster incident response (avg. 15min vs 60min)
• Collaborated with product teams to deliver features used by 10M+ active users
• Increased test coverage from 62% to 92%, reducing production bugs by 73%

Junior Software Engineer | StartupAI | Silicon Valley, CA | Aug 2016 - May 2018
• Developed backend services in Python, processing 500K+ transactions daily
• Implemented caching layer reducing database load by 40%
• Contributed to open-source ML framework, received 50+ GitHub stars

EDUCATION
B.S. Computer Science | University of California, Berkeley | Graduated May 2016
• GPA: 3.8/4.0 | Dean's List all semesters

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, Go, SQL
Frameworks: Django, FastAPI, React, Node.js, TensorFlow
Infrastructure: AWS, Kubernetes, Docker, PostgreSQL, Redis
Tools: Git, Jira, DataDog, Apache Kafka, Terraform

CERTIFICATIONS & AWARDS
• AWS Certified Solutions Architect - Professional
• Google Cloud Professional Data Engineer Certification
• "Engineer of the Year" Award - TechCorp (2023)
""".strip(),
            key_achievements=[
                "Led development of real-time ML pipeline serving 2M+ daily requests",
                "Reduced cloud costs by $180K annually",
                "Increased test coverage from 62% to 92%",
                "Mentored team of 5 engineers",
            ],
            keywords=[
                "Python", "TypeScript", "Kubernetes", "Microservices", "AWS",
                "Machine Learning", "System Design", "Leadership", "Cloud Architecture",
            ],
        ),
        ResumeExample(
            id="ex-2",
            title="Product Manager - E-Commerce",
            role="Product Manager",
            industry="E-Commerce",
            level="mid",
            company="ShopCo",
            ats_score=91,
            full_text="""
JORDAN PATEL
New York, NY | jordan.patel@email.com | +1-212-555-0198 | linkedin.com/in/jordanpatel

PROFESSIONAL SUMMARY
Strategic Product Manager with 6+ years driving product strategy and innovation at scale. 
Proven ability to define product roadmaps, lead cross-functional teams, and deliver features 
that impact business metrics. Skilled in data analysis, user research, and agile methodologies.

EXPERIENCE
Senior Product Manager | ShopCo | New York, NY | Mar 2021 - Present
• Led mobile app product strategy, growing DAU from 500K to 2.3M (+360% growth)
• Defined and executed roadmap prioritizing features with highest ROI and user impact
• Partnered with engineering to launch 12 major features improving user retention by 42%
• Conducted user research interviews (100+ users) to validate product hypotheses
• Managed cross-functional team including design, engineering, and marketing (8 people)
• Achieved $12M ARR from mobile subscriptions through pricing optimization and feature bundling

Product Manager | RetailTech | New York, NY | Jun 2019 - Feb 2021
• Owned checkout and payments product, generating 35% of company revenue ($8M annually)
• Reduced cart abandonment by 18% through UX improvements and A/B testing
• Launched "Buy Now, Pay Later" feature, reaching $500K GMV in first 90 days
• Built data dashboard tracking 40+ product metrics, informing weekly decisions

Associate Product Manager | FinanceApp | San Francisco, CA | Jul 2017 - May 2019
• Supported product launches for investment and savings features
• Conducted competitive analysis and market research for new markets
• Achieved 99.2% uptime for critical financial transactions

EDUCATION
MBA, Business Administration | Columbia Business School | Graduated May 2017
• Specialization: Product Management | GPA: 3.9/4.0

B.S., Computer Science | University of Michigan | Graduated May 2015
• GPA: 3.7/4.0

SKILLS
Product Strategy, Roadmap Planning, Data Analysis, User Research, Agile, SQL,
Google Analytics, Tableau, Product-Market Fit, Go-to-Market Strategy

LANGUAGES
English (Native), Hindi (Fluent), Spanish (Basic)
""".strip(),
            key_achievements=[
                "Grew mobile DAU from 500K to 2.3M (+360%)",
                "Reduced cart abandonment by 18%",
                "Generated $12M ARR from subscriptions",
                "Led feature launches impacting $8M+ revenue",
            ],
            keywords=[
                "Product Strategy", "Product Roadmap", "Data Analysis", "User Research",
                "Agile", "Mobile App", "E-Commerce", "Product-Market Fit", "Go-to-Market",
            ],
        ),
    ]

    @staticmethod
    def get_all_examples() -> list:
        """Get all resume examples"""
        return ResumeExampleLibrary.EXAMPLES

    @staticmethod
    def get_examples_by_role(role: str) -> list:
        """Filter examples by role"""
        return [e for e in ResumeExampleLibrary.EXAMPLES if role.lower() in e.role.lower()]

    @staticmethod
    def get_examples_by_level(level: str) -> list:
        """Filter examples by career level"""
        return [e for e in ResumeExampleLibrary.EXAMPLES if e.level == level]

    @staticmethod
    def get_examples_by_industry(industry: str) -> list:
        """Filter examples by industry"""
        return [e for e in ResumeExampleLibrary.EXAMPLES if industry.lower() in e.industry.lower()]

    @staticmethod
    def get_high_ats_score_examples(min_score: int = 85) -> list:
        """Get examples with high ATS scores"""
        return [e for e in ResumeExampleLibrary.EXAMPLES if e.ats_score >= min_score]

    @staticmethod
    def search_examples(query: str) -> list:
        """Search examples by keywords"""
        results = []
        query_lower = query.lower()
        for example in ResumeExampleLibrary.EXAMPLES:
            if (
                query_lower in example.role.lower()
                or query_lower in example.industry.lower()
                or any(query_lower in kw.lower() for kw in example.keywords)
                or query_lower in example.company.lower()
            ):
                results.append(example)
        return results
