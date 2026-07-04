import { useState } from "react";
import { api } from "../api";

const toneInsights = {
  impactful: "Direct, metric-forward, and recruiter-friendly. Best for product, engineering, and growth roles.",
  concise: "Sharper and tighter language with less filler. Best when the resume feels too wordy.",
  leadership: "More ownership, decision-making, and strategic framing. Best for senior or people-facing roles.",
};

const industryAdvice = {
  General: {
    focus: "Lead with action + metric + outcome, and keep the first 6 lines easy to scan.",
    recruiter: "Show clear signal fast: role fit, measurable work, and section clarity.",
  },
  "Tech / Product": {
    focus: "Quantify system impact, ownership, velocity, and cross-functional collaboration.",
    recruiter: "Recruiters look for architecture, shipping velocity, and product/business context.",
  },
  "Data / ML": {
    focus: "Highlight datasets, experiments, model impact, latency, tooling, and deployment maturity.",
    recruiter: "Strong resumes show both analytics depth and measurable model or decision impact.",
  },
  Design: {
    focus: "Show UX outcomes, accessibility work, design systems, and product influence.",
    recruiter: "Recruiters want to see craft plus business/user outcome, not only visual deliverables.",
  },
  Consulting: {
    focus: "Emphasize client scope, stakeholder management, timelines, and cost/time improvements.",
    recruiter: "A reviewer scans for structured communication and measurable client impact.",
  },
  Finance: {
    focus: "Call out controls, compliance, forecasting, risk reduction, and direct commercial outcomes.",
    recruiter: "Finance reviewers want precision, credibility, and numbers they can trust quickly.",
  },
};

const detectSentenceStrength = (text) => {
  if (!text.trim()) return null;
  const weakPatterns = /(responsible for|helped|worked on|involved in|assisted|participated in)/i;
  const metricPattern = /\d+%|\d+\+? users|\d+\+? clients|\d+\+? ms|\d+\+? sec|\d+\+?x|\$\d+/i;
  const actionPattern = /^(built|led|designed|delivered|optimized|increased|reduced|launched|implemented|owned)/i;
  const hasWeak = weakPatterns.test(text);
  const hasMetric = metricPattern.test(text);
  const hasAction = actionPattern.test(text.trim());
  const score = 45 + (hasAction ? 20 : 0) + (hasMetric ? 25 : 0) - (hasWeak ? 20 : 0);
  return {
    score: Math.max(10, Math.min(95, score)),
    verdict: hasWeak ? "Weak" : hasMetric && hasAction ? "Strong" : "Needs sharpening",
    advice: hasWeak
      ? "Replace soft phrasing with direct ownership and a measurable result."
      : hasMetric && hasAction
      ? "Good signal. Keep it tight and front-load the result."
      : "Add one action verb and one metric to make the line stronger.",
  };
};

