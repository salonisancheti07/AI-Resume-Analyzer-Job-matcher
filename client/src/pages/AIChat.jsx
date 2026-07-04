import { useEffect, useState } from "react";
import { api } from "../api";

const CHAT_RESUME_KEY = "ai_chat_resume_context";

const quickPrompts = [
  "Explain my resume feedback in simple language.",
  "Customize my resume for a machine learning engineer JD.",
  "Rewrite my summary to sound stronger.",
  "What should I improve first to get more interviews?",
];

const modes = [
  { id: "resume", label: "Ask About Resume" },
  { id: "customize", label: "JD Customization" },
  { id: "feedback", label: "Explain Feedback" },
  { id: "career", label: "Career Q&A" },
];

const languages = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"];
const roles = ["General", "AI Engineer", "Data Scientist", "Data Engineer", "ML Engineer", "Product Manager", "SDE", "DevOps"];

function mapModeToBackend(mode) {
  if (mode === "customize") return "job-match";
  if (mode === "feedback") return "resume";
  if (mode === "career") return "career";
  return "resume";
}

function buildChatContext({ resumeText, jobDescription, role, language, explainSimple, mode }) {
  const modeLabel = modes.find((item) => item.id === mode)?.label || "Resume chat";
  const parts = [
    `Requested mode: ${modeLabel}`,
    `Target role: ${role || "General"}`,
    `Reply language: ${language || "English"}`,
    explainSimple ? "Use simple everyday language." : "Use normal professional language.",
    resumeText ? `Resume context:\n${resumeText}` : "",
    jobDescription ? `Job description:\n${jobDescription}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

function buildFallbackFollowUps(mode, hasResume, hasJD) {
  if (mode === "customize" || hasJD) {
    return [
      "Show me the top missing keywords for this JD.",
      "Rewrite my summary for this role.",
      "Which bullets should I move to the top?",
    ];
  }
  if (mode === "feedback") {
    return [
      "Explain the top weaknesses more simply.",
      "Rewrite my weakest bullet.",
      "What should I fix first for interviews?",
    ];
  }
  if (mode === "career") {
    return [
      "What skills should I learn next?",
      "Which projects will help me most?",
      "What roles should I target now?",
    ];
  }
  if (hasResume) {
    return [
      "What are the top problems in my resume?",
      "Rewrite my experience bullets for more impact.",
      "How ATS-friendly is this resume?",
    ];
  }
  return quickPrompts.slice(0, 3);
}

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I can help you improve your resume, explain feedback simply, tailor it to a JD, answer career questions, and chat in multiple languages. Upload a resume or ask anything to begin.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState("General");
  const [mode, setMode] = useState("resume");
  const [language, setLanguage] = useState("English");
  const [explainSimple, setExplainSimple] = useState(true);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeSummary, setResumeSummary] = useState(null);
  const [followUps, setFollowUps] = useState(quickPrompts.slice(0, 3));
  const [uploadName, setUploadName] = useState("");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(CHAT_RESUME_KEY) || "null");
    if (!stored) return;
    setResumeText(stored.resumeText || "");
    setResumeSummary(stored.resumeSummary || null);
    setUploadName(stored.uploadName || "");
  }, []);

  const persistResumeContext = (next) => {
    localStorage.setItem(CHAT_RESUME_KEY, JSON.stringify(next));
  };

  const clearResumeContext = () => {
    localStorage.removeItem(CHAT_RESUME_KEY);
    setResumeText("");
    setResumeSummary(null);
    setUploadName("");
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Resume context cleared. Upload another resume whenever you want resume-specific help." },
    ]);
  };

  const send = async (prompt) => {
    const userMsg = (prompt || input).trim();
    if (!userMsg) return;
    const updated = [...messages, { role: "user", content: userMsg }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await api.aiChatSend(
        updated,
        buildChatContext({
          resumeText,
          jobDescription,
          role,
          language,
          explainSimple,
          mode,
        }),
        mapModeToBackend(mode)
      );
      setMessages([...updated, { role: "assistant", content: res.content || "I could not generate a reply." }]);
      setFollowUps(buildFallbackFollowUps(mode, !!resumeText.trim(), !!jobDescription.trim()));
    } catch (e) {
      setMessages([...updated, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const uploadResume = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.aiResumeContextUpload(form);
      setResumeText(res.resume_text || "");
      setResumeSummary(res.summary || null);
      setUploadName(file.name);
      persistResumeContext({
        resumeText: res.resume_text || "",
        resumeSummary: res.summary || null,
        uploadName: file.name,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Resume uploaded. I can now answer questions about ${file.name}, tailor it for a job description, explain feedback in simple language, and suggest edits in ${language}.`,
        },
      ]);
      setFollowUps([
        "What are the top problems in my resume?",
        "Customize my resume for this JD.",
        "Rewrite my experience bullets for more impact.",
      ]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Resume upload failed: ${e.message}` }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="aichat-theme-page space-y-5">
      <div className="flex items-center gap-3">
        <div className="pill">Interactive AI assistant</div>
        <h2 className="text-2xl font-bold text-slate-900">AI Resume Chat</h2>
      </div>

      <div className="card relative overflow-hidden p-5 bg-gradient-to-br from-orange-50 via-white to-sky-50 border-orange-100">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.16),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.14),_transparent_30%)]" />
        <div className="relative grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white/80 border border-white p-4">
            <div className="text-xs uppercase tracking-wide text-orange-700 font-semibold">Upload Resume & Chat</div>
            <input
              type="file"
              accept=".pdf"
              className="mt-3 text-sm"
              onChange={(e) => uploadResume(e.target.files?.[0] || null)}
            />
            <div className="mt-3 text-xs text-slate-600">
              {uploading ? "Uploading and parsing resume..." : uploadName ? `Loaded: ${uploadName}` : "Upload PDF resume for resume-aware answers."}
            </div>
            {uploadName ? (
              <button type="button" className="mt-3 btn-secondary text-xs" onClick={clearResumeContext}>
                Clear uploaded resume
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl bg-white/80 border border-white p-4">
            <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold">Chat Mode</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`rounded-full px-3 py-1 text-xs border ${mode === item.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 border border-white p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Multi-language</div>
            <div className="mt-3 flex gap-2">
              <select className="input text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select className="input text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 border border-white p-4">
            <div className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Explain Simply</div>
            <button
              type="button"
              onClick={() => setExplainSimple((prev) => !prev)}
              className={`mt-3 rounded-full px-3 py-1 text-xs border ${explainSimple ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-700 border-slate-200"}`}
            >
              {explainSimple ? "Simple language on" : "Simple language off"}
            </button>
            <div className="mt-3 text-xs text-slate-600">Useful for feedback explanation and beginner-friendly career Q&A.</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5 md:col-span-2 h-[620px] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Resume + Career Chatbot</div>
              <div className="text-xs text-slate-500">Ask anything, edit in chat, tailor for JD, and get follow-up suggestions.</div>
            </div>
            <div className="pill bg-slate-100 text-slate-700">{language}</div>
          </div>
          <div className="flex-1 overflow-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "assistant" ? "bg-white text-slate-800 border border-slate-200" : "bg-orange-100 text-slate-900"}`}>
                <span className="font-semibold mr-2">{m.role === "assistant" ? "AI" : "You"}:</span>
                {m.content}
              </div>
            ))}
            {loading && <div className="text-sm text-slate-500">Thinking through your resume and context...</div>}
          </div>
          <textarea
            className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm"
            rows={3}
            placeholder="Ask anything about your resume, career path, JD tailoring, feedback, or editing..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => send()} className="btn-primary" disabled={loading}>
              Send
            </button>
            {followUps.map((item) => (
              <button key={item} type="button" onClick={() => send(item)} className="btn-secondary text-xs">
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="text-sm font-semibold">JD to Resume Customization</div>
            <textarea
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              rows={8}
              placeholder="Paste a job description here and ask the chat to customize your resume for it."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <div className="text-xs text-slate-500">The assistant will use this JD inside the conversation context.</div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="text-sm font-semibold">Resume Snapshot</div>
            {resumeSummary ? (
              <div className="space-y-2 text-sm text-slate-700">
                <div><strong>Name:</strong> {resumeSummary.name || "Not detected"}</div>
                <div><strong>Skills:</strong> {(resumeSummary.top_skills || []).join(", ") || "No skills extracted yet"}</div>
                <div><strong>Projects:</strong> {(resumeSummary.projects || []).slice(0, 2).join(" | ") || "No projects extracted yet"}</div>
                <div><strong>Experience:</strong> {(resumeSummary.experience || []).slice(0, 2).join(" | ") || "No experience extracted yet"}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Upload a resume to unlock resume-aware chat.</div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <div className="text-sm font-semibold">Quick Actions</div>
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="w-full text-left text-sm px-3 py-2 rounded-xl border border-slate-200 hover:border-orange-300 bg-white"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
