import { useEffect, useState } from "react";
import { api } from "../api";

const basePromptIdeas = [
  "Build me a practical 30-day sprint for my target role.",
  "What should I learn first, and what can I skip for now?",
  "Which portfolio projects would make me interview-ready faster?",
  "How should I rewrite my resume for this career switch?",
];

const roles = ["AI Engineer", "Data Scientist", "Data Engineer", "ML Engineer", "Product Manager", "Frontend + AI", "General"];

const emptyCoachState = {
  answer: "Tell me your target role, timeline, and current background. I will map a path for you.",
  careerPath: [],
  skillRoadmap: [],
  industryTrends: [],
  learningPlan: [],
  salaryPrediction: { range: "", note: "" },
  switchGuidance: [],
  dailyTip: "",
  habitBuilder: [],
  motivation: "",
  followUps: [],
  resources: [],
  timelines: [],
};

const cardTone = [
  "from-sky-50 to-white border-sky-100",
  "from-emerald-50 to-white border-emerald-100",
  "from-amber-50 to-white border-amber-100",
  "from-rose-50 to-white border-rose-100",
];

const CAREER_PROFILE_KEY = "resumeai_career_profile";
const CAREER_MEMORY_KEY = "resumeai_career_memory";

function buildCoachContext(profile, manualContext) {
  const parts = [
    profile.currentRole ? `Current role: ${profile.currentRole}` : "",
    profile.experience ? `Experience: ${profile.experience}` : "",
    profile.strengths ? `Strengths: ${profile.strengths}` : "",
    profile.dreamCompany ? `Target company: ${profile.dreamCompany}` : "",
    manualContext ? `Extra context: ${manualContext}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function buildPromptIdeas(role, profile) {
  const roleLabel = role || profile.currentRole || "my target role";
  return [
    `How can I transition into ${roleLabel} efficiently?`,
    `Build me a focused roadmap for becoming a strong ${roleLabel}.`,
    `Which projects should I build first for ${roleLabel}?`,
    ...basePromptIdeas,
  ].slice(0, 6);
}

export default function CareerCoach() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Tell me the career direction you want, how much time you have, and what background you are starting from." },
  ]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("AI Engineer");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [coachData, setCoachData] = useState(emptyCoachState);
  const [profile, setProfile] = useState({ name: "", currentRole: "", experience: "", dreamCompany: "", strengths: "" });
  const [timeline, setTimeline] = useState([]);
  const [memory, setMemory] = useState([]);

  useEffect(() => {
    try {
      const savedProfile = JSON.parse(localStorage.getItem(CAREER_PROFILE_KEY) || "null");
      if (savedProfile) setProfile(savedProfile);
      const savedMemory = JSON.parse(localStorage.getItem(CAREER_MEMORY_KEY) || "[]");
      if (savedMemory.length) {
        setMemory(savedMemory);
        setMessages((prev) => [...prev, ...savedMemory.slice(-4)]);
      }
    } catch {
      // ignore corruption
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CAREER_PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(CAREER_MEMORY_KEY, JSON.stringify(memory));
  }, [memory]);

  const saveProfile = (updates) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const ask = async (text) => {
    if (loading) return;
    const question = (text || input).trim();
    if (!question) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && lastMessage.content.trim() === question) return;

    const updated = [...messages, { role: "user", content: question }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    const composedContext = buildCoachContext(profile, context);

    const payload = {
      question,
      role,
      context: composedContext,
      profile,
      timeline,
      memory: memory.slice(-10),
      messages: updated.slice(-10),
    };

    try {
      const res = await api.careerCoach(payload);
      const answerText = res.answer || "Your career plan is ready. Please review the strategy below.";

      const nextCoachData = {
        answer: answerText,
        careerPath: res.careerPath || [],
        skillRoadmap: res.skillRoadmap || [],
        industryTrends: res.industryTrends || [],
        learningPlan: res.learningPlan || [],
        salaryPrediction: res.salaryPrediction || { range: "", note: "" },
        switchGuidance: res.switchGuidance || [],
        dailyTip: res.dailyTip || "",
        habitBuilder: res.habitBuilder || [],
        motivation: res.motivation || "",
        followUps: res.followUps || [],
        resources: res.resources || ["Utilize official docs, expert blogs, and weekly learning sprints"],
        timelines: res.timelines || ["Week 1-2: baseline skills. Week 3-4: project build..."],
      };

      setCoachData(nextCoachData);
      setMessages([...updated, { role: "assistant", content: answerText }]);
      setMemory((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: answerText }].slice(-20));
      setTimeline(nextCoachData.timelines);
    } catch (e) {
      const errorMsg = "Could not fetch advice: " + (e.message || "Network error");
      setMessages([...updated, { role: "assistant", content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="career-theme-page space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="pill">AI Career Copilot</div>
          <h2 className="text-2xl font-bold text-slate-900">Career Pro Assistant</h2>
        </div>
        <button
          onClick={() => {
            setRole(profile.currentRole || role || "AI Engineer");
            setContext(buildCoachContext(profile, ""));
          }}
          className="btn-secondary text-sm"
        >
          Sync from profile
        </button>
      </div>

      <div className="card p-5 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Your career profile memory</div>
          <input
            className="input"
            placeholder="Full name"
            value={profile.name}
            onChange={(e) => saveProfile({ name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Current role"
            value={profile.currentRole}
            onChange={(e) => saveProfile({ currentRole: e.target.value })}
          />
          <input
            className="input"
            placeholder="Years experience"
            value={profile.experience}
            onChange={(e) => saveProfile({ experience: e.target.value })}
          />
          <input
            className="input"
            placeholder="Dream company"
            value={profile.dreamCompany}
            onChange={(e) => saveProfile({ dreamCompany: e.target.value })}
          />
          <input
            className="input"
            placeholder="Top strengths (comma separated)"
            value={profile.strengths}
            onChange={(e) => saveProfile({ strengths: e.target.value })}
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Memory timeline</div>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
            {timeline.length === 0 ? (
              <div className="text-slate-500">No timeline yet. Start a session to create roadmap milestones.</div>
            ) : (
              timeline.map((item, idx) => (
                <div key={`${item}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card relative overflow-hidden p-6 bg-gradient-to-br from-slate-950 via-emerald-950 to-sky-950 text-white border-slate-800">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.45),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.32),_transparent_30%)]" />
        <div className="relative grid gap-4 md:grid-cols-4">
          {[
            { label: "Career path", value: role, note: "Mapped to your target" },
            { label: "Daily focus", value: coachData.dailyTip ? "Ready" : "Build plan", note: "Action for today" },
            { label: "Salary outlook", value: coachData.salaryPrediction?.range || "Estimate pending", note: "Market signal" },
            { label: "Momentum", value: coachData.habitBuilder?.length ? "Habits on" : "Needs routine", note: "Consistency builder" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-wide text-slate-300">{item.label}</div>
              <div className="mt-2 text-2xl font-bold">{item.value}</div>
              <div className="mt-1 text-xs text-slate-300">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5 md:col-span-2 h-[560px] flex flex-col gap-3">
          <div className="flex gap-2 items-center text-xs">
            <select className="input text-xs w-44" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <input
              className="input text-xs"
              placeholder="Context (e.g. 2y frontend, Python basics, aiming to switch in 6 months)"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-3 text-sm ${m.role === "assistant" ? "bg-white border border-slate-200 text-slate-800" : "bg-emerald-50 text-slate-900"}`}>
                <span className="font-semibold mr-2">{m.role === "assistant" ? "Coach" : "You"}:</span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
            {loading && <div className="text-sm text-slate-500">Building your career plan...</div>}
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Ask about paths, skills, switching careers, salary, learning plans..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <button className="btn-primary" onClick={() => ask()} disabled={loading}>
              Send
            </button>
          </div>
          {coachData.followUps?.length ? (
            <div className="flex flex-wrap gap-2">
              {coachData.followUps.map((item) => (
                <button key={item} className="btn-secondary text-xs" onClick={() => ask(item)} type="button" disabled={loading}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="card p-5 space-y-3">
            <div className="text-sm font-semibold">Suggested prompts</div>
            <div className="grid gap-2">
              {buildPromptIdeas(role, profile).map((p) => (
                <button
                  key={p}
                  className="text-left text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-300"
                  onClick={() => ask(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="grid gap-2 pt-1">
              <button className="btn-secondary text-sm" type="button" onClick={() => ask(`Create a 30-day sprint for becoming a better ${role}.`)} disabled={loading}>
                Generate 30-day sprint
              </button>
              <button className="btn-secondary text-sm" type="button" onClick={() => ask(`Audit my current profile and tell me the top three gaps blocking ${role} interviews.`)} disabled={loading}>
                Find top interview gaps
              </button>
            </div>
          </div>

          <div className="card p-5 bg-gradient-to-br from-amber-50 to-white border-amber-100">
            <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Motivation + Habit Builder</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{coachData.motivation || "Consistency creates career compounding."}</div>
            <div className="mt-3 space-y-2">
              {(coachData.habitBuilder || []).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl bg-white border border-amber-100 px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { title: "Career Path Recommendation", items: coachData.careerPath, tone: cardTone[0] },
          { title: "Skill Roadmap Generator", items: coachData.skillRoadmap, tone: cardTone[1] },
          { title: "Industry Trend Insights", items: coachData.industryTrends, tone: cardTone[2] },
          { title: "Personalized Learning Plan", items: coachData.learningPlan, tone: cardTone[3] },
        ].map((section) => (
          <div key={section.title} className={`card p-5 bg-gradient-to-br ${section.tone}`}>
            <div className="text-sm font-semibold">{section.title}</div>
            <div className="mt-3 space-y-2">
              {(section.items || []).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
              {!section.items?.length && <div className="text-xs text-slate-500">No suggestions yet. Ask the coach for a plan.</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <div className="text-sm font-semibold">Personalized Resource Hub</div>
          <div className="mt-3 space-y-2">
            {(coachData.resources || []).map((resource, idx) => (
              <div key={`${resource}-${idx}`} className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm text-purple-700">
                {resource}
              </div>
            ))}
            {!coachData.resources?.length && <div className="text-xs text-purple-500">Use the chat above to request high-quality learning links and toolkits.</div>}
          </div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-cyan-50 to-white border-cyan-100">
          <div className="text-sm font-semibold">Timeline Milestones</div>
          <div className="mt-3 space-y-2">
            {(coachData.timelines || []).map((item, idx) => (
              <div key={`${item}-${idx}`} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-cyan-700">
                {item}
              </div>
            ))}
            {!coachData.timelines?.length && <div className="text-xs text-cyan-500">Ask for a timeline to see week-by-week action items.</div>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <div className="text-sm font-semibold">Salary Prediction Tool</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{coachData.salaryPrediction?.range || "₹8-16 LPA"}</div>
          <div className="mt-2 text-sm text-slate-600">{coachData.salaryPrediction?.note || "Estimate improves with clearer experience and project depth."}</div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-rose-50 to-white border-rose-100">
          <div className="text-sm font-semibold">Switch Career Guidance</div>
          <div className="mt-3 space-y-2">
            {(coachData.switchGuidance || []).map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="text-sm font-semibold">Daily Career Tips</div>
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-white px-4 py-4 text-sm text-slate-700">
            {coachData.dailyTip || "Protect one small block of time every day for focused career progress."}
          </div>
        </div>
      </div>
    </div>
  );
}
