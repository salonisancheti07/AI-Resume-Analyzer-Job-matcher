"""
Comprehensive ATS Checker - Validates resume for ATS compatibility
Focuses on formatting, structure, keywords, and score optimization
"""
import re
from typing import Optional


class ATSChecker:
    """Comprehensive ATS resume checker with detailed rules"""

    # ATS-safe fonts
    SAFE_FONTS = {
        "Arial",
        "Helvetica",
        "Times New Roman",
        "Calibri",
        "Cambria",
        "Courier New",
        "Verdana",
        "Georgia",
    }

    # Red flags for ATS parsers
    RED_FLAGS = {
        "table": r"<table|┌|┐|└|┘|─|│|├|┤|┬|┴|┼",
        "column": r"column|multi-col|text-column",
        "graphic": r"<svg|<canvas|<image|<img|image\.|graphic|chart|π",
        "special_char": r"©|®|™|†|‡|¶|§|†|‸|◆|★|♦|●|○|◎|◇|■|□|▪|▫",
        "table_of_contents": r"table of contents|TOC",
    }

    GOOD_INDICATORS = {
        "metrics": r"\d+%|\$\d+[KMB]?|\d+x improve|increase.*\d+|grow.*\d+",
        "action_verbs": r"^(Achieved|Built|Created|Designed|Developed|Drove|Enhanced|Expanded|Improved|Increased|Launched|Led|Managed|Optimized|Orchestrated|Performed|Redesigned|Reduced|Restructured|Streamlined|Transformed|Implemented|Established)",
        "bullets": r"^[-•]",
        "dates": r"\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*(?:present|current)",
        "contact_info": r"[^\s@]+@[^\s@]+\.\w+|(\+\d{1,3})?[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}",
    }

    def __init__(self):
        self.rules_results = {}
        self.issues = []
        self.score = 0

    def check_resume(self, text: str, job_description: str = "") -> dict:
        """Run comprehensive ATS checks"""
        self.rules_results = {}
        self.issues = []

        # Run all checks
        self._check_formatting(text)
        self._check_structure(text)
        self._check_content_quality(text)
        self._check_keywords(text, job_description)
        self._check_word_count(text)
        self._check_contact_info(text)
        
        # Calculate ATS score
        self._calculate_score()

        return {
            "ats_score": self.score,
            "issues": self.issues,
            "recommendations": self._get_recommendations(),
            "details": self.rules_results,
        }

    def _check_formatting(self, text: str) -> None:
        """Check for ATS-unfriendly formatting"""
        results = {}

        # Check for tables
        has_tables = bool(re.search(self.RED_FLAGS["table"], text))
        results["no_tables"] = not has_tables
        if has_tables:
            self.issues.append({
                "severity": "critical",
                "issue": "Resume contains tables",
                "fix": "Remove tables; use simple line breaks or dashes instead",
            })
        else:
            results["no_tables_score"] = 10

        # Check for columns
        has_columns = bool(re.search(self.RED_FLAGS["column"], text))
        results["no_columns"] = not has_columns
        if has_columns:
            self.issues.append({
                "severity": "critical",
                "issue": "Multi-column layout detected",
                "fix": "Use single-column format only",
            })

        # Check for graphics
        has_graphics = bool(re.search(self.RED_FLAGS["graphic"], text))
        results["no_graphics"] = not has_graphics
        if has_graphics:
            self.issues.append({
                "severity": "high",
                "issue": "Resume contains images/graphics",
                "fix": "Remove graphics; use text-only format",
            })

        # Check for special characters
        special_chars = re.findall(self.RED_FLAGS["special_char"], text)
        results["special_chars_count"] = len(set(special_chars))
        if special_chars:
            self.issues.append({
                "severity": "medium",
                "issue": f"Found {len(set(special_chars))} special/decorative characters",
                "fix": "Replace with standard ASCII characters",
            })

        self.rules_results["formatting"] = results

    def _check_structure(self, text: str) -> None:
        """Check for proper resume sections and structure"""
        results = {}

        required_sections = ["experience", "education", "skills"]
        found_sections = []

        for section in required_sections:
            found = bool(re.search(rf"\b{section}\b", text, re.IGNORECASE))
            found_sections.append(section if found else None)
            results[f"has_{section}"] = found
            if not found:
                self.issues.append({
                    "severity": "high",
                    "issue": f"Missing '{section}' section",
                    "fix": f"Add a '{section}' section to your resume",
                })

        results["sections_found"] = len([s for s in found_sections if s])

        # Check for proper date formatting
        dates = re.findall(r"\d{1,2}\/\d{1,2}\/\d{4}|\d{4}\s*-\s*\d{4}", text)
        results["date_formatting"] = len(dates) > 0
        if not results["date_formatting"]:
            self.issues.append({
                "severity": "low",
                "issue": "No standardized date format found",
                "fix": "Use consistent date format (YYYY-MM or MM/DD/YYYY)",
            })

        self.rules_results["structure"] = results

    def _check_content_quality(self, text: str) -> None:
        """Check for quality content with metrics and action verbs"""
        results = {}

        # Check for metrics (quantifiable achievements)
        metrics = re.findall(self.GOOD_INDICATORS["metrics"], text)
        results["metric_count"] = len(metrics)
        results["has_metrics"] = len(metrics) > 3
        if len(metrics) < 3:
            self.issues.append({
                "severity": "medium",
                "issue": "Few quantifiable achievements (metrics)",
                "fix": "Add numbers, percentages, and dollar amounts to bullets",
            })

        # Check for action verbs
        lines = text.split("\n")
        action_verb_lines = [l for l in lines if re.search(self.GOOD_INDICATORS["action_verbs"], l)]
        results["action_verb_count"] = len(action_verb_lines)
        results["action_verb_percentage"] = round((len(action_verb_lines) / max(1, len(lines))) * 100, 1)
        if results["action_verb_percentage"] < 40:
            self.issues.append({
                "severity": "medium",
                "issue": f"Only {results['action_verb_percentage']}% of bullets start with strong action verbs",
                "fix": "Begin each bullet with action verbs like: Achieved, Built, Led, Improved, Drove",
            })

        # Check for bullet points
        bullets = len(re.findall(self.GOOD_INDICATORS["bullets"], text))
        results["bullet_count"] = bullets
        results["has_bullets"] = bullets > 5
        if bullets < 5:
            self.issues.append({
                "severity": "medium",
                "issue": f"Only {bullets} bullet points found",
                "fix": "Expand to 5-7 bullets per role with measurable achievements",
            })

        self.rules_results["content_quality"] = results

    def _check_keywords(self, text: str, job_description: str) -> None:
        """Check keyword match with job description"""
        results = {}

        if not job_description:
            results["keyword_analysis"] = "Skipped (no job description provided)"
            self.rules_results["keywords"] = results
            return

        # Extract keywords from job description
        job_keywords = re.findall(r"\b[a-zA-Z]{4,}\b", job_description.lower())
        job_keywords_set = set(job_keywords)

        resume_text_lower = text.lower()
        matched_keywords = [k for k in job_keywords_set if k in resume_text_lower]
        results["total_keywords"] = len(job_keywords_set)
        results["matched_keywords"] = len(matched_keywords)
        results["match_percentage"] = round((len(matched_keywords) / max(1, len(job_keywords_set))) * 100, 1)
        results["missing_keywords"] = sorted(list(job_keywords_set - set(matched_keywords)))[:10]

        if results["match_percentage"] < 50:
            self.issues.append({
                "severity": "high",
                "issue": f"Only {results['match_percentage']}% keyword match with job description",
                "fix": f"Add these keywords: {', '.join(results['missing_keywords'][:5])}",
            })

        self.rules_results["keywords"] = results

    def _check_word_count(self, text: str) -> None:
        """Check resume length for ATS optimization"""
        results = {}
        word_count = len(text.split())
        results["word_count"] = word_count

        # ATS-friendly range: 400-1200 words
        if word_count < 400:
            results["length_status"] = "too_short"
            self.issues.append({
                "severity": "medium",
                "issue": f"Resume is too short ({word_count} words)",
                "fix": "Expand to 400-1200 words by adding more achievements and details",
            })
        elif word_count > 1200:
            results["length_status"] = "too_long"
            self.issues.append({
                "severity": "low",
                "issue": f"Resume is too long ({word_count} words)",
                "fix": "Trim to 400-1200 words for better ATS parsing",
            })
        else:
            results["length_status"] = "optimal"

        self.rules_results["word_count"] = results

    def _check_contact_info(self, text: str) -> None:
        """Check for proper contact information"""
        results = {}

        # Email
        emails = re.findall(r"[^\s@]+@[^\s@]+\.\w+", text)
        results["has_email"] = len(emails) > 0
        if not results["has_email"]:
            self.issues.append({
                "severity": "critical",
                "issue": "No email address found",
                "fix": "Add a professional email address at the top",
            })

        # Phone
        phones = re.findall(r"(\+\d{1,3})?[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}", text)
        results["has_phone"] = len(phones) > 0

        # LinkedIn
        linkedin = "linkedin" in text.lower()
        results["has_linkedin"] = linkedin

        self.rules_results["contact_info"] = results

    def _calculate_score(self) -> None:
        """Calculate overall ATS score based on all checks"""
        score = 0
        max_score = 100

        # Formatting: 15 points
        if self.rules_results.get("formatting", {}).get("no_tables"):
            score += 5
        if self.rules_results.get("formatting", {}).get("no_columns"):
            score += 5
        if self.rules_results.get("formatting", {}).get("no_graphics"):
            score += 5

        # Structure: 20 points
        structure = self.rules_results.get("structure", {})
        sections_found = structure.get("sections_found", 0)
        score += min(12, sections_found * 4)
        if structure.get("date_formatting"):
            score += 8

        # Content Quality: 25 points
        content = self.rules_results.get("content_quality", {})
        if content.get("has_metrics"):
            score += 8
        if content.get("action_verb_percentage", 0) >= 40:
            score += 8
        if content.get("has_bullets"):
            score += 9

        # Keywords: 20 points
        keywords = self.rules_results.get("keywords", {})
        if keywords.get("match_percentage", 0) >= 75:
            score += 20
        elif keywords.get("match_percentage", 0) >= 50:
            score += 15
        elif keywords.get("match_percentage", 0) >= 25:
            score += 5

        # Word Count: 10 points
        wc = self.rules_results.get("word_count", {})
        if wc.get("length_status") == "optimal":
            score += 10
        elif wc.get("length_status") in ["too_short", "too_long"]:
            score += 5

        # Contact Info: 10 points
        contact = self.rules_results.get("contact_info", {})
        if contact.get("has_email"):
            score += 5
        if contact.get("has_phone"):
            score += 3
        if contact.get("has_linkedin"):
            score += 2

        self.score = min(max_score, score)

    def _get_recommendations(self) -> list:
        """Get prioritized recommendations"""
        recommendations = []

        # Critical issues first
        critical_issues = [i for i in self.issues if i["severity"] == "critical"]
        high_issues = [i for i in self.issues if i["severity"] == "high"]
        medium_issues = [i for i in self.issues if i["severity"] == "medium"]
        low_issues = [i for i in self.issues if i["severity"] == "low"]

        for issue in critical_issues + high_issues + medium_issues + low_issues:
            recommendations.append({
                "priority": issue["severity"],
                "issue": issue["issue"],
                "fix": issue["fix"],
            })

        return recommendations[:10]  # Top 10 recommendations
