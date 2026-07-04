"""
Mock LLM for testing without OpenAI API usage.
Simulates question-aware responses for development/testing.
"""

import re


def _extract_keywords(text: str, limit: int = 6) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", text.lower())
    stop_words = {
        "about", "after", "again", "also", "answer", "because", "before", "could",
        "give", "have", "help", "like", "make", "need", "please", "question",
        "should", "tell", "that", "their", "there", "this", "what", "when",
        "where", "which", "with", "would", "your", "the", "how", "why",
    }
    unique_words = []
    for word in words:
        if word not in stop_words and word not in unique_words:
            unique_words.append(word)
    return unique_words[:limit]


def _build_general_mock_answer(user: str, role: str = "general") -> str:
    cleaned_question = " ".join(user.strip().split())
    keywords = _extract_keywords(cleaned_question)
    focus = ", ".join(keywords) if keywords else "your exact question"

    if cleaned_question.endswith("?"):
        opening = f"Here is a focused answer to: {cleaned_question}"
    else:
        opening = f"Here is a direct response to your request: {cleaned_question}"

    return f"""I'm in local test mode, so this is a lightweight answer generated without calling OpenAI.

{opening}

Key points:
1. Main focus: {focus}.
2. Start by clarifying the outcome you want, then choose the simplest action that moves you toward it.
3. If this is for resumes, jobs, interviews, or career planning, connect the answer to your actual resume/JD context.
4. If it is a general question, answer it directly first, then add examples or next steps only where useful.

Practical next step: share one more detail about the situation, and I can make the answer more specific."""

def mock_chat_response(system: str, user: str, role: str = "general") -> str:
    """Generate mock responses based on the user's actual question."""
    
    user_lower = user.lower()
    
    # ATS Check responses
    if "ats" in user_lower and ("check" in user_lower or "score" in user_lower):
        return """✓ ATS Score: 82/100

**Strengths:**
- Clear structure with distinct sections
- Action verbs used in most bullets
- Reasonable word count (520 words)

**Issues Found:**
- 🟡 MEDIUM: 2 bullets lack quantifiable metrics
- 🟡 MEDIUM: LinkedIn URL missing from header
- 🟢 LOW: No GPA listed (optional)

**Top Recommendations:**
1. Add numbers to bullets: "Improved..." → "Improved by 34%"
2. Add LinkedIn URL to header
3. Reorder: Put most recent experience first
4. Add 2-3 more achievement metrics

Estimated new score: 91/100 after fixes"""

    # Resume optimization
    elif "optimize" in user_lower or "rewrite" in user_lower:
        return """Here are optimized resume bullets for your experience:

**Original:** Responsible for managing projects and teams

**Optimized:**
• Led cross-functional team of 8 engineers, delivering 4 major features
• Optimized project workflows, reducing deployment time by 45%
• Managed $2M+ budget for infrastructure and tools

**Key improvements:**
- Added specific numbers (team size, projects, budget)
- Used strong action verbs (Led, Optimized, Managed)
- Included measurable outcomes (45% improvement)
- Specific dollar amounts ($2M+)

**ATS Score improvement:** 65 → 88"""

    # Interview prep
    elif "interview" in user_lower or "question" in user_lower:
        return """Here's a mock interview question using the STAR method:

**Question:** "Tell me about a time you optimized a system or process"

**STAR Framework:**
- **S (Situation):** What was the context? (Company, role, problem)
- **T (Task):** What were you responsible for?
- **A (Action):** What specific steps did you take?
- **R (Result):** What was the measurable outcome?

**Example Answer:**
S: At TechCorp, our release pipeline took 2 hours per deployment
T: I was tasked with reducing deployment time
A: Implemented CI/CD automation using Jenkins, reduced manual steps by 80%
R: Reduced deployment time to 15 minutes, enabling 10x faster releases

**Tips:**
- Keep answer to 2-3 minutes
- Use specific numbers
- Show impact of your work"""

    # Career guidance
    elif "career" in user_lower or "next" in user_lower:
        return """Based on your profile, here are recommended next career moves:

**Short-term (6 months):**
- Deepen expertise in 1-2 key technologies
- Build 1-2 portfolio projects
- Start networking in your target industry

**Medium-term (1 year):**
- Consider lateral move to expand skills
- Lead 1-2 small projects
- Build personal brand (blog/LinkedIn)

**Long-term (2+ years):**
- Target senior/principal roles
- Consider management track
- Build industry reputation

**Opportunities for your profile:**
1. AI Engineer at growing startups
2. ML Engineer at tech companies
3. Senior Software Engineer (any domain)
4. Technical Lead positions

**Recommendations:**
- Optimize LinkedIn profile (use AI Mode helps!)
- Build 2-3 strong portfolio projects
- Practice interviewing regularly
- Network with recruiters in your target roles"""

    # Keywords
    elif "keyword" in user_lower or "optimize" in user_lower:
        return """Top 20 keywords for your target role:

**Most Important (must have):**
1. Python
2. Machine Learning
3. SQL
4. AWS
5. Git
6. Docker

**High Value (add if you have):**
7. Kubernetes
8. TensorFlow
9. PyTorch
10. Microservices
11. CI/CD
12. REST APIs

**Nice to Have:**
13. Apache Spark
14. Kafka
15. Redis
16. MongoDB
17. Agile
18. Leadership
19. Communication
20. Problem Solving

**Placement Strategy:**
- Add top 6 to summary/headline
- Scatter throughout experience bullets
- Include in skills section
- Use in cover letters when matching jobs"""

    elif any(word in user_lower for word in ["code", "program", "python", "javascript", "react", "api", "error", "bug"]):
        keywords = _extract_keywords(user)
        focus = ", ".join(keywords) if keywords else "the code problem"
        return f"""I'm in local test mode, so this is a lightweight coding-style answer.

Your question is about: {focus}.

Suggested approach:
1. Reproduce the exact issue and copy the error message.
2. Identify the smallest file/function involved.
3. Check inputs, expected output, and any API/config values.
4. Make one small fix, then rerun the same test.

If you paste the code or error, I can give a more exact fix."""

    elif any(word in user_lower for word in ["explain", "define", "meaning", "how", "why", "what is", "who is", "where is", "when is"]):
        return _build_general_mock_answer(user, role)

    # Default question-aware response
    else:
        return _build_general_mock_answer(user, role)


# Export for use in API
def get_mock_response(messages: list[dict], mode: str = "general", context: str = None) -> str:
    """Get mock response from message history"""
    if not messages:
        return "Hello! Ask me anything about resumes, ATS, interviews, or careers."
    
    # Get last user message
    user_message = None
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
    
    if not user_message:
        return "I didn't understand that. Can you rephrase?"
    
    return mock_chat_response("", user_message, mode)
