import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const KEY = "resumeai_interview_prefill";
const EMPTY = { totals: { mockTurns: 0, evaluations: 0, questionBanks: 0 }, averageScore: 0, recent: [] };
const MODES = [
  { id: "technical", label: "Technical", icon: "01", short: "Systems, debugging, architecture", prompt: "Focus on technical questions, architecture, debugging, and trade-offs.", starter: ["Walk me through a recent project you built end to end.", "Describe a production bug you investigated and fixed.", "How would you improve the performance of a slow system?", "What trade-offs did you make in a real technical decision?"], tip: "Show context, constraints, your decisions, and the outcome." },
  { id: "behavioral", label: "Behavioral", icon: "02", short: "Ownership, conflict, ambiguity", prompt: "Focus on behavioral and ownership questions using STAR.", starter: ["Tell me about a time you handled ambiguity under pressure.", "Describe a conflict with a teammate and how you handled it.", "Tell me about a failure that changed how you work.", "Share a project where you took ownership beyond your role."], tip: "Use STAR and end with a measurable result." },
  { id: "coding", label: "Coding", icon: "03", short: "Talk-through, complexity, edge cases", prompt: "Focus on coding-style talk-through, complexity, and edge cases.", starter: ["How do you start solving a coding problem before writing code?", "How do you explain time and space complexity in interviews?", "What do you do when you get stuck in a coding round?", "How do you test edge cases aloud during a live problem?"], tip: "Clarify the problem, say the brute force path, optimize, then test." },
  { id: "hr", label: "HR", icon: "04", short: "Motivation, fit, confidence", prompt: "Focus on recruiter and HR questions like motivation, fit, and salary.", starter: ["Tell me about yourself in a concise and polished way.", "Why do you want this role and this company?", "What are your strengths and your current growth area?", "How do you discuss salary expectations confidently?"], tip: "Keep answers concise, specific, and clearly aligned to the role." },
];
const FRAMEWORKS = [
  { title: "STAR", body: "Situation, Task, Action, Result" },
  { title: "CARE", body: "Context, Action, Result, Evolution" },
  { title: "Deep Dive", body: "Problem, Constraints, Solution, Trade-offs, Outcome" },
];

