"""
Resume PDF Export and Shareable Links
Convert resume to PDF and generate shareable public links
"""
import base64
import uuid
from datetime import datetime, timedelta
from typing import Optional
import json


class ShareableResumeLink:
    """Manages shareable resume links and metadata"""
    
    # In-memory store (in production, use database)
    _shares_db = {}
    
    @staticmethod
    def create_share(resume_text: str, ats_score: int = 0, metadata: dict = None) -> dict:
        """Create a shareable link for a resume"""
        share_id = str(uuid.uuid4())[:8]
        expires_at = (datetime.utcnow() + timedelta(days=90)).isoformat()  # 90-day expiration
        
        share_data = {
            "id": share_id,
            "resume": resume_text,
            "ats_score": ats_score,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at,
            "view_count": 0,
        }
        
        ShareableResumeLink._shares_db[share_id] = share_data
        
        return {
            "share_id": share_id,
            "share_url": f"/share/{share_id}",
            "short_url": f"resumeai.local/r/{share_id}",
            "expires_at": expires_at,
            "qr_code": f"https://qr-server.com/qr?url=resumeai.local/r/{share_id}",
        }
    
    @staticmethod
    def get_share(share_id: str) -> Optional[dict]:
        """Get shared resume (with expiration check)"""
        share = ShareableResumeLink._shares_db.get(share_id)
        if not share:
            return None
        
        # Check if expired
        expires_at = datetime.fromisoformat(share["expires_at"])
        if datetime.utcnow() > expires_at:
            del ShareableResumeLink._shares_db[share_id]
            return None
        
        # Increment view count
        share["view_count"] += 1
        
        return share
    
    @staticmethod
    def revoke_share(share_id: str) -> bool:
        """Revoke a shared resume link"""
        if share_id in ShareableResumeLink._shares_db:
            del ShareableResumeLink._shares_db[share_id]
            return True
        return False
    
    @staticmethod
    def get_share_stats(share_id: str) -> Optional[dict]:
        """Get viewing stats for a shared resume"""
        share = ShareableResumeLink._shares_db.get(share_id)
        if not share:
            return None
        
        return {
            "share_id": share_id,
            "view_count": share["view_count"],
            "created_at": share["created_at"],
            "expires_at": share["expires_at"],
            "is_expired": datetime.utcnow().isoformat() > share["expires_at"],
        }


