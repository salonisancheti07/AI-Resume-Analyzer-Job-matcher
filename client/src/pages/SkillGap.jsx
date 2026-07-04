import { useMemo, useState } from "react";
import { api } from "../api";

const roleOptions = [
  "AI Engineer",
  "ML Engineer",
  "Data Scientist",
  "Data Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Product Manager",
  "SDE",
];

function weeklyHoursToMode(hours) {
  if (hours >= 12) return "Accelerated";
  if (hours >= 7) return "Balanced";
  return "Lean";
}

function coverageTone(score) {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

function emptyArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SkillGap() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [targetRole, setTargetRole] = useState("AI Engineer");
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const planMode = useMemo(() => weeklyHoursToMode(weeklyHours), [weeklyHours]);

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload your resume first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("job_description", jd || `Target role: ${targetRole}`);

      const res = await api.skillGap(form);
      setAnalysis({
        ...res,
        requestedRole: targetRole,
        weeklyHours,
        planMode,
      });
    } catch (e) {
      setError(e.message || "Skill gap analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPlan = () => {
    if (!analysis) return;

    const lines = [
      `Skill Gap Report`,
      `Target role: ${analysis.target_role || analysis.requestedRole}`,
      `Coverage score: ${analysis.summary?.coverage_score || 0}%`,
      `Plan mode: ${analysis.planMode}`,
      `Weekly hours: ${analysis.weeklyHours}`,
      "",
      `Headline: ${analysis.ai_insights?.headline || ""}`,
      `Summary: ${analysis.ai_insights?.summary || ""}`,
      "",
      "Priority skills:",
      ...emptyArray(analysis.priority_skills).slice(0, 6).map((item) => `- ${item.skill} | ${item.time_to_learn_weeks} weeks | score ${item.priority_score}`),
      "",
      "Next steps:",
      ...emptyArray(analysis.ai_insights?.next_steps).map((item) => `- ${item}`),
      "",
      "Learning plan:",
      ...emptyArray(analysis.learning_plan).map((item) => `- ${item.phase}: ${item.focus} (${item.timeline}) - ${item.action}`),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(analysis.target_role || "skill-gap").toLowerCase().replace(/\s+/g, "-")}-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="pill-primary">
            <span>Skill Gap Intelligence</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Skill Gap Report</h1>
        <p className="max-w-3xl text-lg text-slate-600">
          Compare your resume against a target job, uncover the exact skills blocking interviews, and turn them into a tighter learning plan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="card-elevated sticky top-6 space-y-6 p-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Resume input</h3>
              <input
                id="skill-gap-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="skill-gap-input" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition hover:border-teal-400 hover:bg-teal-50">
                <span className="mb-2 text-4xl">📤</span>
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Upload your resume</p>
                    <p className="mt-1 text-xs text-slate-600">PDF format</p>
                  </div>
                )}
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Target role</label>
                <select className="select" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Weekly study hours: <span className="font-semibold">{weeklyHours}</span>
                <input
                  type="range"
                  min="4"
                  max="16"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="mt-2 text-xs text-slate-500">Plan mode: {planMode}</div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Job description</label>
                <textarea
                  className="textarea text-sm"
                  rows={8}
                  placeholder="Paste a job description for a more accurate gap report..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                />
              </div>
            </div>

            {error ? <div className="alert-danger">{error}</div> : null}

            <button onClick={handleAnalyze} disabled={loading || !file} className="btn-primary w-full">
              {loading ? "Analyzing skill gap..." : "Analyze skill gap"}
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {!analysis && !loading ? (
            <div className="card-elevated space-y-4 p-12 text-center">
              <span className="text-6xl">🧭</span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No report yet</h3>
                <p className="mt-1 text-slate-600">Upload a resume and optional JD to generate a real skill gap analysis from the API.</p>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="card-elevated p-5">
                  <div className="text-sm font-medium text-slate-600">Coverage score</div>
                  <div className={`mt-2 text-3xl font-bold ${coverageTone(analysis.summary?.coverage_score || 0)}`}>
                    {analysis.summary?.coverage_score || 0}%
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Role detected: {analysis.target_role || analysis.requestedRole}</div>
                </div>
                <div className="card-elevated p-5">
                  <div className="text-sm font-medium text-slate-600">Missing skills</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">{analysis.summary?.missing_skills_count || 0}</div>
                  <div className="mt-2 text-xs text-slate-500">Top focus: {analysis.summary?.next_best_focus || "N/A"}</div>
                </div>
                <div className="card-elevated p-5">
                  <div className="text-sm font-medium text-slate-600">Estimated pace</div>
                  <div className="mt-2 text-2xl font-bold text-indigo-600">{analysis.planMode}</div>
                  <div className="mt-2 text-xs text-slate-500">{analysis.weeklyHours} hours per week</div>
                </div>
              </div>

              <div className="card-elevated space-y-4 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{analysis.ai_insights?.headline || "Skill gap overview"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.ai_insights?.summary || "The system found role-fit gaps and next learning priorities."}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Strengths</div>
                    <div className="mt-3 space-y-2">
                      {emptyArray(analysis.ai_insights?.strengths).map((item) => (
                        <div key={item} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Risks</div>
                    <div className="mt-3 space-y-2">
                      {emptyArray(analysis.ai_insights?.risks).map((item) => (
                        <div key={item} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-900">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Next steps</div>
                    <div className="mt-3 space-y-2">
                      {emptyArray(analysis.ai_insights?.next_steps).map((item) => (
                        <div key={item} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Matched skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {emptyArray(analysis.matched_skills).length ? emptyArray(analysis.matched_skills).map((skill) => (
                      <span key={skill} className="pill-success">✓ {skill}</span>
                    )) : <div className="text-sm text-slate-500">No clear matched skills yet.</div>}
                  </div>
                </div>

                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Missing skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {emptyArray(analysis.missing_skills).length ? emptyArray(analysis.missing_skills).slice(0, 12).map((skill) => (
                      <span key={skill} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">{skill}</span>
                    )) : <div className="text-sm text-slate-500">No missing skills were detected.</div>}
                  </div>
                </div>
              </div>

              <div className="card-elevated space-y-4 p-6">
                <h3 className="text-lg font-semibold text-slate-900">Priority skills to close first</h3>
                <div className="space-y-3">
                  {emptyArray(analysis.priority_skills).slice(0, 6).map((item) => (
                    <div key={item.skill} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Priority #{item.priority}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">{item.skill}</div>
                          <div className="mt-2 text-sm text-slate-600">{item.rationale}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-indigo-600">{item.time_to_learn_weeks} weeks</div>
                          <div className="text-xs text-slate-500">Score {item.priority_score}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Learning plan</h3>
                  <div className="space-y-3">
                    {emptyArray(analysis.learning_plan).map((item, index) => (
                      <div key={`${item.phase}-${item.focus}`} className="flex gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">{index + 1}</div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.phase}: {item.focus}</div>
                          <div className="text-xs text-slate-500">{item.timeline}</div>
                          <div className="mt-1 text-sm text-slate-700">{item.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Courses and proof points</h3>
                  <div className="space-y-3">
                    {emptyArray(analysis.courses).slice(0, 6).map((course) => (
                      <a key={`${course.skill}-${course.title}`} href={course.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-teal-300">
                        <div className="text-xs uppercase tracking-wide text-slate-500">{course.provider} · {course.skill}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{course.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{course.duration}</div>
                      </a>
                    ))}
                    {!emptyArray(analysis.courses).length ? <div className="text-sm text-slate-500">No course recommendations available yet.</div> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Benchmark comparison</h3>
                  <div className="space-y-3">
                    {emptyArray(analysis.benchmark_comparison).slice(0, 8).map((item) => (
                      <div key={item.skill} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{item.skill}</div>
                            <div className="text-xs text-slate-500">{item.category}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-slate-700">You: {item.your_level}</div>
                            <div className="text-slate-500">Target: {item.benchmark_level}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-elevated space-y-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">Certification signals</h3>
                  <div className="space-y-3">
                    {emptyArray(analysis.certifications).map((item) => (
                      <div key={`${item.skill}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.skill}</div>
                        <div className="mt-2 text-sm text-slate-600">{item.reason}</div>
                      </div>
                    ))}
                    {!emptyArray(analysis.certifications).length ? <div className="text-sm text-slate-500">No certification suggestions yet.</div> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a href="/ai-studio" className="btn-primary">Open AI Studio</a>
                <button onClick={downloadPlan} className="btn-secondary">Download plan</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
