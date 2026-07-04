import os
from openai import OpenAI
from app.core.config import get_settings

settings = get_settings()

SYSTEM = "You are an ATS and hiring expert. Be concise and actionable."


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", settings.openai_api_key)
    return OpenAI(api_key=api_key)


def resume_feedback(resume_text: str, job_text: str, missing_skills: list[str]) -> str:
    prompt = f"""
Job description:
{job_text}

Resume:
{resume_text[:4000]}

Missing/weak skills: {', '.join(missing_skills) if missing_skills else 'None'}

Give 5 bullet point improvements (wording, metrics, skills). Keep under 120 words.
"""
    resp = _get_client().chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    return resp.choices[0].message.content