class ResumePDFGenerator:
    """Generate PDF from resume HTML/text with styling"""
    
    # Basic HTML template for PDF generation
    HTML_TEMPLATE = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Resume</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: Calibri, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 8.5in;
                height: 11in;
                margin: 0 auto;
                padding: 0.5in;
                background: white;
            }}
            .header {{
                text-align: center;
                margin-bottom: 15px;
                border-bottom: 2px solid #0066cc;
                padding-bottom: 10px;
            }}
            .name {{
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }}
            .contact {{
                font-size: 11px;
                color: #666;
            }}
            .section {{
                margin-bottom: 12px;
            }}
            .section-title {{
                font-size: 13px;
                font-weight: bold;
                background: #f0f0f0;
                padding: 5px 8px;
                margin-bottom: 8px;
                letter-spacing: 0.5px;
            }}
            .job {{
                margin-bottom: 10px;
            }}
            .job-title {{
                font-weight: bold;
                font-size: 12px;
                margin-bottom: 2px;
            }}
            .job-meta {{
                font-size: 11px;
                color: #666;
                margin-bottom: 4px;
            }}
            .bullets {{
                font-size: 11px;
                margin-left: 15px;
            }}
            .bullet {{
                margin-bottom: 3px;
                list-style-type: disc;
            }}
            .skills {{
                font-size: 11px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }}
            .skill-item {{
                background: #e8f0ff;
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 10px;
            }}
            .ats-badge {{
                display: inline-block;
                background: #4CAF50;
                color: white;
                padding: 3px 10px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                margin-top: 10px;
            }}
            @media print {{
                body {{
                    margin: 0;
                    padding: 0.5in;
                }}
            }}
        </style>
    </head>
    <body>
        {content}
        {ats_badge}
    </body>
    </html>
    """
    
    @staticmethod
    def generate_html(resume_text: str, ats_score: int = 0, name: str = "", contact: str = "") -> str:
        """Generate HTML version of resume"""
        # Simple text-to-HTML conversion
        lines = resume_text.split("\n")
        
        # Extract sections
        sections = ResumePDFGenerator._parse_sections(lines)
        
        # Build HTML content
        content_html = f"""
        <div class="header">
            <div class="name">{name or "Your Name"}</div>
            <div class="contact">{contact or "Email • Phone • LinkedIn"}</div>
        </div>
        """
        
        for section_name, section_content in sections.items():
            if section_content:
                content_html += f"""
                <div class="section">
                    <div class="section-title">{section_name.upper()}</div>
                    {ResumePDFGenerator._format_section(section_name, section_content)}
                </div>
                """
        
        ats_badge = f'<div class="ats-badge">ATS Score: {ats_score}/100</div>' if ats_score > 0 else ""
        
        html = ResumePDFGenerator.HTML_TEMPLATE.format(
            content=content_html,
            ats_badge=ats_badge,
        )
        
        return html
    
    @staticmethod
    def _parse_sections(lines: list[str]) -> dict:
        """Parse resume sections from text"""
        sections = {
            "summary": "",
            "experience": "",
            "education": "",
            "skills": "",
        }
        
        current_section = None
        for line in lines:
            line_lower = line.lower().strip()
            
            if "summary" in line_lower or "profile" in line_lower:
                current_section = "summary"
            elif "experience" in line_lower or "work history" in line_lower:
                current_section = "experience"
            elif "education" in line_lower:
                current_section = "education"
            elif "skills" in line_lower or "technical" in line_lower:
                current_section = "skills"
            elif current_section:
                sections[current_section] += line + "\n"
        
        return sections
    
    @staticmethod
    def _format_section(section_name: str, content: str) -> str:
        """Format section content as HTML"""
        if section_name == "skills":
            # Format skills as tags
            skills = [s.strip() for s in content.split(",") if s.strip()]
            html = "<div class='skills'>"
            for skill in skills[:20]:
                html += f"<div class='skill-item'>{skill}</div>"
            html += "</div>"
            return html
        else:
            # Format as bullet points
            lines = [l.strip() for l in content.split("\n") if l.strip()]
            html = "<ul class='bullets'>"
            for line in lines:
                if line:
                    html += f"<li class='bullet'>{line}</li>"
            html += "</ul>"
            return html
    
    @staticmethod
    def generate_pdf_base64(html: str) -> str:
        """Convert HTML to PDF and return as base64
        Note: This requires external PDF generation service (Puppeteer, wkhtmltopdf, etc.)
        For now, return HTML base64 as placeholder"""
        return base64.b64encode(html.encode()).decode()


class ResumeExport:
    """Export resume in multiple formats"""
    
    @staticmethod
    def export_pdf(resume_text: str, filename: str = "resume.pdf", ats_score: int = 0) -> dict:
        """Export resume as PDF"""
        html = ResumePDFGenerator.generate_html(resume_text, ats_score)
        pdf_base64 = ResumePDFGenerator.generate_pdf_base64(html)
        
        return {
            "format": "pdf",
            "filename": filename,
            "size_kb": len(pdf_base64) / 1024,
            "data": pdf_base64,
            "download_url": f"/export/download/pdf/{filename.replace('.pdf', '')}",
        }
    
    @staticmethod
    def export_docx(resume_text: str, filename: str = "resume.docx") -> dict:
        """Export as DOCX (placeholder)"""
        # In production, use python-docx library
        return {
            "format": "docx",
            "filename": filename,
            "status": "coming_soon",
            "note": "DOCX export coming soon",
        }
    
    @staticmethod
    def export_txt(resume_text: str, filename: str = "resume.txt") -> dict:
        """Export as plain text"""
        return {
            "format": "txt",
            "filename": filename,
            "size_kb": len(resume_text) / 1024,
            "content": resume_text,
        }
    
    @staticmethod
    def export_json(resume_data: dict, filename: str = "resume.json") -> dict:
        """Export as structured JSON"""
        json_str = json.dumps(resume_data, indent=2)
        return {
            "format": "json",
            "filename": filename,
            "size_kb": len(json_str) / 1024,
            "data": json_str,
        }
