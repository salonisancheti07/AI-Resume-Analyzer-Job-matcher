import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const DEFAULT_SYSTEM_MODES = {
  general: "General AI Assistant",
  resume: "Resume & ATS Optimization",
  "job-match": "Job Matching Expert",
  interview: "Interview Coach",
  career: "Career Strategy Advisor",
};

export default function AIModeChat() {
  console.log("🤖 AIModeChat component loaded");
  
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      content:
        "👋 Welcome to AI Mode! I'm your resume & career AI assistant. I can help you with:\n\n📄 **Resume Writing** - Generate bullets, optimize for ATS, improve your content\n🎯 **ATS Optimization** - Check ATS scores, identify issues, add keywords\n💼 **Job Matching** - Tailor resumes for specific jobs, identify required skills\n🎤 **Interview Prep** - Practice questions, behavioral coaching, technical prep\n📈 **Career Strategy** - Plan career moves, explore roles, build growth plans\n\nUpload a resume or just start asking. I'll remember our conversation.",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingContext, setUploadingContext] = useState(false);
  const [mode, setMode] = useState("general");
  const [resumeContext, setResumeContext] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [contextFiles, setContextFiles] = useState([]);
  const [extraContextText, setExtraContextText] = useState("");
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const [temperature, setTemperature] = useState(0.7);
  const [backendError, setBackendError] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleResumeUpload = async (file) => {
    if (!file) return;

    try {
      setResumeFile(file);
      setBackendError("");
      const form = new FormData();
      form.append("file", file);

      const result = await api.chatResumeUpload(form);
      const resumeText = result.resume_text || "";
      const skills = result.summary?.top_skills || [];

      setResumeContext({
        text: resumeText,
        wordCount: resumeText ? resumeText.split(/\s+/).filter(Boolean).length : 0,
        skills,
        preview: result.summary || null,
      });

      addMessage({
        role: "assistant",
        content: `✅ Resume uploaded! (${resumeText ? resumeText.split(/\s+/).filter(Boolean).length : 0} words, ${skills.length} skills detected)\n\nI can now:\n• Answer questions about your resume\n• Optimize it for ATS\n• Tailor it for specific jobs\n• Suggest improvements\n• Explain your career fit\n\nWhat would you like help with?`,
      });
    } catch (err) {
      setBackendError(`Backend issue: ${err.message || "Cannot connect to AI service"}`);
      addMessage({
        role: "assistant",
        content: `❌ Upload failed: ${err.message}`,
      });
    }
  };

  const handleContextUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    try {
      setUploadingContext(true);
      setBackendError("");
      const form = new FormData();
      files.forEach((file) => form.append("files", file));

      const result = await api.chatContextFilesUpload(form);
      setContextFiles(result.files || []);
      setExtraContextText(result.contextText || "");

      addMessage({
        role: "assistant",
        content: `✅ Added ${files.length} context file${files.length > 1 ? "s" : ""}. Parsed ${result.supportedCount || 0} file(s) for AI context.${result.videoCount ? ` I detected ${result.videoCount} video file(s); add transcripts, captions, or notes for precise video-based answers.` : ""}`,
      });
    } catch (err) {
      setBackendError(`Backend issue: ${err.message || "Cannot upload context files"}`);
      addMessage({
        role: "assistant",
        content: `❌ Context upload failed: ${err.message}`,
      });
    } finally {
      setUploadingContext(false);
    }
  };

  const addMessage = (msg) => {
    const newMsg = {
      id: `msg-${Date.now()}-${Math.random()}`,
      ...msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const getModelMessages = (nextUserMessage) => [
    ...messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .filter((msg) => msg.id !== "intro")
      .filter((msg) => !/^(✅|❌|⚠️)/.test(String(msg.content || "").trim()))
      .map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: nextUserMessage },
  ];

  const buildChatPayload = (nextUserMessage) => ({
    messages: getModelMessages(nextUserMessage),
    mode,
    role: DEFAULT_SYSTEM_MODES[mode],
    resumeText: resumeContext?.text || "",
    extraContextText,
    temperature,
  });

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = messageText.trim();
    addMessage({ role: "user", content: userMessage });
    setInput("");
    setLoading(true);
    setBackendError("");

    try {
      const response = await api.chat(buildChatPayload(userMessage));

      addMessage({
        role: "assistant",
        content: response.reply || response.content || "I couldn't generate a response.",
      });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      setBackendError(`Backend issue: ${errorMsg}`);
      addMessage({
        role: "assistant",
        content: `⚠️ Error: ${errorMsg}\n\n📝 Debugging info:\n- Make sure backend is running\n- Check OPENAI_API_KEY is set\n- Try refreshing the page`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStreamingChat = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = messageText.trim();
    addMessage({ role: "user", content: userMessage });
    setInput("");
    setLoading(true);
    setBackendError("");

    try {
      let fullResponse = "";

      await api.chatStream(
        buildChatPayload(userMessage),
        {
          onEvent: (eventName, data) => {
            if (eventName === "chunk" && data.text) {
              fullResponse += data.text;
              // Update message in real-time
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg.role === "assistant" && lastMsg.id.startsWith("streaming-")) {
                  lastMsg.content = fullResponse;
                } else {
                  updated.push({
                    id: "streaming-" + Date.now(),
                    role: "assistant",
                    content: fullResponse,
                    timestamp: new Date(),
                  });
                }
                return updated;
              });
            }
            if (eventName === "meta" && data?.reply) {
              setMessages((prev) =>
                prev.map((msg, index) =>
                  index === prev.length - 1 && msg.role === "assistant" && msg.id.startsWith("streaming-")
                    ? { ...msg, content: data.reply }
                    : msg
                )
              );
            }
          },
        }
      );
    } catch (err) {
      setBackendError(`Backend issue: ${err.message || "Streaming failed"}`);
      addMessage({
        role: "assistant",
        content: `⚠️ Streaming error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "ATS Check", icon: "✓", fn: () => sendMessage("Check my resume for ATS compatibility and provide a score.") },
    { label: "Generate Bullets", icon: "•", fn: () => sendMessage("Generate 5 strong bullet points from my experience with metrics.") },
    { label: "Job Tailor", icon: "🎯", fn: () => sendMessage("Help me tailor my resume for the role I'm targeting.") },
    { label: "Interview Q&A", icon: "🎤", fn: () => sendMessage("Generate likely interview questions and help me prepare.") },
    { label: "Career Path", icon: "📈", fn: () => sendMessage("What are the best next career moves for someone with my profile?") },
    { label: "Keywords", icon: "🔑", fn: () => sendMessage("What keywords should I add to my resume to match job requirements?") },
  ];

  const clearContext = () => {
    setResumeContext(null);
    setResumeFile(null);
    setContextFiles([]);
    setExtraContextText("");
    addMessage({
      role: "assistant",
      content: "✅ Uploaded context cleared. I can still help with general career questions!",
    });
  };

  return (
    <div className="aimode-theme-page flex h-[calc(100dvh-7.25rem)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm md:h-[calc(100vh-8.75rem)] md:min-h-[620px] md:flex-row md:rounded-[28px]">
      {/* Sidebar */}
      {showSidebar && (
        <div className="flex max-h-[42dvh] w-full shrink-0 flex-col overflow-hidden border-b border-slate-800 bg-slate-900 text-white md:max-h-none md:w-80 md:border-b-0 md:border-r">
          <div className="p-3 border-b border-slate-700 md:p-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🤖</span> AI Mode
            </h1>
            <p className="text-xs text-slate-400 mt-1">Resume & Career Assistant</p>
          </div>

          {/* Mode Selector */}
          <div className="p-3 border-b border-slate-700 space-y-2 md:p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase">Chat Mode</div>
            <div className="space-y-1">
              {Object.entries(DEFAULT_SYSTEM_MODES).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    mode === key
                      ? "bg-teal-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Resume Context */}
          <div className="p-3 border-b border-slate-700 space-y-2 md:p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase">Resume</div>
            {resumeFile ? (
              <div className="bg-slate-800 rounded p-2">
                <div className="text-sm font-medium truncate">{resumeFile.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {resumeContext?.wordCount} words • {resumeContext?.skills?.length || 0} skills
                </div>
                <button
                  onClick={clearContext}
                  className="mt-2 w-full px-2 py-1 bg-red-900 hover:bg-red-800 text-white text-xs rounded"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleResumeUpload(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-300"
                />
                <p className="text-xs text-slate-400 mt-2">Upload PDF for resume-specific help</p>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-slate-700 space-y-2 md:p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase">Files / Folder</div>
            <div>
              <input
                type="file"
                multiple
                onChange={(e) => handleContextUpload(e.target.files)}
                className="block w-full text-xs text-slate-300"
              />
              <input
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                onChange={(e) => handleContextUpload(e.target.files)}
                className="mt-2 block w-full text-xs text-slate-300"
              />
              <p className="text-xs text-slate-400 mt-2">
                {uploadingContext
                  ? "Uploading folder context..."
                  : contextFiles.length
                    ? `${contextFiles.length} context file(s) loaded for AI mode`
                    : "Upload project files or a folder. Videos need transcripts or notes for content-aware answers."}
              </p>
            </div>
          </div>

          {/* Temperature Control */}
          <div className="p-3 border-b border-slate-700 space-y-2 md:p-4">
            <div className="flex justify-between items-center">
              <div className="text-xs font-semibold text-slate-300 uppercase">Creativity</div>
              <div className="text-xs text-slate-400">{temperature.toFixed(1)}</div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-slate-400">Lower = focused, Higher = creative</div>
          </div>

          {/* Quick Actions */}
          <div className="min-h-0 flex-1 overflow-auto p-3 space-y-2 md:p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase">Quick Actions</div>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.fn}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-2"
              >
                <span>{action.icon}</span>
                <span className="text-slate-300">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 p-3 text-xs text-slate-400">
            <p>Built with OpenAI • Always learning</p>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 md:px-6 md:py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Chat</h1>
            <p className="text-xs text-slate-500 md:text-sm">{DEFAULT_SYSTEM_MODES[mode]}</p>
          </div>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="shrink-0 px-3 py-2 rounded border border-slate-200 text-sm hover:bg-slate-50 md:px-4"
          >
            {showSidebar ? "Hide" : "Show"}
          </button>
        </div>

        {/* Backend Status */}
        {backendError && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-3">
            <p className="text-sm text-amber-900">
              ⚠️ {backendError}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Make sure backend is running: <code className="bg-amber-100 px-2 py-1 rounded">npm run dev</code> in the <code className="bg-amber-100 px-2 py-1 rounded">server</code> folder
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 md:p-6 md:space-y-4">
          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86vw] rounded-lg px-3 py-2.5 md:max-w-2xl md:px-4 md:py-3 ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-900 border border-slate-200"
                } whitespace-pre-wrap text-sm`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-900 border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 md:p-5">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleStreamingChat();
                  }
                }}
                placeholder="Ask anything about resumes, careers, ATS, interviews... (Shift+Enter for new line)"
                className="min-h-[88px] flex-1 border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:border-teal-500 resize-none"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-col">
                <button
                  onClick={() => handleStreamingChat()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 transition md:px-6"
                >
                  Send
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50 transition text-sm md:px-6"
                >
                  Standard
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              💡 Tip: Upload a resume for more personalized help. Send streams responses in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

