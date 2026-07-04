import React, { useMemo, useState } from "react";
import { api } from "../api";

const ROLE_LIBRARY = {
  "ML Engineer": {
    benchmark: [
      "python",
      "sql",
      "machine learning",
      "deep learning",
      "tensorflow",
      "pytorch",
      "feature engineering",
      "model deployment",
      "mlops",
      "docker",
      "aws",
      "statistics",
      "data pipelines",
      "experimentation",
    ],
    certifications: [
      "Google Professional Machine Learning Engineer",
      "AWS Certified Machine Learning Engineer",
      "DeepLearning.AI Machine Learning Specialization",
    ],
  },
  "Data Analyst": {
    benchmark: [
      "sql",
      "excel",
      "power bi",
      "tableau",
      "python",
      "statistics",
      "data cleaning",
      "dashboarding",
      "a/b testing",
      "business analysis",
      "communication",
    ],
    certifications: [
      "Microsoft Power BI Data Analyst",
      "Google Data Analytics Professional Certificate",
      "Tableau Desktop Specialist",
    ],
  },
  SDE: {
    benchmark: [
      "javascript",
      "typescript",
      "react",
      "node",
      "sql",
      "api design",
      "system design",
      "testing",
      "docker",
      "aws",
      "redis",
      "git",
    ],
    certifications: [
      "AWS Developer Associate",
      "Meta Front-End Developer",
      "Oracle Java Foundations",
    ],
  },
  "Full Stack Developer": {
    benchmark: [
      "javascript",
      "typescript",
      "react",
      "node",
      "express",
      "mongodb",
      "sql",
      "rest api",
      "docker",
      "aws",
      "testing",
      "css",
    ],
    certifications: [
      "Meta Back-End Developer",
      "AWS Developer Associate",
      "MongoDB Node.js Developer Path",
    ],
  },
  "Product Manager": {
    benchmark: [
      "product strategy",
      "roadmapping",
      "analytics",
      "stakeholder management",
      "market research",
      "sql",
      "experimentation",
      "user stories",
      "prioritization",
      "communication",
    ],
    certifications: [
      "Google Project Management Certificate",
      "One Month Product Management",
      "Pragmatic Institute Foundations",
    ],
  },
};

const COURSE_LIBRARY = {
  python: [
    {
      provider: "YouTube",
      title: "Python for Beginners by freeCodeCamp",
      link: "https://www.youtube.com/results?search_query=freecodecamp+python+full+course",
    },
    {
      provider: "Coursera",
      title: "Python for Everybody",
      link: "https://www.coursera.org/search?query=python%20for%20everybody",
    },
  ],
  sql: [
    {
      provider: "YouTube",
      title: "SQL Full Course",
      link: "https://www.youtube.com/results?search_query=sql+full+course",
    },
    {
      provider: "Coursera",
      title: "SQL for Data Science",
      link: "https://www.coursera.org/search?query=sql%20for%20data%20science",
    },
  ],
  "machine learning": [
    {
      provider: "YouTube",
      title: "Machine Learning lectures",
      link: "https://www.youtube.com/results?search_query=machine+learning+course",
    },
    {
      provider: "Coursera",
      title: "Machine Learning Specialization",
      link: "https://www.coursera.org/search?query=machine%20learning%20specialization",
    },
  ],
  "deep learning": [
    {
      provider: "YouTube",
      title: "Deep Learning playlist",
      link: "https://www.youtube.com/results?search_query=deep+learning+playlist",
    },
    {
      provider: "Coursera",
      title: "Deep Learning Specialization",
      link: "https://www.coursera.org/search?query=deep%20learning%20specialization",
    },
  ],
  react: [
    {
      provider: "YouTube",
      title: "React JS course",
      link: "https://www.youtube.com/results?search_query=react+course",
    },
    {
      provider: "Coursera",
      title: "React courses",
      link: "https://www.coursera.org/search?query=react",
    },
  ],
  node: [
    {
      provider: "YouTube",
      title: "Node.js course",
      link: "https://www.youtube.com/results?search_query=node+js+course",
    },
    {
      provider: "Coursera",
      title: "Node.js courses",
      link: "https://www.coursera.org/search?query=node%20js",
    },
  ],
  aws: [
    {
      provider: "YouTube",
      title: "AWS Cloud Practitioner course",
      link: "https://www.youtube.com/results?search_query=aws+cloud+practitioner+course",
    },
    {
      provider: "Coursera",
      title: "AWS fundamentals",
      link: "https://www.coursera.org/search?query=aws",
    },
  ],
};