const safe = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };
const parseBank = (v) => String(v || "").split(/\r?\n/).map((x) => x.trim()).filter((x) => /^\d+\./.test(x)).map((x) => x.replace(/^\d+\.\s*/, "")).filter(Boolean);
const textBank = (list = []) => list.map((q, i) => `${i + 1}. ${q}`).join("\n");
const answerMeta = (value = "") => {
  const text = String(value || "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  const metric = /\d+%|\d+x|\d+\s?(ms|sec|seconds|minutes|users|customers|₹|\$)/i.test(text);
  const structure = /(situation|task|action|result|problem|outcome|trade-off|constraint)/i.test(text);
  return { words, metric, structure };
};
const scoreTone = (score) => score >= 85 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : score >= 70 ? "border-teal-200 bg-teal-50 text-teal-700" : "border-amber-200 bg-amber-50 text-amber-700";

export default function InterviewPrep() {
  const [role, setRole] = useState("ML Engineer");
  const [company, setCompany] = useState("Any");
  const [jobDescription, setJobDescription] = useState("");
  const [modeId, setModeId] = useState("technical");
  const [questionBank, setQuestionBank] = useState("");
  const [answers, setAnswers] = useState({});
  const [evaluation, setEvaluation] = useState(null);
  const [activity, setActivity] = useState(EMPTY);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mode = useMemo(() => MODES.find((item) => item.id === modeId) || MODES[0], [modeId]);
  const questions = useMemo(() => parseBank(questionBank), [questionBank]);
  const answered = useMemo(() => Object.values(answers).filter((x) => String(x || "").trim()).length, [answers]);
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  useEffect(() => {
    const prefill = safe(localStorage.getItem(KEY) || "null", null);
    if (!prefill) return;
    setRole(prefill.role || "ML Engineer");
    setCompany(prefill.company || "Any");
    setJobDescription(prefill.jd || "");
    setQuestionBank(prefill.questions?.length ? textBank(prefill.questions) : "");
    setNotice(prefill.source === "job-matcher" ? "Interview prep was prefilled from the selected job." : "Interview prep context was restored.");
    localStorage.removeItem(KEY);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingActivity(true);
      try {
        const res = await api.interviewActivitySummary();
        if (active) setActivity({ totals: res?.totals || EMPTY.totals, averageScore: res?.averageScore || 0, recent: Array.isArray(res?.recent) ? res.recent : [] });
      } catch {
        if (active) setActivity(EMPTY);
      } finally {
        if (active) setLoadingActivity(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const refreshActivity = async () => {
    try {
      const res = await api.interviewActivitySummary();
      setActivity({ totals: res?.totals || EMPTY.totals, averageScore: res?.averageScore || 0, recent: Array.isArray(res?.recent) ? res.recent : [] });
    } catch {}
  };

  const logActivity = async (payload) => {
    try {
      await api.interviewActivity(payload);
      await refreshActivity();
    } catch {}
  };

  const applyMode = (nextMode) => {
    setModeId(nextMode.id);
    setQuestionBank(textBank(nextMode.starter));
    setAnswers({});
    setEvaluation(null);
    setNotice(`${nextMode.label} practice set loaded.`);
    setError("");
  };

  const generateQuestions = async () => {
    if (!jobDescription.trim() && !role.trim()) {
      setError("Add a role or a job description to generate tailored interview questions.");
      return;
    }
    setLoadingQuestions(true);
    setError("");
    setNotice("");
    try {
      const prompt = [jobDescription.trim(), `Practice mode: ${mode.prompt}`].filter(Boolean).join("\n\n");
      const res = await api.interviewQuestions(prompt, role, company);
      const nextBank = res?.questions || "";
      setQuestionBank(nextBank);
      setAnswers({});
      setEvaluation(null);
      setNotice(`${mode.label} questions are ready.`);
      await logActivity({ type: "question_bank", role, company, detail: `Generated a ${mode.label.toLowerCase()} question bank.`, answersCount: parseBank(nextBank).length });
    } catch (err) {
      setError(err.message || "Question generation failed.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const evaluateAnswers = async () => {
    const filled = questions.map((question, index) => ({ question, answer: answers[index] || "" })).filter((item) => item.answer.trim());
    if (!filled.length) {
      setError("Write at least one answer before requesting feedback.");
      return;
    }
    setLoadingEvaluation(true);
    setError("");
    setNotice("");
    try {
      const res = await api.interviewEvaluate({ role, company, questions: filled.map((x) => x.question), answers: filled.map((x) => x.answer) });
      setEvaluation(res);
      setNotice("AI evaluation is ready below.");
      await logActivity({ type: "evaluation", role, company, detail: `Evaluated ${mode.label.toLowerCase()} answers.`, score: res?.overall_score || 0, answersCount: filled.length });
    } catch (err) {
      setError(err.message || "Evaluation failed.");
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const saveDraft = async () => {
    localStorage.setItem(KEY, JSON.stringify({ jd: jobDescription, role, company, questions, source: "interview-prep", createdAt: new Date().toISOString() }));
    setNotice("Interview draft saved locally in this browser.");
    await logActivity({ type: "mock_turn", role, company, detail: `Saved a ${mode.label.toLowerCase()} draft with ${answered} answer${answered === 1 ? "" : "s"}.`, answersCount: answered });
  };

  const clearAll = () => {
    setQuestionBank("");
    setAnswers({});
    setEvaluation(null);
    setError("");
    setNotice("Interview workspace cleared.");
  };

  return (
    <div className="interview-theme-page space-y-8">
      <section className="interview-hero overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,_#fff8ef_0%,_#fffaf5_36%,_#f1f5f9_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">Interview Prep Studio</div>
            <div>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900">Sharpen real interview answers, not just question lists.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">The page now uses a cleaner workspace style with guided tracks, a better writing flow, and easier-to-scan feedback.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="interview-light-card rounded-3xl border border-white bg-white/90 px-4 py-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Questions</div><div className="mt-2 text-3xl font-bold text-slate-900">{questions.length}</div></div>
              <div className="interview-light-card rounded-3xl border border-white bg-white/90 px-4 py-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Progress</div><div className="mt-2 text-3xl font-bold text-slate-900">{progress}%</div></div>
              <div className="interview-light-card rounded-3xl border border-white bg-white/90 px-4 py-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Average Score</div><div className="mt-2 text-3xl font-bold text-slate-900">{activity.averageScore || 0}</div></div>
            </div>
          </div>
          <div className="interview-light-card rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Current Focus</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div><div className="text-2xl font-semibold text-slate-900">{mode.label} Round</div><div className="mt-1 text-sm text-slate-600">{mode.short}</div></div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white">{mode.icon}</div>
            </div>
            <div className="mt-5 rounded-3xl bg-slate-950 px-4 py-4 text-sm text-slate-100"><div className="font-semibold text-white">Coach cue</div><div className="mt-2 leading-6 text-slate-300">{mode.tip}</div></div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-elevated p-6">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 1</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Choose A Practice Track</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Each track loads its own starter bank and coaching style.</p></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {MODES.map((item) => {
              const active = item.id === mode.id;
              return (
                <button key={item.id} type="button" onClick={() => applyMode(item)} className={`rounded-[28px] border p-5 text-left transition-all duration-200 ${active ? "border-slate-900 bg-slate-900 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]" : "interview-light-card border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] text-slate-900 hover:-translate-y-0.5 hover:shadow-lg"}`}>
                  <div className="flex items-center justify-between gap-3"><div className={`text-xs font-semibold uppercase tracking-[0.22em] ${active ? "text-slate-300" : "text-slate-400"}`}>{item.icon}</div><div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>{active ? "Selected" : "Preset"}</div></div>
                  <div className="mt-6 text-xl font-semibold">{item.label}</div>
                  <div className={`mt-2 text-sm leading-6 ${active ? "text-slate-300" : "text-slate-600"}`}>{item.short}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="card-elevated p-6">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Guide</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Answer Frameworks</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">A cleaner reference area for structuring responses while you write.</p></div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {FRAMEWORKS.map((item) => <div key={item.title} className="interview-light-card rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#fff,_#f8fafc)] p-4"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.title}</div><div className="mt-3 text-base font-semibold text-slate-900">{item.body}</div></div>)}
          </div>
          <div className="interview-light-highlight mt-5 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,_#fff7ed,_#fffbeb)] p-5"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">Coach Checklist</div><div className="mt-4 grid gap-2 text-sm leading-6 text-amber-950"><div>• Lead with the result or impact.</div><div>• Use one metric, tool, or proof point.</div><div>• Make your contribution explicit.</div><div>• Keep most answers tight unless depth is needed.</div></div></div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card-elevated p-6">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 2</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Set The Interview Context</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Paste the JD or round brief, then generate a better question bank for the selected track.</p></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Target role</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="ML Engineer" /></label>
            <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Company</span><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Any" /></label>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-700">Job description or interview brief</span>
            <textarea className="textarea min-h-[240px]" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the JD, recruiter note, or round details here..." />
          </label>
          <div className="interview-light-card mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active Prompt Shape</div><div className="mt-2 text-sm leading-6 text-slate-600">{mode.prompt}</div></div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={generateQuestions} disabled={loadingQuestions} className="btn-primary">{loadingQuestions ? "Generating..." : "Generate questions"}</button>
            <button onClick={saveDraft} className="btn-secondary">Save draft</button>
            <button onClick={clearAll} className="btn-ghost">Clear</button>
          </div>
          {error ? <div className="mt-4 alert-danger">{error}</div> : null}
          {notice ? <div className="mt-4 alert-success">{notice}</div> : null}
        </div>
        <div className="card-elevated p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 3</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Draft Answers In One Scroll</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">The editor is cleaner now, with answer quality hints built into each question card.</p></div>
            <div className="pill-secondary">{answered} / {questions.length || 0} completed</div>
          </div>
          <textarea className="mt-6 textarea min-h-[170px]" value={questionBank} onChange={(e) => { setQuestionBank(e.target.value); setEvaluation(null); }} placeholder={"1. Tell me about...\n2. Walk me through...\n3. Explain..."} />
          {!questions.length ? (
            <div className="mt-5 empty-state p-10 text-center">
              <div className="text-5xl">🎯</div>
              <div className="mt-3 text-lg font-semibold text-slate-900">No questions yet</div>
              <div className="mt-1 text-sm text-slate-600">Pick a track or generate a fresh bank from your interview context.</div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {questions.map((question, index) => {
                const meta = answerMeta(answers[index] || "");
                return (
                  <div key={`${index}-${question}`} className="interview-light-card rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Question {index + 1}</div><div className="mt-2 text-base font-semibold leading-7 text-slate-900">{question}</div></div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">{meta.words} words</span>
                        <span className={`rounded-full border px-3 py-1 ${meta.metric ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>{meta.metric ? "Has metric" : "Add metric"}</span>
                        <span className={`rounded-full border px-3 py-1 ${meta.structure ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500"}`}>{meta.structure ? "Structured" : "Add structure"}</span>
                      </div>
                    </div>
                    <textarea className="mt-4 textarea min-h-[150px] bg-white" value={answers[index] || ""} onChange={(e) => setAnswers((cur) => ({ ...cur, [index]: e.target.value }))} placeholder="Draft your answer. Lead with impact, explain your contribution, and close with the outcome." />
                    <div className="mt-3 text-xs text-slate-500">Coach tip: {mode.tip}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={evaluateAnswers} disabled={!questions.length || loadingEvaluation} className="btn-primary">{loadingEvaluation ? "Evaluating..." : "Evaluate answers"}</button>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">Progress: <span className="font-semibold text-slate-900">{progress}%</span></div>
          </div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-elevated p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 4</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Review AI Feedback</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Feedback cards are cleaner and easier to scan for strengths, misses, and stronger rewrites.</p></div>
            {evaluation?.overall_score ? <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${scoreTone(evaluation.overall_score)}`}>Overall {evaluation.overall_score}/100</div> : null}
          </div>
          {!evaluation ? (
            <div className="mt-6 empty-state p-10 text-center">
              <div className="text-5xl">🧠</div>
              <div className="mt-3 text-lg font-semibold text-slate-900">No evaluation yet</div>
              <div className="mt-1 text-sm text-slate-600">Write one or more answers and run feedback to unlock this section.</div>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Overall Feedback</div><p className="mt-3 text-sm leading-6 text-slate-700">{evaluation.overall_feedback || "Your evaluation is ready."}</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Strengths</div><div className="mt-3 space-y-2 text-sm leading-6 text-emerald-950">{(evaluation.strengths || []).map((item) => <div key={item}>• {item}</div>)}</div></div>
                <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Improve Next</div><div className="mt-3 space-y-2 text-sm leading-6 text-amber-950">{(evaluation.improvements || []).map((item) => <div key={item}>• {item}</div>)}</div></div>
              </div>
              <div className="space-y-4">
                {(evaluation.evaluations || []).map((item, index) => (
                  <div key={`${index}-${item.summary || "eval"}`} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-base font-semibold text-slate-900">Answer Review #{index + 1}</div><div className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreTone(item.score || 0)}`}>{item.score || 0}/100</div></div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary}</p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Strengths</div><div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{(item.strengths || []).map((entry) => <div key={entry}>• {entry}</div>)}</div></div>
                      <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Improvements</div><div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{(item.improvements || []).map((entry) => <div key={entry}>• {entry}</div>)}</div></div>
                    </div>
                    {item.rewritten_answer ? <div className="mt-4 rounded-[24px] border border-indigo-100 bg-indigo-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Stronger Version</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-indigo-950">{item.rewritten_answer}</p></div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card-elevated p-6">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">History</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">Recent Interview Activity</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">A cleaner activity feed so the page feels useful after every session.</p></div>
          {loadingActivity ? (
            <div className="mt-6 space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-[24px] border border-slate-200 p-4"><div className="skeleton-line h-4 w-2/3" /><div className="mt-3 skeleton-line h-3 w-full" /></div>)}</div>
          ) : !activity.recent.length ? (
            <div className="mt-6 empty-state p-10 text-center">
              <div className="text-5xl">📈</div>
              <div className="mt-3 text-lg font-semibold text-slate-900">No activity yet</div>
              <div className="mt-1 text-sm text-slate-600">Generate a bank, save a draft, or evaluate answers to build your history.</div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {activity.recent.map((item) => (
                <div key={item.id} className="interview-light-card rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-900">{(item.role || "General role")}{item.company && item.company !== "Any" ? ` • ${item.company}` : ""}</div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{String(item.type || "mock_turn").replace(/_/g, " ")}</div></div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail || "Interview activity recorded."}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">{item.score ? <span className="interview-chip rounded-full bg-white px-3 py-1">Score {item.score}</span> : null}{item.answersCount ? <span className="interview-chip rounded-full bg-white px-3 py-1">{item.answersCount} answers</span> : null}<span className="interview-chip rounded-full bg-white px-3 py-1">{new Date(item.createdAt).toLocaleString()}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
