import { auth } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const buildAuthHeaders = (headersInit = {}) => {
  const user = auth.getUser();
  const token = auth.getToken();
  const headers = new Headers(headersInit || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (user?.email) headers.set("x-user-email", user.email);
  if (user?.id) headers.set("x-user-id", user.id);
  return headers;
};

const buildUrl = (url) => {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_BASE_URL.replace(/\/$/, "")}${url}`;
};

const fetchJSON = async (url, options = {}) => {
  const headers = buildAuthHeaders(options.headers || {});

  const res = await fetch(buildUrl(url), {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = "Request failed";
    try {
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        message = payload.message || payload.error || JSON.stringify(payload);
      } else {
        message = await res.text();
      }
    } catch {
      message = "Request failed";
    }

    if (res.status === 401) {
      auth.clear();
    }

    throw new Error(message || "Request failed");
  }

  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
};

const streamSse = async (url, payload, handlers = {}) => {
  const res = await fetch(buildUrl(url), {
    method: "POST",
    headers: buildAuthHeaders({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    }),
    credentials: "include",
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "Streaming request failed");
    throw new Error(message || "Streaming request failed");
  }

  if (!res.body) {
    throw new Error("Streaming is not supported by this browser.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitIndex = buffer.indexOf("\n\n");
    while (splitIndex !== -1) {
      const rawEvent = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);

      const lines = rawEvent.split(/\r?\n/);
      let eventName = "message";
      const dataLines = [];
      lines.forEach((line) => {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      });

      const dataText = dataLines.join("\n");
      if (dataText) {
        let parsed = dataText;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          parsed = dataText;
        }
        handlers.onEvent?.(eventName, parsed);
      }

      splitIndex = buffer.indexOf("\n\n");
    }
  }
};

export const api = {
  analyzeQuick: (form) =>
    fetchJSON("/api/analyze/quick", { method: "POST", body: form }),
  analyze: (form) => fetchJSON("/api/analyze", { method: "POST", body: form }),
  report: (id) => fetchJSON(`/api/report/${id}`),
  feedback: (form) => fetchJSON("/api/feedback", { method: "POST", body: form }),
  feedbackRewrite: (text, tone = "impactful") =>
    fetchJSON("/api/feedback/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone }),
    }),
  keywordOptimize: (form) =>
    fetchJSON("/api/keyword-optimize", {
      method: "POST",
      body: form,
    }),
  careerRecommendation: (form) =>
    fetchJSON("/api/career-recommendation", {
      method: "POST",
      body: form,
    }),
  skillGap: (form) => fetchJSON("/api/skill-gap", { method: "POST", body: form }),
  matchJobs: (form) => fetchJSON("/api/match", { method: "POST", body: form }),
  compare: (form) => fetchJSON("/api/compare", { method: "POST", body: form }),
  interviewQuestions: (jd, role = "", company = "") =>
    fetchJSON("/api/interview-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_description: jd, role, company }),
    }),
  interviewEvaluate: (payload) =>
    fetchJSON("/api/interview/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  chat: (payload) =>
    fetchJSON("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Array.isArray(payload) ? { messages: payload } : payload),
    }),
  chatStream: (payload, handlers = {}) =>
    streamSse("/api/chat/stream", Array.isArray(payload) ? { messages: payload } : payload, handlers),
  chatResumeUpload: (form) => fetchJSON("/api/chat/resume-context", { method: "POST", body: form }),
  chatContextFilesUpload: (form) => fetchJSON("/api/chat/context-files", { method: "POST", body: form }),
  // New Advanced AI Chat API
  aiChatSend: (messages, context, mode = "general", temperature = 0.7) =>
    fetchJSON("/api/ai-chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: Array.isArray(messages) ? messages : [messages],
        context,
        mode,
        temperature,
      }),
    }),
  aiChatStream: (messages, context, mode = "general", temperature = 0.7, handlers = {}) =>
    streamSse(
      "/api/ai-chat/stream",
      {
        messages: Array.isArray(messages) ? messages : [messages],
        context,
        mode,
        temperature,
      },
      handlers
    ),
  aiConversationCreate: (title, resumeText, jobDescription) =>
    fetchJSON("/api/ai-chat/conversation/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, resume_text: resumeText, job_description: jobDescription }),
    }),
  aiConversationGet: (conversationId) =>
    fetchJSON(`/api/ai-chat/conversation/${conversationId}`),
  aiConversationSend: (conversationId, message, mode = "general") =>
    fetchJSON(`/api/ai-chat/conversation/${conversationId}/message?mode=${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }),
  aiConversationsList: () => fetchJSON("/api/ai-chat/conversations"),
  aiConversationDelete: (conversationId) =>
    fetchJSON(`/api/ai-chat/conversation/${conversationId}`, {
      method: "DELETE",
    }),
  aiResumeContextUpload: (form) =>
    fetchJSON("/api/ai-chat/resume-context", { method: "POST", body: form }),

  // ============================================================================
  // Enhanced ATS & Job Matching APIs
  // ============================================================================

  // Enhanced ATS Scoring with deep NLP analysis
  enhancedAtsScore: (resumeText, jobDescription = "") =>
    fetchJSON("/api/v2/ats/enhanced-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: jobDescription,
      }),
    }),

  // Dynamic Job Matching based on resume/skills
  dynamicJobMatch: (resumeText = null, skills = null, experienceYears = 0, preferredRole = null, preferredLocation = null, limit = 10) =>
    fetchJSON("/api/v2/jobs/dynamic-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        skills: skills,
        experience_years: experienceYears,
        preferred_role: preferredRole,
        preferred_location: preferredLocation,
        limit: limit,
      }),
    }),

  // Get jobs by skills (simple endpoint)
  getJobsBySkills: (skills, experience = 0, limit = 10) =>
    fetchJSON(`/api/v2/jobs/by-skills?skills=${encodeURIComponent(skills)}&experience=${experience}&limit=${limit}`),

  // Get all available job roles
  getAllJobRoles: () =>
    fetchJSON("/api/v2/jobs/roles"),

  // Get skills for a specific role
  getRoleSkills: (roleName) =>
    fetchJSON(`/api/v2/jobs/role/${encodeURIComponent(roleName)}/skills`),

  // Comprehensive ATS Check
  atsCheck: (resumeText, jobDescription = "") =>
    fetchJSON("/api/v2/ats-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: jobDescription,
      }),
    }),

  // Skill Gap Analysis
  skillGapAnalysis: (resumeText, jobDescription) =>
    fetchJSON("/api/skill-gap", {
      method: "POST",
      body: { resume_text: resumeText, job_description: jobDescription },
    }),
  parseResume: (form) => fetchJSON("/api/parse", { method: "POST", body: form }),
  tailorResumeForJob: (resumeText, jobDescription = "") =>
    fetchJSON("/api/v2/writer/tailor-for-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }),
    }),
  atsCheckFile: (form) => fetchJSON("/api/v2/ats-check/file", { method: "POST", body: form }),
  aiContextAnalyze: (text, contextType = "resume") =>
    fetchJSON("/api/ai-chat/analyze-context", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, context_type: contextType }),
    }),
  careerCoach: (payloadOrQuestion, role = "", context = "") =>
    fetchJSON("/api/career-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        typeof payloadOrQuestion === "string"
          ? { question: payloadOrQuestion, role, context }
          : payloadOrQuestion
      ),
    }),
  coverLetter: (form) => fetchJSON("/api/cover-letter", { method: "POST", body: form }),
  importLinkedIn: () => fetchJSON("/api/import/linkedin", { method: "POST" }),
  getTemplates: () => fetchJSON("/api/templates"),
  getExamples: () => fetchJSON("/api/examples"),
  exportPDF: (form) => fetchJSON("/api/export/pdf", { method: "POST", body: form }),
  createResumeShare: (payload) =>
    fetchJSON("/api/resume-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getSharedResume: (shareId) => fetchJSON(`/api/resume-share/${shareId}`),
  recruiterDashboard: () => fetchJSON("/api/recruiter/dashboard"),
  recruiterRankings: () => fetchJSON("/api/recruiter/rankings"),
  recruiterUploadJD: (payload) =>
    fetchJSON("/api/recruiter/upload-jd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  recruiterUploadCandidates: (form) =>
    fetchJSON("/api/recruiter/candidates/upload", {
      method: "POST",
      body: form,
    }),
  recruiterShortlist: (candidateIds) =>
    fetchJSON("/api/recruiter/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    }),
  recruiterSchedule: (payload) =>
    fetchJSON("/api/recruiter/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  recruiterSaveNote: (payload) =>
    fetchJSON("/api/recruiter/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  contact: (payload) =>
    fetchJSON("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  // Application Tracker
  listApplications: () => fetchJSON("/api/applications/"),
  createApplication: (payload) =>
    fetchJSON("/api/applications/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateApplication: (id, payload) =>
    fetchJSON(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteApplication: (id) =>
    fetchJSON(`/api/applications/${id}`, {
      method: "DELETE",
    }),
  bugReport: (payload) =>
    fetchJSON("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  matchFeedback: (payload) =>
    fetchJSON("/api/match/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  matchFeedbackSummary: () => fetchJSON("/api/match/feedback-summary"),
  interviewActivity: (payload) =>
    fetchJSON("/api/interview/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  interviewActivitySummary: () => fetchJSON("/api/interview/activity-summary"),
  // auth & profile
  signup: (payload) =>
    fetchJSON("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    fetchJSON("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  forgotPassword: (payload) =>
    fetchJSON("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload) =>
    fetchJSON("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  me: () => fetchJSON("/api/auth/me"),
  logout: () =>
    fetchJSON("/api/auth/logout", {
      method: "POST",
    }),
  oauthGoogle: () => {
    window.location.href = "/api/auth/google";
  },
  oauthGithub: () => {
    window.location.href = "/api/auth/github";
  },
  profile: () => fetchJSON("/api/profile"),
  saveDashboardState: (payload) =>
    fetchJSON("/api/dashboard-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