const INDUSTRY_BENCHMARKS = {
  Startup: ["ownership", "shipping", "experimentation", "apis", "analytics"],
  Enterprise: ["security", "documentation", "testing", "scalability", "stakeholder management"],
  "AI / Data": ["python", "sql", "machine learning", "statistics", "experimentation"],
  SaaS: ["product metrics", "a/b testing", "retention", "dashboards", "automation"],
};

const SKILL_TIME = {
  python: "4-6 weeks",
  sql: "2-4 weeks",
  "machine learning": "6-10 weeks",
  "deep learning": "8-12 weeks",
  tensorflow: "3-5 weeks",
  pytorch: "3-5 weeks",
  docker: "2-3 weeks",
  aws: "4-6 weeks",
  "model deployment": "4-6 weeks",
  mlops: "6-8 weeks",
  "power bi": "2-4 weeks",
  tableau: "2-4 weeks",
  react: "4-6 weeks",
  node: "3-5 weeks",
  "system design": "5-8 weeks",
};

const ROLE_HINTS = Object.keys(ROLE_LIBRARY);
const ALL_SKILLS = Array.from(new Set(Object.values(ROLE_LIBRARY).flatMap((role) => role.benchmark)));

const initialResume = `Built dashboards for product metrics using SQL and Python.
Created APIs with Node.js and React for internal tools.
Worked with Git, testing, and stakeholder collaboration.`;

const initialJd = `We are hiring an ML Engineer to build training pipelines, deploy models,
work with Python, SQL, PyTorch, AWS, Docker, experimentation, and MLOps.`;

const styles = {
  shell: {
    minHeight: "100vh",
    padding: "32px 24px 80px",
    background:
      "radial-gradient(circle at top left, rgba(255,210,150,0.45), transparent 32%), radial-gradient(circle at top right, rgba(108,148,255,0.18), transparent 24%), linear-gradient(180deg, #fffaf1 0%, #f7f8fc 100%)",
    color: "#1b2440",
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  hero: {
    maxWidth: 1180,
    margin: "0 auto 24px",
    padding: 28,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(16,29,66,0.96), rgba(39,74,167,0.88) 58%, rgba(244,180,69,0.88))",
    color: "#fff",
    boxShadow: "0 24px 60px rgba(16,29,66,0.18)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
    alignItems: "end",
  },
  cardGrid: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 18,
  },
  panel: {
    background: "rgba(255,255,255,0.82)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(37,57,110,0.08)",
    borderRadius: 24,
    boxShadow: "0 16px 40px rgba(31,45,91,0.08)",
    padding: 22,
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    color: "#5d6887",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  textarea: {
    width: "100%",
    minHeight: 150,
    borderRadius: 18,
    border: "1px solid rgba(56,77,135,0.16)",
    padding: 16,
    fontSize: 16,
    color: "#1b2440",
    background: "#fff",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(56,77,135,0.16)",
    padding: "14px 16px",
    fontSize: 16,
    color: "#1b2440",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    border: "none",
    borderRadius: 18,
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
    background: "linear-gradient(135deg, #ff8f3f, #ff5a4f 50%, #4558ff)",
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(69,88,255,0.22)",
  },
  stat: {
    padding: 18,
    borderRadius: 20,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,255,0.96))",
    border: "1px solid rgba(56,77,135,0.08)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    margin: "0 8px 8px 0",
    background: "rgba(65,84,181,0.08)",
    color: "#3245a8",
    fontWeight: 700,
    fontSize: 14,
  },
  dangerPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    margin: "0 8px 8px 0",
    background: "rgba(255,90,79,0.10)",
    color: "#c13a31",
    fontWeight: 700,
    fontSize: 14,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(43,57,108,0.10)",
    overflow: "hidden",
  },
  progressFill: (value, color) => ({
    width: `${value}%`,
    height: "100%",
    borderRadius: 999,
    background: color,
  }),
};