export default function ResumeFeedback() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState("impactful");
  const [rewrite, setRewrite] = useState("");
  const [rewriteResult, setRewriteResult] = useState("");
  const [industry, setIndustry] = useState("General");
  const [actionVerbInput, setActionVerbInput] = useState("");
  const [actionVerbOutput, setActionVerbOutput] = useState("");
  const [weakText, setWeakText] = useState("");
  const [projectText, setProjectText] = useState("");
  const [projectResult, setProjectResult] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const runFeedback = async () => {
    if (!file) {
      setError("Upload a resume");
      return;
    }
    setError("");
    setStatusMsg("");
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.feedback(form);
      setData(res);
      setStatusMsg("Reviewer simulation updated.");
    } catch (e) {
      setError(e.message || "Feedback failed");
    } finally {
      setLoading(false);
    }
  };

  const runRewrite = async (text = rewrite, kind = "rewrite") => {
    if (!text.trim()) {
      setStatusMsg("Paste text first.");
      return;
    }
    try {
      const res = await api.feedbackRewrite(text, tone);
      if (kind === "project") {
        setProjectResult(res.rewritten || "Rewrite unavailable.");
      } else {
        setRewriteResult(res.rewritten || "Rewrite unavailable.");
      }
      setStatusMsg("AI rewrite generated.");
    } catch (e) {
      if (kind === "project") {
        setProjectResult(`Rewrite failed: ${e.message}`);
      } else {
        setRewriteResult(`Rewrite failed: ${e.message}`);
      }
    }
  };

  const enhanceVerb = () => {
    if (!actionVerbInput.trim()) {
      setStatusMsg("Paste a sentence to enhance.");
      return;
    }
    const starters = ["Led", "Built", "Optimized", "Delivered", "Reduced", "Improved", "Launched"];
    const starter = starters[Math.floor(Math.random() * starters.length)];
    const clean = actionVerbInput.trim().replace(/^(responsible for|helped|worked on|assisted with)\s+/i, "");
    setActionVerbOutput(`${starter} ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`);
    setStatusMsg("Action-verb version generated.");
  };

  const sentenceStrength = detectSentenceStrength(weakText);
  const industryPanel = industryAdvice[industry] || industryAdvice.General;
  const recruiterFlash = data
    ? data.original_excerpt
      ? `10-second recruiter take: strong base, but the first impression improves fast if "${data.original_excerpt
          .slice(0, 90)
          .replace(/\s+/g, " ")}..." gets one metric and a sharper opening verb.`
      : "10-second recruiter take: the resume needs one visible metric and clearer top-of-page signal."
    : "Upload a resume to simulate what a recruiter notices in the first 10 seconds.";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="pill">Human-style review</div>
        <h2 className="text-2xl font-bold text-slate-900">Resume Feedback</h2>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold">Recruiter Simulation</div>
          <p className="mt-2 text-sm text-slate-700">See what a reviewer notices in the first 10 seconds.</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Tone Check</div>
          <p className="mt-2 text-sm text-slate-700">Pressure-test professionalism, confidence, and clarity.</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Sentence Quality</div>
          <p className="mt-2 text-sm text-slate-700">Spot weak bullets and upgrade them into sharper lines.</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-rose-50 to-white border-rose-100">
          <div className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Industry Lens</div>
          <p className="mt-2 text-sm text-slate-700">Tailor the feedback to the kind of recruiter reading it.</p>
        </div>
      </div>

      <div className="card p-5 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="text-sm font-semibold">Upload resume for review</div>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="flex flex-wrap gap-2">
            <button onClick={runFeedback} className="btn-primary" disabled={loading}>
              {loading ? "Reviewing..." : "Run reviewer feedback"}
            </button>
            <select className="text-xs border rounded px-2 py-1" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {Object.keys(industryAdvice).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {statusMsg && <p className="text-emerald-700 text-sm">{statusMsg}</p>}
        </div>
        <div className="card p-4 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <div className="text-xs uppercase tracking-wide text-sky-200">AI Recruiter Feedback Simulation</div>
          <p className="mt-3 text-sm leading-6 text-slate-100">{recruiterFlash}</p>
        </div>
      </div>

      {data && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Readability Score</div>
              <div className="text-4xl font-bold text-indigo-700">{data.readability}</div>
              <div className="text-xs text-slate-600">Flesch-style readability proxy. Higher means easier to skim quickly.</div>
            </div>
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Tone and Professionalism Check</div>
              <div className="text-sm text-slate-700">{toneInsights[tone]}</div>
              <div className="flex gap-2 text-xs">
                {["impactful", "concise", "leadership"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`px-3 py-1 rounded-full border ${
                      tone === item ? "bg-indigo-700 text-white border-indigo-700" : "border-slate-200 text-slate-700"
                    }`}
                    onClick={() => setTone(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Custom Feedback by Industry</div>
              <div className="text-xs text-slate-700">{industryPanel.focus}</div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                Recruiter lens: {industryPanel.recruiter}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Bullet Point Improvement Tool</div>
              <ul className="space-y-2 text-sm text-slate-700">
                {(data.bullets || []).map((bullet, index) => (
                  <li key={`${bullet}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Instant Rewrite Suggestions</div>
              <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
                {data.sample_rewrite}
              </pre>
            </div>
          </div>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="text-sm font-semibold">Weak vs Strong Sentence Detection</div>
          <textarea
            className="input text-sm"
            rows={3}
            placeholder="Paste a bullet or sentence to score its strength"
            value={weakText}
            onChange={(e) => setWeakText(e.target.value)}
          />
          {sentenceStrength ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-700">
                <span>{sentenceStrength.verdict}</span>
                <span>{sentenceStrength.score}/100</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    sentenceStrength.score >= 80 ? "bg-emerald-500" : sentenceStrength.score >= 60 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${sentenceStrength.score}%` }}
                />
              </div>
              <div className="text-xs text-slate-600">{sentenceStrength.advice}</div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">No sentence checked yet.</div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="text-sm font-semibold">Action Verb Enhancer</div>
          <textarea
            className="input text-sm"
            rows={3}
            placeholder="Paste a soft or generic bullet to strengthen"
            value={actionVerbInput}
            onChange={(e) => setActionVerbInput(e.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={enhanceVerb}>
            Enhance with action verbs
          </button>
          {actionVerbOutput && (
            <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
              {actionVerbOutput}
            </pre>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="text-sm font-semibold">Project Description Improver</div>
          <textarea
            className="input text-sm"
            rows={4}
            placeholder="Paste a project description to make it more outcome-driven"
            value={projectText}
            onChange={(e) => setProjectText(e.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={() => runRewrite(projectText, "project")}>
            Improve project description
          </button>
          {projectResult && (
            <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
              {projectResult}
            </pre>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="text-sm font-semibold">One-click Rewrite Studio</div>
          <textarea
            className="input text-sm"
            rows={4}
            placeholder="Paste any resume bullet, summary line, or experience statement"
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
          />
          <button className="btn-primary" type="button" onClick={() => runRewrite(rewrite, "rewrite")}>
            Generate rewrite suggestion
          </button>
          {rewriteResult && (
            <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
              {rewriteResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
