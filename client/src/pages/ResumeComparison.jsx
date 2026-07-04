import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const HISTORY_KEY = "resume-comparison-history";
const PREFILL_KEY = "resume-comparison-prefill";

const styles = {
  shell: {
    minHeight: "100vh",
    padding: "32px 24px 80px",
    color: "var(--app-ink)",
    fontFamily: "'Segoe UI', sans-serif",
  },
  hero: {
    maxWidth: 1200,
    margin: "0 auto 24px",
    padding: 28,
    borderRadius: 30,
    color: "var(--app-ink)",
    background: "var(--app-hero-bg)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
    border: "1px solid var(--app-border)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 18,
    alignItems: "end",
  },
  grid: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
  },
  panel: {
    background: "var(--app-panel)",
    backdropFilter: "blur(14px)",
    borderRadius: 24,
    padding: 22,
    border: "1px solid var(--app-border)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.28)",
    padding: "14px 16px",
    fontSize: 15,
    boxSizing: "border-box",
    background: "var(--app-surface)",
    color: "var(--app-ink)",
  },
  button: {
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    color: "#fff",
    background: "linear-gradient(135deg, var(--app-accent-dark), var(--app-accent))",
    boxShadow: "0 14px 24px rgba(15, 118, 110, 0.22)",
  },
  softButton: {
    border: "1px solid rgba(15, 118, 110, 0.18)",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    color: "var(--app-accent-dark)",
    background: "var(--app-surface)",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 800,
    color: "var(--app-muted)",
  },
  stat: {
    padding: 18,
    borderRadius: 20,
    background: "var(--app-surface)",
    border: "1px solid var(--app-border)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    margin: "0 8px 8px 0",
    background: "rgba(20, 184, 166, 0.12)",
    color: "var(--app-accent-dark)",
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(20, 184, 166, 0.14)",
  },
  warnPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    margin: "0 8px 8px 0",
    background: "rgba(249, 115, 22, 0.10)",
    color: "#c05621",
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(249, 115, 22, 0.14)",
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(43,57,108,0.10)",
    overflow: "hidden",
  },
  fileCard: {
    padding: 18,
    borderRadius: 20,
    border: "1px dashed rgba(15, 118, 110, 0.22)",
    background: "var(--app-surface)",
  },
  emptyPanel: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 28,
    borderRadius: 24,
    border: "1px dashed rgba(15, 118, 110, 0.18)",
    background: "var(--app-surface)",
    color: "var(--app-muted)",
  },
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueLower(values) {
  return Array.from(
    new Set(
      safeArray(values)
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function scoreSections(result) {
  const parsed = result?.parsed || {};
  const sections = {
    Skills: Math.min(uniqueLower(parsed.skills).length * 8, 100),
    Experience: Math.min(safeArray(parsed.experience).length * 24, 100),
    Projects: Math.min(safeArray(parsed.projects).length * 28, 100),
    Education: Math.min(safeArray(parsed.education).length * 34, 100),
  };
  return sections;
}

function normalizeResult(label, result, fileName) {
  const parsed = result?.parsed || {};
  const keywords = uniqueLower(parsed.skills?.length ? parsed.skills : result?.keywords);
  return {
    label,
    fileName,
    atsScore: Number(result?.ats_score || result?.score || 0),
    feedback: result?.feedback || "",
    summary: result?.ai_summary || "",
    keywords,
    sections: scoreSections(result),
    parsed,
  };
}

function compareKeywords(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return {
    shared: left.filter((item) => rightSet.has(item)),
    leftOnly: left.filter((item) => !rightSet.has(item)),
    rightOnly: right.filter((item) => !leftSet.has(item)),
  };
}

function buildCompareMetrics(leftKeywords, rightKeywords, compareData = null) {
  const shared = safeArray(compareData?.shared_skills).length
    ? uniqueLower(compareData.shared_skills)
    : compareKeywords(leftKeywords, rightKeywords).shared;
  const totalUnique = new Set([...leftKeywords, ...rightKeywords]).size;
  const overlapScore = totalUnique ? Math.round((shared.length / totalUnique) * 100) : 0;
  const similarityScore = typeof compareData?.similarity === "number"
    ? Math.round(compareData.similarity * 100)
    : overlapScore;

  return {
    similarityScore,
    overlapScore,
    shared,
    leftOnly: uniqueLower(compareData?.skills_only_a?.length ? compareData.skills_only_a : leftKeywords.filter((item) => !shared.includes(item))),
    rightOnly: uniqueLower(compareData?.skills_only_b?.length ? compareData.skills_only_b : rightKeywords.filter((item) => !shared.includes(item))),
  };
}

function winnerText(left, right) {
  if (!left || !right) return "";
  if (left.atsScore === right.atsScore) return "Both versions are equally strong on ATS score. Use keyword and section differences to decide.";
  return left.atsScore > right.atsScore
    ? `${left.label} is the stronger overall version for ATS and structure right now.`
    : `${right.label} is the stronger overall version for ATS and structure right now.`;
}

function buildImprovements(left, right, keywordComparison) {
  if (!left || !right) return [];
  const suggestions = [];
  if (left.atsScore > right.atsScore) {
    suggestions.push(`${right.label}: borrow formatting clarity and stronger keyword density from ${left.label}.`);
  } else if (right.atsScore > left.atsScore) {
    suggestions.push(`${left.label}: borrow formatting clarity and stronger keyword density from ${right.label}.`);
  }

  Object.keys(left.sections).forEach((section) => {
    if (left.sections[section] > right.sections[section]) {
      suggestions.push(`${right.label}: improve ${section.toLowerCase()} section depth to match ${left.label}.`);
    } else if (right.sections[section] > left.sections[section]) {
      suggestions.push(`${left.label}: improve ${section.toLowerCase()} section depth to match ${right.label}.`);
    }
  });

  if (keywordComparison.leftOnly.length) {
    suggestions.push(`${right.label}: consider adding ${keywordComparison.leftOnly.slice(0, 3).join(", ")} if they are true to your profile.`);
  }
  if (keywordComparison.rightOnly.length) {
    suggestions.push(`${left.label}: consider adding ${keywordComparison.rightOnly.slice(0, 3).join(", ")} if they are true to your profile.`);
  }

  return Array.from(new Set(suggestions)).slice(0, 6);
}

function buildMergePlan(left, right, keywordComparison) {
  if (!left || !right) return [];
  const stronger = left.atsScore >= right.atsScore ? left : right;
  const weaker = stronger === left ? right : left;
  const plan = [
    `Use ${stronger.label} as the base version because it currently has the stronger ATS score and structure.`,
  ];

  Object.keys(stronger.sections).forEach((section) => {
    if (weaker.sections[section] > stronger.sections[section]) {
      plan.push(`Pull the ${section.toLowerCase()} depth from ${weaker.label} into ${stronger.label}.`);
    }
  });

  if (keywordComparison.leftOnly.length) {
    plan.push(`Review these Resume A keywords for truthful additions: ${keywordComparison.leftOnly.slice(0, 4).join(", ")}.`);
  }
  if (keywordComparison.rightOnly.length) {
    plan.push(`Review these Resume B keywords for truthful additions: ${keywordComparison.rightOnly.slice(0, 4).join(", ")}.`);
  }

  if (stronger.summary && weaker.summary) {
    plan.push(`Keep the sharper summary framing from ${stronger.label}, but borrow any missing role-specific detail from ${weaker.label}.`);
  }

  return Array.from(new Set(plan)).slice(0, 6);
}

function buildFinalChecklist(left, right, keywordComparison) {
  if (!left || !right) return [];
  const base = left.atsScore >= right.atsScore ? left : right;
  const alternate = base === left ? right : left;
  const checklist = [
    `Start from ${base.label} as the master draft.`,
    `Keep the strongest ATS-friendly structure and formatting from ${base.label}.`,
  ];

  Object.keys(base.sections).forEach((section) => {
    if (alternate.sections[section] > base.sections[section]) {
      checklist.push(`Rewrite the ${section.toLowerCase()} section using stronger examples from ${alternate.label}.`);
    } else {
      checklist.push(`Retain the ${section.toLowerCase()} section from ${base.label} as the default version.`);
    }
  });

  if (keywordComparison.leftOnly.length || keywordComparison.rightOnly.length) {
    const combined = [...keywordComparison.leftOnly, ...keywordComparison.rightOnly].slice(0, 6);
    checklist.push(`Review these role keywords before finalizing: ${combined.join(", ")}.`);
  }

  checklist.push("Add one measurable result to the weakest experience bullet before exporting the final resume.");
  checklist.push("Re-run ATS analysis on the merged version to validate score improvement.");

  return Array.from(new Set(checklist)).slice(0, 8);
}

function sectionWinner(left, right, section) {
  if (!left || !right) return "";
  if (left.sections[section] === right.sections[section]) return "Tie";
  return left.sections[section] > right.sections[section] ? left.label : right.label;
}

export default function ResumeComparison() {
  const [resumeA, setResumeA] = useState(null);
  const [resumeB, setResumeB] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [resultA, setResultA] = useState(null);
  const [resultB, setResultB] = useState(null);
  const [compareMeta, setCompareMeta] = useState(null);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFILL_KEY);
      if (!raw) return;
      const prefill = JSON.parse(raw);
      if (prefill?.left && prefill?.right) {
        setResultA(prefill.left);
        setResultB(prefill.right);
        setJobDescription(prefill.jobDescription || "");
        setStatus("Loaded two saved resume analyses from history.");
        saveHistory({
          createdAt: prefill.createdAt || new Date().toISOString(),
          a: prefill.left.fileName,
          b: prefill.right.fileName,
          scoreA: prefill.left.atsScore,
          scoreB: prefill.right.atsScore,
          winner:
            prefill.left.atsScore === prefill.right.atsScore
              ? "Tie"
              : prefill.left.atsScore > prefill.right.atsScore
                ? prefill.left.label
                : prefill.right.label,
        });
      }
    } catch {
      // Ignore malformed prefill state and keep the manual upload flow available.
    } finally {
      localStorage.removeItem(PREFILL_KEY);
    }
  }, []);

  const comparison = useMemo(() => {
    if (!resultA || !resultB) return null;
    const keywords = buildCompareMetrics(resultA.keywords, resultB.keywords, compareMeta);
    return {
      keywords,
      suggestion: winnerText(resultA, resultB),
      improvements: buildImprovements(resultA, resultB, keywords),
      mergePlan: buildMergePlan(resultA, resultB, keywords),
      finalChecklist: buildFinalChecklist(resultA, resultB, keywords),
    };
  }, [compareMeta, resultA, resultB]);

  const saveHistory = (entry) => {
    const next = [entry, ...history].slice(0, 8);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Ignore local storage failures and keep the session result visible.
    }
  };

  const analyzeFile = async (file, label) => {
    const formData = new FormData();
    formData.append("resume", file);
    if (jobDescription.trim()) formData.append("job_description", jobDescription.trim());
    const result = await api.analyze(formData);
    return normalizeResult(label, result, file.name);
  };

  const compareFiles = async () => {
    const formData = new FormData();
    formData.append("file_a", resumeA);
    formData.append("file_b", resumeB);
    return api.compare(formData);
  };

  const handleCompare = async () => {
    if (!resumeA || !resumeB) {
      setStatus("Upload both resumes to compare them side by side.");
      return;
    }

    try {
      setIsComparing(true);
      setStatus("Comparing both resumes across ATS, similarity, keywords, and section strengths...");
      const [left, right, compareResult] = await Promise.all([
        analyzeFile(resumeA, "Resume A"),
        analyzeFile(resumeB, "Resume B"),
        compareFiles(),
      ]);
      setResultA(left);
      setResultB(right);
      setCompareMeta(compareResult);
      setStatus("Comparison ready.");
      saveHistory({
        createdAt: new Date().toISOString(),
        a: left.fileName,
        b: right.fileName,
        scoreA: left.atsScore,
        scoreB: right.atsScore,
        winner: left.atsScore === right.atsScore ? "Tie" : left.atsScore > right.atsScore ? left.label : right.label,
      });
    } catch (error) {
      setStatus(error?.message || "Comparison failed. Try valid PDF/DOCX resumes and retry.");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div style={styles.shell}>
      <div style={styles.hero}>
        <div style={styles.heroGrid}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--app-accent-dark)" }}>
              Resume Comparison
            </div>
            <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.03 }}>
              Put two resume versions head to head and keep the stronger one.
            </h1>
            <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.7, fontSize: 18, color: "var(--app-muted)" }}>
              Compare ATS score, keywords, section strength, and improvement opportunities with a cleaner side-by-side decision view.
            </p>
          </div>
          <div style={styles.panel}>
            <div style={{ fontSize: 13, color: "var(--app-accent-dark)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>What this page does</div>
            <div style={{ marginTop: 12, lineHeight: 1.8 }}>
              ATS score comparison, keyword overlap, section winner view, best version suggestion, highlight improvements, and version history.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          ...styles.grid,
          marginBottom: 20,
          gridTemplateColumns: comparison ? "minmax(0, 2fr) minmax(280px, 1fr)" : "1fr",
        }}
      >
        <div style={styles.panel}>
          <h2 style={{ marginTop: 0, fontSize: 24 }}>Upload two resume versions</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={styles.fileCard}>
              <label style={styles.label}>Resume A</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={styles.input}
                onChange={(e) => {
                  setResumeA(e.target.files?.[0] || null);
                  setResultA(null);
                  setResultB(null);
                  setCompareMeta(null);
                }}
              />
              <div style={{ marginTop: 12, color: "#55617d", lineHeight: 1.6 }}>
                {resumeA ? `Selected: ${resumeA.name}` : "Upload your first resume version."}
              </div>
            </div>
            <div style={styles.fileCard}>
              <label style={styles.label}>Resume B</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={styles.input}
                onChange={(e) => {
                  setResumeB(e.target.files?.[0] || null);
                  setResultA(null);
                  setResultB(null);
                  setCompareMeta(null);
                }}
              />
              <div style={{ marginTop: 12, color: "#55617d", lineHeight: 1.6 }}>
                {resumeB ? `Selected: ${resumeB.name}` : "Upload your second resume version."}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.label}>Optional target job description</label>
              <textarea
                style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste a JD to compare both resumes against the same target role."
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
            <button
              type="button"
              style={{
                ...styles.button,
                opacity: isComparing ? 0.7 : 1,
                cursor: isComparing ? "wait" : "pointer",
              }}
              onClick={handleCompare}
              disabled={isComparing}
            >
              {isComparing ? "Comparing..." : "Compare Resumes"}
            </button>
            <div style={{ color: "var(--app-muted)", fontWeight: 700 }}>{status}</div>
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Best Version Suggestion</h2>
          <div style={styles.stat}>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: "#40506e" }}>
              {comparison?.suggestion || "Run a comparison to see which version wins overall."}
            </div>
          </div>
        </div>
      </div>

      {!comparison ? (
        <div style={styles.emptyPanel}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--app-ink)", marginBottom: 10 }}>
            Compare two resume versions with one workflow
          </div>
          <div style={{ lineHeight: 1.8 }}>
            Upload Resume A and Resume B, optionally paste a target job description, then run the comparison to see ATS score differences, keyword overlap, section winners, merge guidance, and version history.
          </div>
        </div>
      ) : null}

      {resultA && resultB && comparison && (
        <>
          <div
            style={{
              ...styles.grid,
              marginBottom: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            {[resultA, resultB].map((result) => (
              <div key={result.label} style={styles.panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6d7896", textTransform: "uppercase", letterSpacing: "0.08em" }}>{result.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{result.fileName}</div>
                  </div>
                  <div style={{ ...styles.stat, minWidth: 110, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#6d7896", textTransform: "uppercase", letterSpacing: "0.08em" }}>ATS score</div>
                    <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>{result.atsScore}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={{ ...styles.progressTrack }}>
                    <div
                      style={{
                        width: `${result.atsScore}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "linear-gradient(90deg, #ff9246, #4558ff)",
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={styles.label}>AI summary</div>
                  <div style={{ color: "#40506e", lineHeight: 1.7 }}>
                    {result.summary || "No AI summary was returned for this version."}
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={styles.label}>Feedback snapshot</div>
                  <div style={{ color: "#40506e", lineHeight: 1.7 }}>
                    {result.feedback || "No recruiter feedback was returned for this version."}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              ...styles.grid,
              marginBottom: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            }}
          >
            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Resume Similarity</h2>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={styles.stat}>
                  <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Semantic similarity</div>
                  <div style={{ fontSize: 32, fontWeight: 900, marginTop: 6 }}>{comparison.keywords.similarityScore}%</div>
                  <div style={{ marginTop: 10, ...styles.progressTrack }}>
                    <div style={{ width: `${comparison.keywords.similarityScore}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #14b8a6, #4558ff)" }} />
                  </div>
                </div>
                <div style={styles.stat}>
                  <div style={{ color: "#5d6887", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>Shared keyword overlap</div>
                  <div style={{ fontSize: 32, fontWeight: 900, marginTop: 6 }}>{comparison.keywords.overlapScore}%</div>
                  <div style={{ marginTop: 8, color: "#57627f", lineHeight: 1.6 }}>
                    {comparison.keywords.shared.length} shared skills across both versions.
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>ATS Score Comparison</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {[resultA, resultB].map((result) => (
                  <div key={result.label} style={styles.stat}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{result.label}</div>
                    <div style={{ fontWeight: 900, color: "var(--app-accent-dark)" }}>{result.atsScore}%</div>
                    </div>
                    <div style={{ ...styles.progressTrack, marginTop: 12 }}>
                      <div
                        style={{
                          width: `${result.atsScore}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg, var(--app-accent), var(--app-accent-dark))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Keyword Comparison</h2>
              <div style={{ marginBottom: 12 }}>
                <div style={styles.label}>Shared keywords</div>
                <div>
                  {comparison.keywords.shared.length ? (
                    comparison.keywords.shared.map((item) => (
                      <span key={item} style={styles.pill}>{item}</span>
                    ))
                  ) : (
                    <div style={{ color: "#66728d" }}>No shared keywords were found.</div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={styles.label}>Only in Resume A</div>
                <div>
                  {comparison.keywords.leftOnly.length ? (
                    comparison.keywords.leftOnly.map((item) => (
                      <span key={item} style={styles.warnPill}>{item}</span>
                    ))
                  ) : (
                    <div style={{ color: "#66728d" }}>Resume A has no unique keywords.</div>
                  )}
                </div>
              </div>
              <div>
                <div style={styles.label}>Only in Resume B</div>
                <div>
                  {comparison.keywords.rightOnly.length ? (
                    comparison.keywords.rightOnly.map((item) => (
                      <span key={item} style={styles.warnPill}>{item}</span>
                    ))
                  ) : (
                    <div style={{ color: "#66728d" }}>Resume B has no unique keywords.</div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Section Strength Comparison</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {Object.keys(resultA.sections).map((section) => (
                  <div key={section} style={styles.stat}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>{section}</div>
                      <div style={{ color: "var(--app-accent-dark)", fontWeight: 800 }}>
                        Winner: {sectionWinner(resultA, resultB, section)}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: "#4b5878" }}>
                      {resultA.label}: {resultA.sections[section]} | {resultB.label}: {resultB.sections[section]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              ...styles.grid,
              marginBottom: 20,
              gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
            }}
          >
            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Highlight Improvements Needed</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {comparison.improvements.length ? (
                  comparison.improvements.map((item) => (
                    <div key={item} style={styles.stat}>{item}</div>
                  ))
                ) : (
                  <div style={styles.stat}>Both resumes are closely matched. Use the JD-specific wording and proof points to break the tie.</div>
                )}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Best of Both Merge View</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {comparison.mergePlan.map((item) => (
                  <div key={item} style={styles.stat}>{item}</div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              ...styles.grid,
              marginBottom: 20,
              gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
            }}
          >
            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Final Version Checklist</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {comparison.finalChecklist.map((item) => (
                  <div key={item} style={styles.stat}>{item}</div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Version History Tracking</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {history.length ? (
                  history.map((entry) => (
                    <div key={`${entry.createdAt}-${entry.a}-${entry.b}`} style={styles.stat}>
                      <div style={{ fontWeight: 800 }}>{entry.a} vs {entry.b}</div>
                      <div style={{ marginTop: 6, color: "#57627f", lineHeight: 1.7 }}>
                        {new Date(entry.createdAt).toLocaleString()} | A: {entry.scoreA}% | B: {entry.scoreB}% | Winner: {entry.winner}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={styles.stat}>Your recent comparison snapshots will appear here.</div>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  style={styles.softButton}
                  onClick={() => {
                    setHistory([]);
                    try {
                      localStorage.removeItem(HISTORY_KEY);
                    } catch {
                      // Ignore storage cleanup failures.
                    }
                  }}
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
