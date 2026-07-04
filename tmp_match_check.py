import os
import sys

root = r"c:\Users\salon\OneDrive\Desktop\AI Resume Analyzer & Job Matcher"
os.chdir(root)
sys.path.insert(0, os.path.join(root, 'backend'))

from app.services.job_matcher import generate_job_recommendations

resume_text = "Experienced software engineer with 4 years building React, Node.js, FastAPI, and PostgreSQL applications. Built analytics dashboards and deployed APIs to Azure."
res = generate_job_recommendations(resume_text, preferred_role='software engineer', preferred_location='Bengaluru', limit=5)
print('result_count=', len(res['results']))
print('inferred_role=', res['inferred_role'])
print('top_title=', res['results'][0]['title'] if res['results'] else 'NONE')
print('top_score=', res['results'][0]['recommendationScore'] if res['results'] else 'NONE')