function normalizeText(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function inferRole(jd, selectedRole) {
  if (selectedRole && selectedRole !== "Auto detect") return selectedRole;
  const text = normalizeText(jd);
  if (text.includes("ml engineer") || text.includes("machine learning") || text.includes("deep learning")) return "ML Engineer";
  if (text.includes("data analyst") || text.includes("power bi") || text.includes("tableau")) return "Data Analyst";
  if (text.includes("full stack") || text.includes("mern") || text.includes("frontend") || text.includes("backend")) return "Full Stack Developer";
  if (text.includes("product manager") || text.includes("roadmap")) return "Product Manager";
  return "SDE";
}

function extractSkills(text) {
  const haystack = normalizeText(text);
  return ALL_SKILLS.filter((skill) => haystack.includes(skill));
}

function rankMissingSkills(missingSkills, jdSkills, benchmarkSkills) {
  return missingSkills
    .map((skill) => {
      let priority = 40;
      if (jdSkills.includes(skill)) priority += 35;
      if (benchmarkSkills.includes(skill)) priority += 20;
      if (["python", "sql", "machine learning", "react", "node", "aws"].includes(skill)) priority += 10;
      return { skill, priority: Math.min(priority, 100), time: SKILL_TIME[skill] || "2-5 weeks" };
    })
    .sort((a, b) => b.priority - a.priority);
}

function createCourseRecommendations(prioritySkills) {
  return prioritySkills.slice(0, 5).map(({ skill }) => ({
    skill,
    courses:
      COURSE_LIBRARY[skill] || [
        {
          provider: "YouTube",
          title: `${skill} practical tutorials`,
          link: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial")}`,
        },
        {
          provider: "Coursera",
          title: `${skill} courses`,
          link: `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`,
        },
      ],
  }));
}

function benchmarkIndustrySkills(role, industry) {
  const roleSkills = ROLE_LIBRARY[role]?.benchmark || ROLE_LIBRARY.SDE.benchmark;
  const industrySkills = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.Startup;
  return Array.from(new Set([...roleSkills, ...industrySkills]));
}

function percentage(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function scoreLabel(score) {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Competitive";
  if (score >= 40) return "Needs focused upskilling";
  return "Gap is significant";
}

function buildAnalysis(resumeText, jobDescription, selectedRole, industry) {
  const role = inferRole(jobDescription, selectedRole);
  const resumeSkills = extractSkills(resumeText);
  const jdSkills = extractSkills(jobDescription);
  const benchmarkSkills = benchmarkIndustrySkills(role, industry);
  const missingSkills = benchmarkSkills.filter((skill) => !resumeSkills.includes(skill));
  const matchedSkills = benchmarkSkills.filter((skill) => resumeSkills.includes(skill));
  const rankedMissing = rankMissingSkills(missingSkills, jdSkills, benchmarkSkills);
  const topPriorities = rankedMissing.slice(0, 6);
  const courseRecommendations = createCourseRecommendations(topPriorities);
  const benchmarkCoverage = percentage(matchedSkills.length, benchmarkSkills.length);
  const jdCoverage = percentage(
    jdSkills.filter((skill) => resumeSkills.includes(skill)).length,
    jdSkills.length || benchmarkSkills.length
  );
  const certifications = ROLE_LIBRARY[role]?.certifications || ROLE_LIBRARY.SDE.certifications;

  return {
    role,
    resumeSkills,
    jdSkills,
    matchedSkills,
    missingSkills,
    rankedMissing,
    topPriorities,
    courseRecommendations,
    benchmarkSkills,
    benchmarkCoverage,
    jdCoverage,
    certifications,
    overallScore: Math.round(benchmarkCoverage * 0.55 + jdCoverage * 0.45),
    summary:
      topPriorities.length > 0
        ? `Your profile is closest to ${role}. Closing ${topPriorities[0].skill}, ${topPriorities[1]?.skill || "core fundamentals"}, and ${topPriorities[2]?.skill || "delivery depth"} will move you toward shortlist-ready.`
        : `Your profile already covers the main ${role} benchmark and looks shortlist-ready for this target.`,
  };
}

export default function SkillGapReport() {
  const [resumeText, setResumeText] = useState(initialResume);
  const [jobDescription, setJobDescription] = useState(initialJd);
  const [selectedRole, setSelectedRole] = useState("Auto detect");
  const [industry, setIndustry] = useState("AI / Data");
  const [analysis, setAnalysis] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const detectedRole = useMemo(() => inferRole(jobDescription, selectedRole), [jobDescription, selectedRole]);

  const runAnalysis = () => {
    const nextAnalysis = buildAnalysis(resumeText, jobDescription, selectedRole, industry);

    setProgressMap((current) => {
      const next = { ...current };
      nextAnalysis.topPriorities.forEach(({ skill }) => {
        if (typeof next[skill] !== "number") next[skill] = 15;
      });
      return next;
    });

    setAnalysis(nextAnalysis);
  };

  const handleResumeAutofill = async () => {
    if (!resumeFile) {
      setUploadStatus("Choose a resume file first.");
      return;
    }

    try {
      setUploadStatus("Reading resume and extracting profile details...");
      const formData = new FormData();
      formData.append("resume", resumeFile);
      if (jobDescription.trim()) formData.append("job_description", jobDescription);

      const result = await api.analyze(formData);
      const parsed = result?.parsed || {};
      const extractedSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
      const experience = Array.isArray(parsed.experience) ? parsed.experience : [];
      const education = Array.isArray(parsed.education) ? parsed.education : [];
      const projects = Array.isArray(parsed.projects) ? parsed.projects : [];

      const autofilledText = [
        result?.ai_summary ? `Professional summary: ${result.ai_summary}` : "",
        extractedSkills.length ? `Skills: ${extractedSkills.join(", ")}` : "",
        experience.length ? `Experience: ${experience.join(" | ")}` : "",
        education.length ? `Education: ${education.join(" | ")}` : "",
        projects.length ? `Projects: ${projects.join(" | ")}` : "",
        result?.feedback ? `Feedback notes: ${result.feedback}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (autofilledText) {
        setResumeText(autofilledText);
        const nextAnalysis = buildAnalysis(autofilledText, jobDescription, selectedRole, industry);
        setProgressMap((current) => {
          const next = { ...current };
          nextAnalysis.topPriorities.forEach(({ skill }) => {
            if (typeof next[skill] !== "number") next[skill] = 15;
          });
          return next;
        });
        setAnalysis(nextAnalysis);
        setUploadStatus("Resume details added to the skill gap report.");
      } else {
        setUploadStatus("Resume uploaded, but there was not enough parsed content to auto-fill.");
      }
    } catch (error) {
      setUploadStatus(
        error?.response?.data?.message || "Resume autofill failed. Please try another PDF/DOCX file."
      );
    }
  };

  const activeProgressSkills = analysis?.topPriorities || [];
  const averageProgress = activeProgressSkills.length
    ? Math.round(activeProgressSkills.reduce((sum, item) => sum + (progressMap[item.skill] || 0), 0) / activeProgressSkills.length)
    : 0;

  return (
    <div style={styles.shell}>
      <div style={styles.hero}>
        <div style={styles.heroGrid}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.76 }}>
              Skill Gap Report
            </div>
            <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.02 }}>
              Map your resume to the role, then close the exact gaps that block interviews.
            </h1>
            <p style={{ margin: 0, maxWidth: 720, fontSize: 18, lineHeight: 1.6, opacity: 0.92 }}>
              Resume vs job analysis, missing skills, priority ranking, learning plan, certifications, and an industry benchmark view in one place.
            </p>
          </div>
          <div style={{ ...styles.panel, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff" }}>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.74 }}>Detected role</div>
            <div style={{ marginTop: 8, fontSize: 30, fontWeight: 800 }}>{detectedRole}</div>
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <div style={{ ...styles.stat, background: "rgba(255,255,255,0.14)", color: "#fff", border: "none" }}>
                <div style={{ opacity: 0.72, fontSize: 13 }}>Target industry lens</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{industry}</div>
              </div>
              <div style={{ ...styles.stat, background: "rgba(255,255,255,0.14)", color: "#fff", border: "none" }}>
                <div style={{ opacity: 0.72, fontSize: 13 }}>What this page gives you</div>
                <div style={{ fontSize: 15, lineHeight: 1.6, marginTop: 6 }}>
                  Missing skills, ranked priorities, learning resources, time estimate, and benchmark comparison.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...styles.cardGrid, marginBottom: 20 }}>
        <div style={{ ...styles.panel, gridColumn: "span 2" }}>
          <h2 style={styles.sectionTitle}>Analyze your skill gap</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={styles.label}>Target role</label>
              <select style={styles.input} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option>Auto detect</option>
                {ROLE_HINTS.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Industry benchmark</label>
              <select style={styles.input} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {Object.keys(INDUSTRY_BENCHMARKS).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Resume upload</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={styles.input}
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] || null;
                  setResumeFile(nextFile);
                  setUploadStatus(nextFile ? `${nextFile.name} ready for autofill.` : "");
                }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <div>
              <label style={styles.label}>Resume text / summary</label>
              <textarea
                style={styles.textarea}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume summary, skills, projects, or experience here"
              />
            </div>
            <div>
              <label style={styles.label}>Target job description</label>
              <textarea
                style={styles.textarea}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description to compare against your profile"
              />
            </div>
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={styles.button} onClick={runAnalysis}>
              Build Skill Gap Report
            </button>
            <button
              type="button"
              style={{ ...styles.button, background: "linear-gradient(135deg, #243a84, #4962ff)", boxShadow: "0 14px 28px rgba(36,58,132,0.18)" }}
              onClick={handleResumeAutofill}
            >
              Upload Resume for Autofill
            </button>
            <div style={{ color: "#56627f", fontWeight: 600 }}>
              We infer the role, compare benchmark coverage, then turn the missing skills into a study plan.
            </div>
          </div>
          {uploadStatus ? (
            <div style={{ marginTop: 14, color: "#3245a8", fontWeight: 700 }}>{uploadStatus}</div>
          ) : null}
        </div>

        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>At a glance</h2>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={styles.stat}>
              <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Role fit score</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{analysis?.overallScore || 0}%</div>
              <div style={{ marginTop: 6, color: "#3245a8", fontWeight: 700 }}>{scoreLabel(analysis?.overallScore || 0)}</div>
            </div>
            <div style={styles.stat}>
              <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Skill progress tracker</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{averageProgress}%</div>
              <div style={{ marginTop: 10, ...styles.progressTrack }}>
                <div style={styles.progressFill(averageProgress, "linear-gradient(90deg, #ff9d45, #4562ff)")} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {analysis && (
        <>
          <div style={{ ...styles.cardGrid, marginBottom: 20 }}>
            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Skill Gap Analysis</h2>
              <p style={{ marginTop: 0, color: "#43506f", lineHeight: 1.7 }}>{analysis.summary}</p>
              <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                <div style={styles.stat}>
                  <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Resume vs job coverage</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{analysis.jdCoverage}%</div>
                  <div style={{ marginTop: 10, ...styles.progressTrack }}>
                    <div style={styles.progressFill(analysis.jdCoverage, "linear-gradient(90deg, #ff914f, #ef5f56)")} />
                  </div>
                </div>
                <div style={styles.stat}>
                  <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Industry benchmark comparison</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{analysis.benchmarkCoverage}%</div>
                  <div style={{ marginTop: 10, ...styles.progressTrack }}>
                    <div style={styles.progressFill(analysis.benchmarkCoverage, "linear-gradient(90deg, #485bff, #65b7ff)")} />
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Matched Skills</h2>
              <div>
                {analysis.matchedSkills.length ? (
                  analysis.matchedSkills.map((skill) => (
                    <span key={skill} style={styles.pill}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <div style={{ color: "#66728d" }}>No direct benchmark matches were found yet.</div>
                )}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Missing Skills List</h2>
              <div>
                {analysis.missingSkills.length ? (
                  analysis.missingSkills.map((skill) => (
                    <span key={skill} style={styles.dangerPill}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <div style={{ color: "#66728d" }}>You are covering the core benchmark well already.</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ ...styles.cardGrid, marginBottom: 20 }}>
            <div style={{ ...styles.panel, gridColumn: "span 2" }}>
              <h2 style={styles.sectionTitle}>Priority Skills Ranking</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {analysis.rankedMissing.slice(0, 8).map((item, index) => (
                  <div key={item.skill} style={styles.stat}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#7a859f", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Priority #{index + 1}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{item.skill}</div>
                        <div style={{ color: "#596583", marginTop: 6 }}>Estimated learning time: {item.time}</div>
                      </div>
                      <div style={{ minWidth: 120, textAlign: "right" }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#3245a8" }}>{item.priority}</div>
                        <div style={{ color: "#6d7896" }}>priority score</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, ...styles.progressTrack }}>
                      <div style={styles.progressFill(item.priority, "linear-gradient(90deg, #ff9447, #485bff)")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Time to Learn Estimation</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {analysis.topPriorities.map((item) => (
                  <div key={item.skill} style={styles.stat}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{item.skill}</div>
                    <div style={{ marginTop: 6, color: "#5f6a88" }}>{item.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...styles.cardGrid, marginBottom: 20 }}>
            <div style={{ ...styles.panel, gridColumn: "span 2" }}>
              <h2 style={styles.sectionTitle}>Course Recommendations</h2>
              <div style={{ display: "grid", gap: 16 }}>
                {analysis.courseRecommendations.map(({ skill, courses }) => (
                  <div key={skill} style={styles.stat}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{skill}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      {courses.map((course) => (
                        <a
                          key={`${skill}-${course.provider}-${course.title}`}
                          href={course.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            textDecoration: "none",
                            color: "#1b2440",
                            background: "#fff",
                            border: "1px solid rgba(56,77,135,0.10)",
                            borderRadius: 18,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#7a859f", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {course.provider}
                          </div>
                          <div style={{ marginTop: 6, fontWeight: 800, lineHeight: 1.5 }}>{course.title}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Certification Suggestions</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {analysis.certifications.map((cert) => (
                  <div key={cert} style={styles.stat}>
                    <div style={{ fontWeight: 800 }}>{cert}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.cardGrid}>
            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Skill Progress Tracker</h2>
              <div style={{ display: "grid", gap: 16 }}>
                {analysis.topPriorities.map((item) => (
                  <div key={item.skill} style={styles.stat}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{item.skill}</div>
                      <div style={{ color: "#3245a8", fontWeight: 800 }}>{progressMap[item.skill] || 0}%</div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progressMap[item.skill] || 0}
                      onChange={(e) =>
                        setProgressMap((current) => ({
                          ...current,
                          [item.skill]: Number(e.target.value),
                        }))
                      }
                      style={{ width: "100%", marginTop: 14 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Industry Benchmark Comparison</h2>
              <div style={{ marginBottom: 14, color: "#58647f", lineHeight: 1.7 }}>
                Comparing your profile against the <strong>{industry}</strong> benchmark for <strong>{analysis.role}</strong>.
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {analysis.benchmarkSkills.slice(0, 12).map((skill) => {
                  const covered = analysis.resumeSkills.includes(skill);
                  return (
                    <div key={skill} style={styles.stat}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <div style={{ fontWeight: 800 }}>{skill}</div>
                        <div style={{ color: covered ? "#16825d" : "#c13a31", fontWeight: 800 }}>
                          {covered ? "Covered" : "Missing"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
