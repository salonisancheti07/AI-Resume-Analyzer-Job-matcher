import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

const aiModePrompts = [
  "Give me the fastest path to improve this resume for the JD.",
  "What would a recruiter like first, and what will they question?",
  "Rewrite the weakest section in a stronger way.",
];
const AI_SESSION_KEY = "resumeai_ai_mode_sessions";
const TEMPLATE_PRESETS = {
  classic: {
    name: "Classic ATS",
    accent: "#0f766e",
    font: "Calibri, Arial, sans-serif",
    summary: "Balanced layout for ATS-safe applications.",
    bestFor: "General applications and broad ATS compatibility.",
    density: "Balanced",
    starterTips: [
      "Use clear section headings and a single-column flow.",
      "Lead with strong experience bullets and measurable outcomes.",
      "Match keywords exactly to the job description.",
    ],
  },
  executive: {
    name: "Executive Focus",
    accent: "#1d4ed8",
    font: "Georgia, Cambria, serif",
    summary: "Sharper hierarchy for leadership and senior roles.",
    bestFor: "Directors, leads, founders, and senior IC roles.",
    density: "Structured",
    starterTips: [
      "Prioritize leadership, strategy, and team impact in each bullet.",
      "Show high-level metrics and business outcomes.",
      "Keep the header polished with a strong executive summary.",
    ],
  },
  minimal: {
    name: "Minimal Modern",
    accent: "#475569",
    font: "\"Trebuchet MS\", Verdana, sans-serif",
    summary: "Clean and compact structure for fast recruiter scans.",
    bestFor: "Product, design-adjacent, and modern tech resumes.",
    density: "Compact",
    starterTips: [
      "Keep each bullet short, direct, and result-oriented.",
      "Use whitespace strategically and avoid dense paragraphs.",
      "Highlight product and project outcomes with crisp language.",
    ],
  },
  technical: {
    name: "Technical Edge",
    accent: "#0f172a",
    font: "\"Segoe UI\", Tahoma, sans-serif",
    summary: "Sharper contrast and compact spacing for engineering-heavy content.",
    bestFor: "Software, data, ML, QA, and platform roles.",
    density: "Dense",
    starterTips: [
      "Lead with technical stacks, systems, and measurable results.",
      "Show impact with numbers, performance, and reliability gains.",
      "Keep tools and methods concise in a dedicated skills section.",
    ],
  },
  graduate: {
    name: "Graduate Launch",
    accent: "#7c3aed",
    font: "Arial, Helvetica, sans-serif",
    summary: "Supportive structure for early-career resumes with projects and internships.",
    bestFor: "Students, interns, and new graduates.",
    density: "Balanced",
    starterTips: [
      "Showcase academic projects, coursework, and relevant internships.",
      "Use action verbs and tie achievements to results.",
      "Include transferable skills and any leadership or club experience.",
    ],
  },
  operations: {
    name: "Operations Clear",
    accent: "#b45309",
    font: "\"Gill Sans\", \"Trebuchet MS\", sans-serif",
    summary: "Readable sections tuned for operations, support, and delivery roles.",
    bestFor: "Operations, customer success, and business roles.",
    density: "Balanced",
    starterTips: [
      "Highlight process improvements, coordination, and customer impact.",
      "Use clear outcome metrics for efficiency, savings, or service quality.",
      "Keep responsibilities grouped by results rather than tasks.",
    ],
  },
  consulting: {
    name: "Consulting Brief",
    accent: "#166534",
    font: "\"Book Antiqua\", Georgia, serif",
    summary: "A concise narrative-first template for impact-driven resumes.",
    bestFor: "Consulting, strategy, analytics, and business ops.",
    density: "Tight",
    starterTips: [
      "Frame each bullet around problem, action, and measurable result.",
      "Use business language with clear value statements.",
      "Keep the resume concise and focused on outcomes.",
    ],
  },
};
const EXAMPLE_LIBRARY = {
  SDE: {
    label: "Software Engineer",
    category: "Engineering",
    samples: [
      {
        title: "Full-Stack Product Builder",
        summary: "Full-stack engineer building scalable product features across frontend, backend, and APIs with a focus on measurable delivery and reliability.",
        bullets: [
          "Built and shipped user-facing features that improved activation and reduced support friction across the product journey.",
          "Optimized backend API workflows, improving response time and developer productivity through cleaner service design.",
        ],
      },
      {
        title: "Backend Systems Engineer",
        summary: "Backend-focused engineer improving reliability, service performance, and developer efficiency across production systems.",
        bullets: [
          "Redesigned service workflows to reduce latency and failure points across high-traffic backend endpoints.",
          "Improved observability and release confidence by tightening monitoring, rollback readiness, and operational documentation.",
        ],
      },
    ],
  },
  "ML Engineer": {
    label: "ML Engineer",
    category: "Engineering",
    samples: [
      {
        title: "Model Development",
        summary: "ML engineer with hands-on experience in model development, experimentation, and practical deployment workflows focused on measurable business outcomes.",
        bullets: [
          "Built and evaluated machine learning pipelines, improving model quality through cleaner features and stronger validation workflows.",
          "Translated experimentation results into deployable improvements with clear trade-offs across accuracy, latency, and maintainability.",
        ],
      },
      {
        title: "Applied AI Delivery",
        summary: "Applied ML engineer bridging experimentation and product delivery through robust data pipelines, model iteration, and measurable deployment outcomes.",
        bullets: [
          "Partnered with product and data teams to convert business problems into scoped ML experiments with clear success criteria.",
          "Strengthened production-readiness by improving feature pipelines, model monitoring, and inference reliability.",
        ],
      },
    ],
  },
  "Data Analyst": {
    label: "Data Analyst",
    category: "Analytics",
    samples: [
      {
        title: "Insights and Dashboarding",
        summary: "Data analyst turning raw data into actionable insights through dashboards, experimentation, and stakeholder-friendly reporting.",
        bullets: [
          "Developed reporting workflows and dashboards that improved visibility into business performance and decision speed.",
          "Analyzed operational and product trends, surfacing insights that shaped prioritization and process improvements.",
        ],
      },
      {
        title: "Business Intelligence",
        summary: "Analyst focused on KPI definition, business reporting, and clear decision support across product and operations teams.",
        bullets: [
          "Built repeatable reporting views that improved stakeholder trust in core performance metrics and weekly reviews.",
          "Turned ambiguous business questions into structured analysis that informed prioritization and process changes.",
        ],
      },
    ],
  },
  DevOps: {
    label: "DevOps",
    category: "Infrastructure",
    samples: [
      {
        title: "Platform Reliability",
        summary: "DevOps engineer focused on reliable deployments, observability, automation, and operational efficiency across modern cloud environments.",
        bullets: [
          "Improved deployment workflows and environment reliability through stronger automation and operational guardrails.",
          "Reduced incident risk by tightening observability, rollout controls, and infrastructure consistency.",
        ],
      },
      {
        title: "Cloud Operations",
        summary: "Infrastructure engineer improving platform resilience, release quality, and cost-aware cloud operations.",
        bullets: [
          "Standardized infrastructure workflows to reduce configuration drift and improve release consistency across environments.",
          "Raised operational confidence through stronger alerting, deployment controls, and incident follow-through.",
        ],
      },
    ],
  },
  "Product Manager": {
    label: "Product Manager",
    category: "Product",
    samples: [
      {
        title: "Outcome-Focused PM",
        summary: "Product manager aligning user needs, business priorities, and cross-functional execution to deliver measurable product outcomes.",
        bullets: [
          "Drove roadmap decisions by combining user feedback, product data, and stakeholder input into clearer prioritization.",
          "Partnered with design and engineering to launch improvements that increased adoption and reduced friction in key journeys.",
        ],
      },
      {
        title: "Growth and Platform PM",
        summary: "Product leader balancing discovery, delivery, and stakeholder alignment across growth and platform initiatives.",
        bullets: [
          "Defined problem statements, success metrics, and launch plans that improved execution clarity across cross-functional teams.",
          "Used experiments and qualitative insights to refine product bets and communicate trade-offs with confidence.",
        ],
      },
    ],
  },
  "UI/UX Designer": {
    label: "UI/UX Designer",
    category: "Design",
    samples: [
      {
        title: "Product Design",
        summary: "Product designer crafting intuitive digital experiences through research, interaction design, and close cross-functional collaboration.",
        bullets: [
          "Improved user flows by turning research insights into clearer interaction patterns and more confident design decisions.",
          "Partnered with product and engineering to ship polished interfaces that balanced usability, consistency, and delivery speed.",
        ],
      },
      {
        title: "Experience Design Systems",
        summary: "Designer focused on scalable interfaces, usability improvements, and design-system thinking across product surfaces.",
        bullets: [
          "Raised design consistency by improving reusable patterns, documentation, and handoff clarity across the team.",
          "Used testing and feedback loops to refine interaction choices and reduce friction in core user journeys.",
        ],
      },
    ],
  },
  "Customer Success": {
    label: "Customer Success",
    category: "Business",
    samples: [
      {
        title: "Customer Retention",
        summary: "Customer success professional helping users adopt products successfully, reduce churn risk, and grow long-term account value.",
        bullets: [
          "Managed customer relationships proactively, improving adoption through onboarding guidance and issue follow-through.",
          "Turned customer feedback into internal recommendations that improved retention and strengthened cross-team communication.",
        ],
      },
      {
        title: "Onboarding and Support",
        summary: "Client-facing operator focused on onboarding, stakeholder communication, and service quality across the post-sale journey.",
        bullets: [
          "Improved onboarding readiness by creating clearer customer handoff, enablement, and support workflows.",
          "Built trust with clients through responsive communication, structured follow-ups, and outcome-focused account support.",
        ],
      },
    ],
  },
};

export default function ResumeAnalyzer() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [tailoredResume, setTailoredResume] = useState(null);
  const [atsSimulation, setAtsSimulation] = useState(null);
  const [skillGraph, setSkillGraph] = useState(null);
  const [aiModeLoading, setAiModeLoading] = useState(false);
  const [aiModeAnswer, setAiModeAnswer] = useState(null);
  const [aiModeQuestion, setAiModeQuestion] = useState("");
  const [aiModeHistory, setAiModeHistory] = useState([]);
  const [streamedAiReply, setStreamedAiReply] = useState("");
  const [aiStreamStatus, setAiStreamStatus] = useState("idle");
  const [aiStreamError, setAiStreamError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [rewriteResult, setRewriteResult] = useState(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("classic");
  const [searchParams] = useSearchParams();
  const [versionLabel, setVersionLabel] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [compareSelection, setCompareSelection] = useState([]);
  const [selectedExampleRole, setSelectedExampleRole] = useState("");
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const [editorAiLoading, setEditorAiLoading] = useState({
    summary: false,
    skills: false,
    bulletIndex: null,
  });
  const [bulletSuggestions, setBulletSuggestions] = useState({});
  const [resumeEditor, setResumeEditor] = useState({
    headline: "",
    summary: "",
    skills: "",
    bullets: [],
  });
  const aiModeAbortRef = useRef(null);
  const analyzerHydratedRef = useRef(false);
  const [savedAnalyses, setSavedAnalyses] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("saved_analyses") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [savedAiSessions, setSavedAiSessions] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(AI_SESSION_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [versionHistory, setVersionHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("resumeai_versions") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Application Tracker state
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appForm, setAppForm] = useState({
    job_title: "",
    company: "",
    job_url: "",
    resume_version: "",
    status: "Interested",
    notes: "",
  });

  const buildAnalysisHistoryEntry = ({
    analysisResult = result,
    analysisAts = atsSimulation,
    analysisSkillGraph = skillGraph,
    timestamp = new Date().toISOString(),
  } = {}) => ({
    timestamp,
    fileName: file?.name || "resume",
    versionLabel: versionLabel || "Working draft",
    template: selectedTemplate,
    result: analysisResult,
    jobDescription: jd,
    ats: analysisAts,
    skillGraph: analysisSkillGraph,
  });

  const upsertSavedAnalysis = (analysisData) => {
    setSavedAnalyses((prev) => {
      const deduped = prev.filter(
        (item) =>
          !(
            item?.fileName === analysisData.fileName &&
            item?.jobDescription === analysisData.jobDescription &&
            JSON.stringify(item?.result?.scores || {}) === JSON.stringify(analysisData.result?.scores || {})
          )
      );
      return [...deduped, analysisData].slice(-20);
    });
  };

  useEffect(() => {
    localStorage.setItem(AI_SESSION_KEY, JSON.stringify(savedAiSessions));
  }, [savedAiSessions]);

  useEffect(() => {
    const templateParam = searchParams.get("template")?.toLowerCase().replace(/[-_\s]/g, "");
    if (!templateParam) return;

    const templateMap = {
      academic: "graduate",
      graduate: "graduate",
      technical: "technical",
      leadership: "executive",
      product: "minimal",
      "career-switch": "consulting",
      consulting: "consulting",
      operations: "operations",
      executive: "executive",
      minimal: "minimal",
      classic: "classic",
    };

    const resolved = templateMap[templateParam] || templateParam;
    if (TEMPLATE_PRESETS[resolved]) {
      setSelectedTemplate(resolved);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("resumeai_match_context");
      if (!raw) return;
      const context = JSON.parse(raw);
      if (context?.jobDescription) {
        setJd(context.jobDescription);
        setVersionLabel(`Tailored for ${context.role || "target role"}`);
        setNotice(`Loaded job context for ${context.role || "this role"}.`);
      }
      if (context?.role) {
        setSelectedExampleRole(context.role);
      }
      localStorage.removeItem("resumeai_match_context");
    } catch {
      // ignore malformed or missing match context
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("saved_analyses", JSON.stringify(savedAnalyses));
  }, [savedAnalyses]);

  useEffect(() => {
    let active = true;

    const hydrateAnalyzerHistory = async () => {
      try {
        const profile = await api.profile();
        if (!active) return;
        const dashboardState = profile?.dashboardState || {};
        if (Array.isArray(dashboardState.analyzerHistory) && dashboardState.analyzerHistory.length) {
          setSavedAnalyses(dashboardState.analyzerHistory);
          localStorage.setItem("saved_analyses", JSON.stringify(dashboardState.analyzerHistory));
        }
        if (Array.isArray(dashboardState.aiModeSessions) && dashboardState.aiModeSessions.length) {
          setSavedAiSessions(dashboardState.aiModeSessions);
          localStorage.setItem(AI_SESSION_KEY, JSON.stringify(dashboardState.aiModeSessions));
        }
      } catch {
        // Keep local history when the profile endpoint is unavailable.
      } finally {
        if (active) analyzerHydratedRef.current = true;
      }
    };

    hydrateAnalyzerHistory();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!analyzerHydratedRef.current) return;
    api.saveDashboardState({
      analyzerHistory: savedAnalyses,
      aiModeSessions: savedAiSessions,
    }).catch(() => {
      // Keep local history as fallback if backend sync fails.
    });
  }, [savedAnalyses, savedAiSessions]);

  // Load applications on mount
  useEffect(() => {
    let active = true;
    const load = async () => {
      setAppsLoading(true);
      try {
        const list = await api.listApplications();
        if (!active) return;
        setApplications(Array.isArray(list) ? list : []);
      } catch (err) {
        console.debug("Failed to load applications", err);
      } finally {
        if (active) setAppsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    setResumeEditor((prev) => ({
      headline: prev.headline || (jd ? jd.split("\n")[0] : file?.name?.replace(/\.[^.]+$/, "") || "Optimized Resume Draft"),
      summary: prev.summary || summaryDraft || result.ai_summary || "",
      skills: prev.skills || (result.skills || []).slice(0, 12).join(", "),
      bullets: prev.bullets?.length
        ? prev.bullets
        : ((rewriteResult?.improvedBullets || result.bulletPoints || []).slice(0, 6).map((item) => item.improved || item.original)),
    }));
  }, [result, summaryDraft, rewriteResult, jd, file]);

  useEffect(() => {
    if (!result) return;
    setVersionLabel((prev) => prev || (jd ? `${jd.split("\n")[0].slice(0, 40)} version` : `${file?.name?.replace(/\.[^.]+$/, "") || "Resume"} v1`));
  }, [result, jd, file]);

  useEffect(() => {
    const inferredRole = inferTargetRole(result);
    setSelectedExampleRole((prev) => (prev && EXAMPLE_LIBRARY[prev] ? prev : inferredRole));
    setSelectedExampleIndex(0);
  }, [result]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please upload a resume");
      return;
    }
    
    setError("");
    setLoading(true);
    setAiModeAnswer(null);
    setAiModeQuestion("");
    setAiModeHistory([]);
    setStreamedAiReply("");
    setAiStreamStatus("idle");
    setAiStreamError("");
    setRewriteResult(null);
    setSummaryDraft("");
    setShareLink("");
    setEditorAiLoading({
      summary: false,
      skills: false,
      bulletIndex: null,
    });
    setResumeEditor({
      headline: "",
      summary: "",
      skills: "",
      bullets: [],
    });
    setTailoredResume(null);
    setCoverLetter("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("job_description", jd || "General resume analysis");

      // Call the backend API
      const data = await api.analyze(form);
      
      // Process the response
      const processedResult = {
        scores: data.scores || { final: 0, sub: { keywords: 0, structure: 0, impact: 0, formatting: 0 } },
        match_rate: data.match_rate || 0,
        readability: data.readability || { score: 0 },
        skills: data.skills || [],
        job_skills: data.job_skills || [],
        missing_skills: data.missing_skills || [],
        keywordStats: data.keywordStats || { missing: [], lowFreq: [], suggested: [] },
        keywordTargeting: data.keywordTargeting || { matched: [], lowFrequency: [], prioritizedMissing: [] },
        summarySuggestions: data.summarySuggestions || [],
        actionVerbs: data.actionVerbs || [],
        metricsGuide: data.metricsGuide || { note: "", examples: [] },
        atsChecks: data.atsChecks || [],
        ai_summary: data.ai_summary || data.feedback || "Resume analysis complete",
        feedback: data.feedback || "No specific feedback available",
        sections: data.sections || {
          summary: false,
          experience: false,
          education: false,
          skills: false,
          projects: false,
          certifications: false,
        },
        heatmap: data.heatmap || generateHeatmap(data),
        bulletPoints: data.bulletPoints || generateBulletPoints(data),
        keywords: generateKeywords(data),
        formatting: data.formatting || generateFormatting(data),
        atsCompatibility: data.atsCompatibility || generateAtsCompatibility(data),
        improvements: data.improvements || generateImprovements(data)
      };

      const simulation = runAtsSimulation(processedResult, jd);
      const graph = buildSkillGraph(processedResult.skills || [], processedResult.missing_skills || []);
      const nextResult = {
        ...processedResult,
        atsSimulation: simulation,
        fakeExperience: detectFakeExperience(processedResult),
        hiringProbability: calculateHiringProbability(simulation, processedResult),
      };

      setResult(nextResult);
      setAtsSimulation(simulation);
      setSkillGraph(graph);
      upsertSavedAnalysis(
        buildAnalysisHistoryEntry({
          analysisResult: nextResult,
          analysisAts: simulation,
          analysisSkillGraph: graph,
        })
      );
      setVersionHistory((prev) => {
        const snapshot = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          summary: processedResult.ai_summary || processedResult.feedback,
          totalScore: processedResult.scores?.final || 0,
          matchRate: processedResult.match_rate || 0,
          atsScore: simulation?.score || 0,
          keywordsSuggested: simulation?.keywords || [],
        };
        const next = [snapshot, ...prev].slice(0, 8);
        localStorage.setItem("resumeai_versions", JSON.stringify(next));
        return next;
      });
      setActiveTab("overview");
      if (aiMode) {
        await runAiModeAnalysis({
          question: "Analyze this resume like a premium AI search assistant. Start with the strongest signals, biggest gaps, and the fastest improvements for shortlist success.",
          analysis: nextResult,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to analyze resume. Please try again.");
      console.error("Analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Application Tracker handlers
  const reloadApplications = async () => {
    setAppsLoading(true);
    try {
      const list = await api.listApplications();
      setApplications(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to reload applications", err);
    } finally {
      setAppsLoading(false);
    }
  };

  const handleCreateApplication = async () => {
    setSaveLoading(true);
    try {
      const payload = { ...appForm, resume_version: appForm.resume_version || versionLabel };
      await api.createApplication(payload);
      setNotice("Application saved to tracker.");
      setAppForm({ job_title: "", company: "", job_url: "", resume_version: "", status: "Interested", notes: "" });
      await reloadApplications();
    } catch (err) {
      setError(err.message || "Failed to save application");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateApplication = async (id, patch) => {
    try {
      await api.updateApplication(id, patch);
      await reloadApplications();
    } catch (err) {
      console.error("Failed to update application", err);
    }
  };

  const handleDeleteApplication = async (id) => {
    try {
      await api.deleteApplication(id);
      await reloadApplications();
    } catch (err) {
      console.error("Failed to delete application", err);
    }
  };

  const buildAiModeResumeText = (analysis) => {
    if (!analysis) return "";
    return [
      `Resume file: ${file?.name || "uploaded resume"}`,
      `ATS score: ${analysis.scores?.final || 0}/100`,
      `Match rate: ${Math.round((analysis.match_rate || 0) * 100)}%`,
      `Readability: ${analysis.readability?.score || 0}/100`,
      `Top skills: ${(analysis.skills || []).slice(0, 8).join(", ") || "none detected"}`,
      `Missing skills: ${(analysis.missing_skills || []).slice(0, 8).join(", ") || "none detected"}`,
      `Summary: ${analysis.ai_summary || analysis.feedback || "No summary available."}`,
      `Key feedback: ${analysis.feedback || "No feedback available."}`,
      `ATS keywords to add: ${(analysis.atsSimulation?.keywords || []).slice(0, 6).join(", ") || "none"}`,
      `Improvement priorities: ${(analysis.improvements || []).slice(0, 4).map((item) => item.action).join(", ") || "none"}`,
      `Section strength: ${Object.entries(analysis.sections || {}).filter(([, present]) => present).map(([section]) => section).join(", ") || "no structured sections detected"}`,
      `Hiring probability: ${analysis.hiringProbability || "unknown"}`,
    ].join("\n");
  };

  const buildResumeBrief = (analysis = result) => {
    if (!analysis) return "";
    return [
      `Top skills: ${(analysis.skills || []).slice(0, 8).join(", ") || "none"}`,
      `Missing skills: ${(analysis.missing_skills || []).slice(0, 8).join(", ") || "none"}`,
      `Top improvements: ${(analysis.improvements || []).slice(0, 4).map((item) => item.action).join(", ") || "none"}`,
      `Bullet suggestions: ${(analysis.bulletPoints || []).slice(0, 4).map((item) => `${item.original} => ${item.improved}`).join(" | ") || "none"}`,
      `Summary feedback: ${analysis.feedback || analysis.ai_summary || "none"}`,
    ].join("\n");
  };

  const buildRecruiterQuestions = (analysis = result) => {
    if (!analysis) return [];
    const missing = (analysis.missing_skills || []).slice(0, 3);
    const skills = (analysis.skills || []).slice(0, 3);
    const roleHint = jd ? jd.split("\n")[0].slice(0, 60) : "this target role";
    return [
      `Which project best proves your strength in ${skills[0] || "the core stack"} for ${roleHint}?`,
      `How would you justify your experience with ${missing[0] || "the missing requirement"} if a recruiter challenges it?`,
      `What measurable outcome on your resume would make a recruiter trust your fit fastest?`,
      `If I asked you to tailor one bullet for ${missing[1] || "this JD"}, which bullet would you change first and why?`,
    ];
  };

  const inferAiModeQuestionType = (question = "", answer = "") => {
    const text = `${question} ${answer}`.toLowerCase();
    if (/first 15|first 10|recruiter notice|first screen|scan/i.test(text)) return "scan";
    if (/highest-impact|top 3|three highest|before i apply|what to change first|fix first/i.test(text)) return "fixes";
    if (/strongest signal|strongest signals|strength|what is working/i.test(text)) return "strengths";
    if (/biggest gap|biggest gaps|weakest|risk|doubt/i.test(text)) return "gaps";
    if (/rewrite|edit|reword|improve this bullet|improve this summary/i.test(text)) return "rewrite";
    return "general";
  };

  const getLatestAiModeQuestion = () => {
    const lastUser = [...(aiModeHistory || [])].reverse().find((item) => item.role === "user");
    return lastUser?.content || "";
  };

  const buildTopFixes = (analysis = result) => {
    if (!analysis) return [];

    const fixes = (analysis.improvements || [])
      .filter((item) => item?.action)
      .slice(0, 3)
      .map((item) => ({
        title: item.action,
        priority: item.priority || "Medium",
        reason: item.impact ? `Expected impact: ${item.impact}` : "Improves ATS fit and recruiter scan quality.",
      }));

    if (fixes.length) return fixes;

    const missingSkills = (analysis.missing_skills || []).slice(0, 2);
    if (missingSkills.length) {
      fixes.push({
        title: `Add proof for ${missingSkills.join(" and ")}`,
        priority: "High",
        reason: "These keywords appear important for the target role but are weak or missing in the resume.",
      });
    }

    if (!analysis.sections?.experience) {
      fixes.push({
        title: "Strengthen experience evidence",
        priority: "High",
        reason: "Recruiters need concrete work, project, or internship proof before trusting the score.",
      });
    }

    if (!analysis.sections?.summary) {
      fixes.push({
        title: "Add a focused professional summary",
        priority: "Medium",
        reason: "A concise summary helps connect your strongest skills to the target role faster.",
      });
    }

    if (!fixes.length) {
      fixes.push({
        title: "Add measurable outcomes",
        priority: "Medium",
        reason: "Numbers, scope, and results make strong resumes easier to trust during a quick scan.",
      });
    }

    return fixes.slice(0, 3);
  };

  const buildAiModeDisplay = (analysis = result) => {
    const latestQuestion = getLatestAiModeQuestion();
    const currentReply = streamedAiReply || aiModeAnswer?.reply || "";
    const type = inferAiModeQuestionType(latestQuestion, currentReply);
    const verdict = aiModeAnswer?.recruiterVerdict || null;
    const fallbackHighlights = [
      `ATS score is ${analysis?.scores?.final || 0}/100.`,
      `Current match rate is ${Math.round((analysis?.match_rate || 0) * 100)}%.`,
      (analysis?.missing_skills || []).length
        ? `Top missing skills include ${(analysis?.missing_skills || []).slice(0, 3).join(", ")}.`
        : "No major missing skills were detected.",
    ];
    const fallbackActions = (analysis?.improvements || []).slice(0, 3).map((item) => `${item.priority}: ${item.action}`);
    const topFixes = buildTopFixes(analysis);

    const config = {
      general: {
        badge: "Direct answer",
        title: "AI Synthesis",
        subtitle: "A search-style answer grounded in the current resume and JD context.",
        primaryTitle: "Answer",
        secondaryTitle: "Key takeaways",
        accent: "from-cyan-50 via-white to-indigo-50",
      },
      scan: {
        badge: "Recruiter scan",
        title: "First-Impression Read",
        subtitle: "Shows what a recruiter is likely to notice first and where confidence drops.",
        primaryTitle: "15-Second Read",
        secondaryTitle: "What shows up first",
        accent: "from-sky-50 via-white to-cyan-50",
      },
      fixes: {
        badge: "Top fixes",
        title: "Highest-Impact Changes",
        subtitle: "Prioritized actions for improving shortlist odds before you apply.",
        primaryTitle: "Priority answer",
        secondaryTitle: "Fix sequence",
        accent: "from-amber-50 via-white to-rose-50",
      },
      strengths: {
        badge: "Strength map",
        title: "What Is Already Working",
        subtitle: "Surfaces the strongest role signals and the proof already helping this resume.",
        primaryTitle: "Strength answer",
        secondaryTitle: "Visible strengths",
        accent: "from-emerald-50 via-white to-teal-50",
      },
      gaps: {
        badge: "Gap diagnosis",
        title: "Biggest Risks And Gaps",
        subtitle: "Focuses on missing proof, weak sections, and the doubts a recruiter may have.",
        primaryTitle: "Gap answer",
        secondaryTitle: "Most important gaps",
        accent: "from-rose-50 via-white to-amber-50",
      },
      rewrite: {
        badge: "Rewrite coach",
        title: "Rewrite Guidance",
        subtitle: "Turns diagnosis into clearer wording and practical rewrite direction.",
        primaryTitle: "Rewrite answer",
        secondaryTitle: "Rewrite priorities",
        accent: "from-violet-50 via-white to-fuchsia-50",
      },
    }[type];

    return {
      type,
      latestQuestion,
      currentReply,
      verdict,
      topFixes,
      highlights: (aiModeAnswer?.highlights || fallbackHighlights).slice(0, 3),
      actions: (aiModeAnswer?.actionPlan || fallbackActions).slice(0, 3),
      config,
    };
  };

  const inferTargetRole = (analysis = result) => {
    const skills = new Set((analysis?.skills || []).map((item) => String(item).toLowerCase()));
    if (skills.has("pytorch") || skills.has("tensorflow") || skills.has("ml")) return "ML Engineer";
    if (skills.has("tableau") || skills.has("analytics") || skills.has("sql")) return "Data Analyst";
    if (skills.has("kubernetes") || skills.has("terraform") || skills.has("docker")) return "DevOps";
    if (skills.has("figma") || skills.has("wireframing") || skills.has("prototype")) return "UI/UX Designer";
    if (skills.has("roadmap") || skills.has("product management") || skills.has("prioritization")) return "Product Manager";
    if (skills.has("customer success") || skills.has("crm") || skills.has("retention")) return "Customer Success";
    return "SDE";
  };

  const buildEditorAudit = () => {
    const feedback = [];
    const summaryText = String(resumeEditor.summary || "");
    const bulletText = (resumeEditor.bullets || []).join(" ");
    const allText = `${summaryText} ${bulletText}`;

    if (summaryText.length < 80) {
      feedback.push({ level: "Medium", detail: "Summary is short. Add role fit, strongest skills, and one proof angle." });
    }
    if (!/\d/.test(allText)) {
      feedback.push({ level: "High", detail: "No visible numbers detected. Add metrics, scale, or measurable outcomes." });
    }
    if (/(hardworking|passionate|team player|self-starter|go-getter)/i.test(allText)) {
      feedback.push({ level: "Medium", detail: "Replace generic buzzwords with proof, scope, or business impact." });
    }
    if (!(resumeEditor.bullets || []).some((item) => /(built|led|designed|improved|optimized|engineered|launched|delivered)/i.test(item))) {
      feedback.push({ level: "Medium", detail: "Use stronger action verbs at the start of bullets." });
    }
    if ((resumeEditor.skills || "").split(",").filter(Boolean).length < 5) {
      feedback.push({ level: "Low", detail: "Skills section looks light. Add more role-relevant tools and technologies." });
    }

    return feedback.slice(0, 5);
  };

  const inferredExampleRole = inferTargetRole(result);
  const activeExampleRole = EXAMPLE_LIBRARY[selectedExampleRole] ? selectedExampleRole : inferredExampleRole;
  const currentExamplePack = EXAMPLE_LIBRARY[activeExampleRole] || EXAMPLE_LIBRARY.SDE;
  const currentExample = currentExamplePack.samples[selectedExampleIndex] || currentExamplePack.samples[0];

  const buildEditorCompletion = () => {
    const checks = [
      !!resumeEditor.headline.trim(),
      (resumeEditor.summary || "").trim().length >= 80,
      (resumeEditor.skills || "").split(",").map((item) => item.trim()).filter(Boolean).length >= 5,
      (resumeEditor.bullets || []).filter((item) => item.trim().length >= 40).length >= 3,
      /\d/.test(`${resumeEditor.summary} ${(resumeEditor.bullets || []).join(" ")}`),
    ];
    const complete = checks.filter(Boolean).length;
    return {
      score: Math.round((complete / checks.length) * 100),
      complete,
      total: checks.length,
    };
  };

  const applyExampleToEditor = () => {
    setResumeEditor((prev) => ({
      ...prev,
      summary: currentExample.summary,
      bullets: currentExample.bullets,
    }));
  };

  const restoreAnalysisIntoEditor = (analysisItem) => {
    if (!analysisItem?.result) return;
    const sourceResult = analysisItem.result;
    setResumeEditor({
      headline: analysisItem.versionLabel || analysisItem.jobDescription?.split("\n")[0] || analysisItem.fileName || "Saved draft",
      summary: summaryDraft || sourceResult.ai_summary || sourceResult.feedback || "",
      skills: (sourceResult.skills || []).slice(0, 12).join(", "),
      bullets: ((sourceResult.bulletPoints || []).slice(0, 6).map((item) => item.improved || item.original)),
    });
    setVersionLabel(analysisItem.versionLabel || analysisItem.fileName || "Saved draft");
  };

  const reopenSavedAnalysis = (analysisItem) => {
    if (!analysisItem?.result) return;
    const sourceResult = analysisItem.result;
    setFile(analysisItem.fileName ? { name: analysisItem.fileName } : null);
    setJd(analysisItem.jobDescription || "");
    setResult(sourceResult);
    setAtsSimulation(analysisItem.ats || sourceResult.atsSimulation || null);
    setSkillGraph(analysisItem.skillGraph || null);
    setSelectedTemplate(analysisItem.template || "classic");
    setVersionLabel(analysisItem.versionLabel || analysisItem.fileName || "Saved draft");
    restoreAnalysisIntoEditor(analysisItem);
    setActiveTab("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSavedAnalysis = (analysisItem) => {
    setSavedAnalyses((prev) =>
      prev.filter(
        (item) =>
          !(
            item?.timestamp === analysisItem?.timestamp &&
            item?.fileName === analysisItem?.fileName &&
            item?.jobDescription === analysisItem?.jobDescription
          )
      )
    );
    setCompareSelection((prev) =>
      prev.filter(
        (item) =>
          !(
            item?.timestamp === analysisItem?.timestamp &&
            item?.fileName === analysisItem?.fileName &&
            item?.jobDescription === analysisItem?.jobDescription
          )
      )
    );
  };

  const filteredSavedAnalyses = savedAnalyses
    .slice()
    .reverse()
    .filter((item) => {
      const haystack = [
        item?.fileName,
        item?.versionLabel,
        item?.jobDescription,
        item?.result?.skills?.join(", "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(historyQuery.trim().toLowerCase());
    });

  const toggleCompareSelection = (analysisItem) => {
    setCompareSelection((prev) => {
      const exists = prev.some(
        (item) =>
          item?.timestamp === analysisItem?.timestamp &&
          item?.fileName === analysisItem?.fileName &&
          item?.jobDescription === analysisItem?.jobDescription
      );
      if (exists) {
        return prev.filter(
          (item) =>
            !(
              item?.timestamp === analysisItem?.timestamp &&
              item?.fileName === analysisItem?.fileName &&
              item?.jobDescription === analysisItem?.jobDescription
            )
        );
      }
      return [...prev.slice(-1), analysisItem];
    });
  };

  const openCompareFromHistory = () => {
    if (compareSelection.length !== 2) return;
    const [left, right] = compareSelection;
    const toCompareEntry = (item, label) => ({
      label,
      fileName: item?.fileName || `${label}.pdf`,
      atsScore: Number(item?.result?.scores?.final || item?.result?.atsCompatibility?.score || 0),
      feedback: item?.result?.feedback || "",
      summary: item?.result?.ai_summary || "",
      keywords: Array.isArray(item?.result?.skills)
        ? item.result.skills.map((skill) => String(skill || "").trim().toLowerCase()).filter(Boolean)
        : [],
      sections: {
        Skills: Math.min(((item?.result?.skills || []).length || 0) * 8, 100),
        Experience: Math.min(((item?.result?.parsed?.experience || []).length || 0) * 24, 100),
        Projects: Math.min(((item?.result?.parsed?.projects || []).length || 0) * 28, 100),
        Education: Math.min(((item?.result?.parsed?.education || []).length || 0) * 34, 100),
      },
      parsed: item?.result?.parsed || {},
    });
    localStorage.setItem(
      "resume-comparison-prefill",
      JSON.stringify({
        createdAt: new Date().toISOString(),
        jobDescription: left?.jobDescription || right?.jobDescription || "",
        left: toCompareEntry(left, "Resume A"),
        right: toCompareEntry(right, "Resume B"),
      })
    );
    window.location.href = "/compare";
  };

  const buildContentAudit = (analysis = result) => {
    if (!analysis) return [];
    const audit = [];

    if ((analysis.missing_skills || []).length) {
      audit.push({
        level: "High",
        title: "Keyword targeting gap",
        detail: `Add or better surface ${(analysis.missing_skills || []).slice(0, 3).join(", ")} where the resume can honestly support them.`,
      });
    }

    if ((analysis.readability?.score || 0) < 70) {
      audit.push({
        level: "Medium",
        title: "Readability needs cleanup",
        detail: "Shorten dense lines, simplify phrasing, and use clearer bullet structure for faster recruiter scanning.",
      });
    }

    if (!(analysis.sections?.projects)) {
      audit.push({
        level: "Medium",
        title: "Project proof is weak or missing",
        detail: "Add 1 to 2 strong projects with tools, ownership, and measurable outcomes.",
      });
    }

    if ((analysis.atsSimulation?.keywords || []).length) {
      audit.push({
        level: "High",
        title: "Missing ATS terms",
        detail: `Your ATS simulation still suggests adding ${(analysis.atsSimulation?.keywords || []).slice(0, 3).join(", ")}.`,
      });
    }

    if ((analysis.actionVerbs || []).length < 4) {
      audit.push({
        level: "Low",
        title: "Action verbs can be stronger",
        detail: "Use more direct verbs to make achievements feel owned and outcome-focused.",
      });
    }

    return audit.slice(0, 5);
  };

  const buildSectionWarnings = (analysis = result) => {
    if (!analysis) return [];
    const warnings = [];

    if (!analysis.sections?.summary) {
      warnings.push({ section: "Summary", level: "High", detail: "Add a short summary aligned to the target role and strongest skills." });
    }
    if (!analysis.sections?.experience) {
      warnings.push({ section: "Experience", level: "High", detail: "Add a clearer experience section with role, scope, and measurable impact bullets." });
    }
    if (!analysis.sections?.projects) {
      warnings.push({ section: "Projects", level: "Medium", detail: "Project proof is limited. Add 1 to 2 role-relevant projects with outcomes." });
    }
    if (!analysis.sections?.skills) {
      warnings.push({ section: "Skills", level: "High", detail: "Add a grouped technical skills section for ATS parsing and recruiter scanning." });
    }
    if ((analysis.readability?.score || 0) < 70) {
      warnings.push({ section: "Formatting", level: "Medium", detail: "The resume may be too dense. Use cleaner bullets, spacing, and shorter phrasing." });
    }

    return warnings.slice(0, 6);
  };

  const getKeywordText = (item) => {
    if (!item) return "";
    return item.keyword || item.skill || item.name || String(item);
  };

  const buildResumeChecklist = (analysis = result) => {
    if (!analysis) return [];
    const missingPriority = (analysis.keywordTargeting?.prioritizedMissing || []).map(getKeywordText);
    const quantifiedBullets = (analysis.bulletPoints || []).some((item) => /\d/.test(item.improved || item.original));

    return [
      {
        label: "Summary aligned to the role",
        status: Boolean(analysis.sections?.summary),
        detail: "A clear professional summary boosts recruiter and ATS confidence.",
      },
      {
        label: "Skills section visible",
        status: Boolean(analysis.sections?.skills),
        detail: "A dedicated skills section helps ATS match your resume to role keywords.",
      },
      {
        label: "Quantified achievements",
        status: quantifiedBullets,
        detail: "Use numbers in bullets to show impact and make your results concrete.",
      },
      {
        label: "ATS-friendly formatting",
        status: (analysis.atsCompatibility?.score || 0) >= 70,
        detail: "Avoid tables, columns, and decorative formatting for better ATS parsing.",
      },
      {
        label: "Top targeted keywords present",
        status: (missingPriority.length === 0),
        detail: missingPriority.length
          ? `Add ${missingPriority.slice(0, 3).join(", ")} in people-friendly resume sections.`
          : "Your top terms already appear in the resume.",
      },
    ];
  };

  const buildTailoringHighlights = (analysis = result) => {
    if (!analysis) return [];
    const highlights = [];
    const missingPriority = (analysis.keywordTargeting?.prioritizedMissing || []).slice(0, 3);

    if (missingPriority.length) {
      highlights.push(`Add ${missingPriority.map((item) => getKeywordText(item)).join(", ")} in ${missingPriority[0].placement || missingPriority[0].role || "experience"}.`);
    }

    if ((analysis.missing_skills || []).length) {
      highlights.push(`Surface ${analysis.missing_skills.slice(0, 3).join(", ")} as proven skills on your top line.`);
    }

    if ((analysis.improvements || []).length) {
      highlights.push(`Focus on: ${analysis.improvements.slice(0, 2).map((item) => item.action).join("; ")}.`);
    }

    return highlights.slice(0, 5);
  };

  const aiModeDisplay = buildAiModeDisplay(result);

  const getScoreMeta = (score = 0, type = "general") => {
    const numeric = Number(score || 0);

    if (type === "match") {
      if (numeric >= 85) return { label: "Strong fit", note: "Your resume is closely aligned to the JD.", color: "text-emerald-600" };
      if (numeric >= 70) return { label: "Competitive", note: "You have a solid match with a few gaps to close.", color: "text-teal-600" };
      if (numeric >= 55) return { label: "Partial fit", note: "Some relevant overlap is there, but keywords and proof need work.", color: "text-amber-600" };
      return { label: "Needs targeting", note: "The resume is not yet closely aligned to this job description.", color: "text-rose-600" };
    }

    if (type === "readability") {
      if (numeric >= 85) return { label: "Easy to scan", note: "The resume reads clearly and should be recruiter-friendly.", color: "text-emerald-600" };
      if (numeric >= 70) return { label: "Mostly clear", note: "Readable overall, with some room to tighten wording.", color: "text-teal-600" };
      if (numeric >= 55) return { label: "A bit dense", note: "Shorter bullets and simpler phrasing would help.", color: "text-amber-600" };
      return { label: "Hard to scan", note: "The resume likely feels dense or uneven in structure.", color: "text-rose-600" };
    }

    if (type === "compat") {
      if (numeric >= 85) return { label: "ATS-safe", note: "Formatting and structure look strong for ATS parsing.", color: "text-emerald-600" };
      if (numeric >= 70) return { label: "Mostly safe", note: "Good base, but a few structural fixes are still worth making.", color: "text-teal-600" };
      if (numeric >= 55) return { label: "Some risk", note: "Certain formatting or section issues may hurt parsing.", color: "text-amber-600" };
      return { label: "High risk", note: "ATS parsing may struggle with the current layout or structure.", color: "text-rose-600" };
    }

    if (numeric >= 85) return { label: "Strong", note: "This resume is in a healthy range for ATS and recruiter review.", color: "text-emerald-600" };
    if (numeric >= 70) return { label: "Competitive", note: "This is a decent base with a few meaningful upgrades left.", color: "text-teal-600" };
    if (numeric >= 55) return { label: "Needs work", note: "Important gaps are still holding the score back.", color: "text-amber-600" };
    return { label: "Weak", note: "This resume needs stronger targeting, structure, and proof.", color: "text-rose-600" };
  };

  const buildBulletScorecards = (analysis = result) => {
    if (!analysis) return [];
    return (analysis.bulletPoints || []).slice(0, 5).map((item, index) => {
      const improved = String(item.improved || "");
      const score = Math.max(
        52,
        Math.min(
          92,
          55 +
            (/\d/.test(improved) ? 18 : 0) +
            (/(led|built|designed|improved|optimized|engineered|delivered|launched)/i.test(improved) ? 12 : 0) +
            (improved.length > 85 ? 8 : 0)
        )
      );
      return {
        id: `${item.original}-${index}`,
        original: item.original,
        improved,
        score,
        status: score >= 80 ? "Strong" : score >= 65 ? "Needs polish" : "Weak",
      };
    });
  };

  const applyKeywordSuggestion = (keyword) => {
    if (!keyword) return;
    setJd((prev) => {
      if ((prev || "").toLowerCase().includes(String(keyword).toLowerCase())) return prev;
      return `${prev || ""}${prev ? "\n" : ""}${keyword}`;
    });
  };

  const inferInterviewRole = (analysis = result) => {
    const skillSet = new Set((analysis?.skills || []).map((item) => String(item).toLowerCase()));
    if (skillSet.has("pytorch") || skillSet.has("tensorflow") || skillSet.has("ml")) return "ML Engineer";
    if (skillSet.has("tableau") || skillSet.has("power bi") || skillSet.has("analytics")) return "Data Analyst";
    if (skillSet.has("kubernetes") || skillSet.has("terraform") || skillSet.has("docker")) return "DevOps";
    return "SDE";
  };

  const saveAiSession = ({ analysis = result, answer, history }) => {
    if (!analysis || !answer?.reply) return;
    const session = {
      id: Date.now(),
      ts: new Date().toISOString(),
      fileName: file?.name || "resume",
      jdTitle: jd ? jd.split("\n")[0].slice(0, 80) : "General analysis",
      answer,
      history: history || aiModeHistory,
      atsScore: analysis.scores?.final || 0,
      matchRate: Math.round((analysis.match_rate || 0) * 100),
    };
    setSavedAiSessions((prev) => [session, ...prev].slice(0, 8));
  };

  const restoreAiSession = (session) => {
    if (!session) return;
    setAiModeAnswer(session.answer || null);
    setAiModeHistory(Array.isArray(session.history) ? session.history : []);
    setStreamedAiReply(session.answer?.reply || "");
    setAiStreamStatus("done");
    setAiStreamError("");
  };

  const sendToInterviewPrep = () => {
    const payload = {
      jd,
      role: inferInterviewRole(result),
      company: "Any",
      questions: buildRecruiterQuestions(result),
      source: "resume-analyzer",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("resumeai_interview_prefill", JSON.stringify(payload));
    window.location.href = "/interview";
  };

  const copyAiAnswer = async () => {
    const text = aiModeAnswer?.reply || streamedAiReply;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1800);
    } catch {
      setAiStreamError("Copy failed. Please try again.");
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1800);
    } catch {
      setError("Failed to copy the share link.");
    }
  };

  const createShareableResume = async () => {
    if (!result) return;
    setShareLoading(true);
    setError("");
    try {
      const response = await api.createResumeShare({
        headline: resumeEditor.headline || file?.name?.replace(/\.[^.]+$/, "") || "Resume Draft",
        versionLabel: versionLabel || "Working draft",
        template: selectedTemplate,
        summary: resumeEditor.summary || summaryDraft || result.ai_summary || "",
        skills: resumeEditor.skills || (result.skills || []).slice(0, 12).join(", "),
        bullets: (resumeEditor.bullets || []).slice(0, 8),
        keywords: (result.missing_skills || []).slice(0, 12),
      });
      const nextLink = `${window.location.origin}${response.path}`;
      setShareLink(nextLink);
      await navigator.clipboard.writeText(nextLink).catch(() => {});
    } catch (err) {
      setError(err.message || "Failed to create share link.");
    } finally {
      setShareLoading(false);
    }
  };

  const generateSummaryDraft = async () => {
    if (!result) {
      setError("Analyze your resume first to generate a summary.");
      return;
    }

    setSummaryLoading(true);
    setError("");
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Write a recruiter-ready professional summary for this resume. Keep it to 2-4 lines, ATS-friendly, honest, and tailored to the target role. Mention strongest skills and one concrete proof angle if possible.

Resume analysis:
${buildResumeBrief(result)}

Job description:
${jd || "No job description was provided."}`,
          },
        ],
        mode: "customize",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });
      setSummaryDraft((response.reply || "").trim());
    } catch (err) {
      setError(err.message || "Failed to generate summary draft.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const downloadAiSnapshot = () => {
    if (!result) return;
    const lines = [
      "AI MODE SNAPSHOT",
      "=".repeat(40),
      `Title: ${aiModeAnswer?.title || "AI Mode answer"}`,
      "",
      "ANSWER",
      aiModeAnswer?.reply || streamedAiReply || "No AI answer available.",
      "",
      "RECRUITER VERDICT",
      `Label: ${aiModeAnswer?.recruiterVerdict?.label || "N/A"}`,
      `Confidence: ${aiModeAnswer?.recruiterVerdict?.confidence || "N/A"}`,
      `Decision: ${aiModeAnswer?.recruiterVerdict?.decision || "N/A"}`,
      `Risk: ${aiModeAnswer?.recruiterVerdict?.risk || "N/A"}`,
      "",
      "KEY TAKEAWAYS",
      ...(aiModeAnswer?.highlights || []).map((item) => `- ${item}`),
      "",
      "ACTION PLAN",
      ...(aiModeAnswer?.actionPlan || []).map((item, index) => `${index + 1}. ${item}`),
      "",
      "CORE ANALYSIS",
      `ATS Score: ${result.scores?.final || "N/A"}`,
      `Match Rate: ${Math.round((result.match_rate || 0) * 100)}%`,
      `Readability: ${result.readability?.score || "N/A"}`,
      `Top Skills: ${(result.skills || []).slice(0, 8).join(", ") || "None"}`,
      `Missing Skills: ${(result.missing_skills || []).slice(0, 8).join(", ") || "None"}`,
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-mode-snapshot.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateEditorBullet = (index, value) => {
    setResumeEditor((prev) => ({
      ...prev,
      bullets: (prev.bullets || []).map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const regenerateEditorSummary = async () => {
    if (!result) return;
    setEditorAiLoading((prev) => ({ ...prev, summary: true }));
    setError("");
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Rewrite the professional summary for this resume draft. Keep it ATS-friendly, specific, and tailored to the target role. Use 2 to 4 lines and stay honest.

Current summary:
${resumeEditor.summary || summaryDraft || result.ai_summary || ""}

Resume context:
${buildResumeBrief(result)}

Job description:
${jd || "No job description provided."}`,
          },
        ],
        mode: "customize",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });
      const nextSummary = (response.reply || "").trim();
      if (nextSummary) {
        setResumeEditor((prev) => ({ ...prev, summary: nextSummary }));
        setSummaryDraft(nextSummary);
      }
    } catch (err) {
      setError(err.message || "Failed to rewrite summary.");
    } finally {
      setEditorAiLoading((prev) => ({ ...prev, summary: false }));
    }
  };

  const regenerateEditorSkills = async () => {
    if (!result) return;
    setEditorAiLoading((prev) => ({ ...prev, skills: true }));
    setError("");
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Rewrite the skills section for this resume draft. Return one clean comma-separated skills line with the strongest ATS-relevant skills first. Do not invent unsupported skills.

Current skills:
${resumeEditor.skills || (result.skills || []).join(", ")}

Resume context:
${buildResumeBrief(result)}

Job description:
${jd || "No job description provided."}`,
          },
        ],
        mode: "customize",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });
      const nextSkills = (response.reply || "").replace(/\n+/g, " ").trim();
      if (nextSkills) {
        setResumeEditor((prev) => ({ ...prev, skills: nextSkills }));
      }
    } catch (err) {
      setError(err.message || "Failed to rewrite skills.");
    } finally {
      setEditorAiLoading((prev) => ({ ...prev, skills: false }));
    }
  };

  const regenerateEditorBullet = async (index) => {
    if (!result) return;
    const currentBullet = resumeEditor.bullets?.[index] || "";
    setEditorAiLoading((prev) => ({ ...prev, bulletIndex: index }));
    setError("");
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Rewrite this resume bullet to be stronger, more specific, and more ATS-friendly. Prefer action + scope + result. Add numbers only if supported by the draft context. Return only the rewritten bullet.

Current bullet:
${currentBullet}

Resume context:
${buildResumeBrief(result)}

Job description:
${jd || "No job description provided."}`,
          },
        ],
        mode: "resume",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });
      const nextBullet = (response.reply || "").replace(/\n+/g, " ").trim();
      if (nextBullet) {
        // Save suggestion for user to accept or dismiss
        setBulletSuggestions((prev) => ({ ...prev, [index]: nextBullet }));
      }
    } catch (err) {
      setError(err.message || "Failed to rewrite bullet.");
    } finally {
      setEditorAiLoading((prev) => ({ ...prev, bulletIndex: null }));
    }
  };

  const applyBulletSuggestion = (index) => {
    const suggestion = bulletSuggestions?.[index];
    if (!suggestion) return;
    updateEditorBullet(index, suggestion);
    setBulletSuggestions((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const dismissBulletSuggestion = (index) => {
    setBulletSuggestions((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const buildResumeDraftText = () => {
    const sections = [
      "AI OPTIMIZED RESUME DRAFT",
      "=".repeat(40),
      "",
      `TEMPLATE: ${TEMPLATE_PRESETS[selectedTemplate]?.name || "Classic ATS"}`,
      `VERSION: ${versionLabel || "Working draft"}`,
      "",
      "TARGET ROLE",
      resumeEditor.headline || (jd ? jd.split("\n")[0] : "General target role"),
      "",
      "PROFESSIONAL SUMMARY",
      resumeEditor.summary || summaryDraft || result?.ai_summary || "Generate a summary draft to populate this section.",
      "",
      "TOP SKILLS",
      resumeEditor.skills || (result?.skills || []).slice(0, 12).join(", ") || "No skills detected",
      "",
      "IMPROVED BULLETS",
      ...((resumeEditor.bullets || []).slice(0, 6).map((item, index) => `${index + 1}. ${item}`)),
      "",
      "TAILORING ACTIONS",
      ...((tailoredResume?.actions || []).slice(0, 6).map((item, index) => `${index + 1}. ${item.advice}`)),
      "",
      "KEYWORDS TO TARGET",
      (result?.missing_skills || []).slice(0, 10).join(", ") || "No major keyword gaps detected",
    ];

    return sections.join("\n");
  };

  const downloadResumeDraftTxt = () => {
    if (!result) return;
    const blob = new Blob([buildResumeDraftText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-draft.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadResumeDraftDoc = () => {
    if (!result) return;
    const bullets = (rewriteResult?.improvedBullets || result?.bulletPoints || []).slice(0, 6);
    const actions = (tailoredResume?.actions || []).slice(0, 6);
    const keywords = (result?.missing_skills || []).slice(0, 10);
    const preset = TEMPLATE_PRESETS[selectedTemplate] || TEMPLATE_PRESETS.classic;
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resume Draft</title>
          <style>
            body { font-family: ${preset.font}; color: #1f2937; margin: 32px; line-height: 1.5; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: ${preset.accent}; }
            p, li { font-size: 12pt; }
            ul { margin-top: 8px; }
            .muted { color: #64748b; }
          </style>
        </head>
        <body>
          <h1>${resumeEditor.headline || file?.name?.replace(/\.[^.]+$/, "") || "AI Resume Draft"}</h1>
          <p class="muted">Template: ${preset.name} • Version: ${versionLabel || "Working draft"}</p>

          <h2>Professional Summary</h2>
          <p>${resumeEditor.summary || summaryDraft || result?.ai_summary || "Generate a summary draft to populate this section."}</p>

          <h2>Top Skills</h2>
          <p>${resumeEditor.skills || (result?.skills || []).slice(0, 12).join(", ") || "No skills detected"}</p>

          <h2>Improved Experience Bullets</h2>
          <ul>
            ${((resumeEditor.bullets || []).length ? resumeEditor.bullets : bullets.map((item) => item.improved || item.original))
              .slice(0, 6)
              .map((item) => `<li>${item}</li>`)
              .join("")}
          </ul>

          <h2>Tailoring Actions</h2>
          <ul>
            ${actions.length ? actions.map((item) => `<li>${item.advice}</li>`).join("") : "<li>No tailoring actions generated yet.</li>"}
          </ul>

          <h2>Keywords To Target</h2>
          <p>${keywords.join(", ") || "No major keyword gaps detected"}</p>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-draft.doc";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runAiModeAnalysis = async ({ question, analysis = result }) => {
    if (!analysis) return;
    const nextQuestion = question.trim();
    if (!nextQuestion) return;

    aiModeAbortRef.current?.abort();
    const controller = new AbortController();
    aiModeAbortRef.current = controller;
    setAiModeLoading(true);
    setStreamedAiReply("");
    setAiStreamStatus("streaming");
    setAiStreamError("");
    const historyMessages = [...aiModeHistory, { role: "user", content: nextQuestion }].slice(-8);
    try {
      let finalMeta = null;
      let replyBuffer = "";
      setAiModeAnswer((prev) => ({
        title: prev?.title || "AI Mode answer",
        reply: "",
        highlights: prev?.highlights || [],
        actionPlan: prev?.actionPlan || [],
        followUps: prev?.followUps || aiModePrompts,
        recruiterVerdict: prev?.recruiterVerdict || null,
      }));

      await api.chatStream({
        messages: historyMessages,
        mode: "ai-mode",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(analysis),
        jobDescription: jd,
      }, {
        signal: controller.signal,
        onEvent: (event, payload) => {
          if (event === "chunk" && typeof payload?.text === "string") {
            replyBuffer += payload.text;
            setStreamedAiReply(replyBuffer);
          }
          if (event === "meta" && payload && typeof payload === "object") {
            finalMeta = payload;
          }
        },
      });

      const reply = replyBuffer.trim() || finalMeta?.reply || "I could not generate an AI mode answer.";
      setAiStreamStatus("done");
      const nextAnswer = {
        title: finalMeta?.title || "AI Mode answer",
        reply,
        highlights: Array.isArray(finalMeta?.highlights) ? finalMeta.highlights : [],
        actionPlan: Array.isArray(finalMeta?.actionPlan) ? finalMeta.actionPlan : [],
        followUps: Array.isArray(finalMeta?.followUps) ? finalMeta.followUps : aiModePrompts,
        recruiterVerdict: finalMeta?.recruiterVerdict || null,
      };
      const nextHistory = [...historyMessages, { role: "assistant", content: reply }].slice(-10);
      setAiModeAnswer(nextAnswer);
      setAiModeHistory(nextHistory);
      saveAiSession({ analysis, answer: nextAnswer, history: nextHistory });
    } catch (err) {
      if (err.name === "AbortError") {
        setAiStreamStatus("stopped");
        return;
      }
      setAiStreamStatus("error");
      setAiStreamError(err.message || "AI mode could not generate a response.");
      setAiModeAnswer({
        title: "AI Mode answer",
        reply: err.message || "AI mode could not generate a response.",
        highlights: [],
        actionPlan: [],
        followUps: aiModePrompts,
        recruiterVerdict: null,
      });
      setAiModeHistory(historyMessages);
    } finally {
      if (aiModeAbortRef.current === controller) {
        aiModeAbortRef.current = null;
      }
      setAiModeLoading(false);
    }
  };

  const stopAiModeStream = () => {
    aiModeAbortRef.current?.abort();
    aiModeAbortRef.current = null;
    setAiModeLoading(false);
    setAiStreamStatus("stopped");
  };

  const buildSkillGraph = (skills, missing) => {
    const nodes = skills.map((skill) => ({ id: skill, type: "known", size: 18 }));
    const nots = missing.map((skill) => ({ id: skill, type: "gap", size: 14 }));
    const edges = [];
    skills.forEach((skill) => {
      missing.slice(0, 2).forEach((gap) => { edges.push({ source: skill, target: gap }); });
    });
    return { nodes: [...nodes, ...nots], edges };
  };

  const detectFakeExperience = (data = {}) => {
    const skills = data.skills || [];
    const resumeName = file?.name?.toLowerCase() || "";
    const warnings = [];
    if (!data.experience && skills.length > 8) warnings.push("High skill count with missing experience details may look inflated.");
    if (resumeName.includes("trainee") && skills.length > 6) warnings.push("Trainee file has many senior skills; please ensure claims are evidence-backed.");
    if (skills.includes("Photoshop") && data.match_rate >= 80 && data.skills.some((s) => s === "C++")) warnings.push("Cross-domain skills should be supported by real project evidence.");
    return warnings;
  };

  const runAtsSimulation = (data = {}, jobDesc = "") => {
    const yourSkills = new Set(data.skills || []);
    const required = data.job_skills?.length
      ? data.job_skills
      : (jobDesc.match(/\b[A-Za-z0-9_+-]+\b/g) || []).filter((w) => w.length > 2);
    const requiredSet = new Set(required);
    const matchCount = Array.from(requiredSet).filter((k) => yourSkills.has(k)).length;
    const keywordCoverage = requiredSet.size ? (matchCount / requiredSet.size) * 100 : Math.round((data.match_rate || 0) * 100);
    const score = Math.min(
      100,
      Math.round(((data.scores?.final || 0) * 0.75) + (keywordCoverage * 0.25))
    );
    const rejectionProbability = Math.min(
      95,
      Math.max(5, Math.round((100 - score) * 0.7 + Math.max(0, 3 - matchCount) * 6))
    );
    const suggested = Array.from(requiredSet).filter((k) => !yourSkills.has(k)).slice(0, 5);
    return { score, matchCount, requiredCount: requiredSet.size, rejectionProbability: Math.min(95, rejectionProbability), keywords: suggested };
  };

  const calculateHiringProbability = (simulation = {}, data = {}) => {
    const base = simulation?.score || 60;
    const condition = data.scores?.final || 60;
    const value = Math.min(99, Math.max(10, Math.round((base * 0.55 + condition * 0.45) / 1)));
    return `${value}%`;
  };

  // Helper functions to generate analysis data
  const generateHeatmap = (data = {}) => {
    return [
      { section: "Summary", score: data.sections?.summary ? 80 : 35, status: data.sections?.summary ? "strong" : "weak" },
      { section: "Experience", score: data.sections?.experience ? 78 : 35, status: data.sections?.experience ? "strong" : "weak" },
      { section: "Education", score: data.sections?.education ? 82 : 40, status: data.sections?.education ? "strong" : "weak" },
      { section: "Skills", score: data.sections?.skills ? 84 : 42, status: data.sections?.skills ? "strong" : "weak" },
      { section: "Projects", score: data.sections?.projects ? 72 : 34, status: data.sections?.projects ? "moderate" : "weak" },
    ];
  };

  const generateBulletPoints = (data = {}) => {
    const missing = data.missing_skills || [];
    return [
      {
        original: "Worked on projects and responsibilities.",
        improved: `Rewrite this bullet with action + metric + result, and mention ${missing[0] || "a target-role keyword"} where it is genuinely supported.`,
      },
      {
        original: "Used tools for development tasks.",
        improved: `Name the exact tools used, the scale of work, and the outcome delivered. Consider adding ${missing[1] || "clear technical depth"}.`,
      },
    ];
  };

  const generateKeywords = (data) => {
    const present = data.skills || [];
    const missing = data.keywordStats?.missing || data.missing_skills || [];
    
    const frequency = {};
    (data.scores?.keyword_density || []).forEach((item) => {
      frequency[item.keyword] = item.freq;
    });

    return {
      present,
      missing,
      frequency
    };
  };

  const generateFormatting = (data = {}) => {
    return {
      score: data.scores?.sub?.formatting || 70,
      issues: data.formatting?.issues || [
        "Add more bullet points for experience clarity",
        "Keep section headings clean and ATS-friendly",
      ]
    };
  };

  const generateAtsCompatibility = (data = {}) => {
    return {
      score: data.atsCompatibility?.score || data.scores?.sub?.formatting || 72,
      details: data.atsCompatibility?.details || [
        "Use standard section names",
        "Avoid complex columns and tables",
      ]
    };
  };

  const generateImprovements = (data) => {
    const missing = data.missing_skills || [];
    const improvements = [];

    if (missing.length > 0) {
      improvements.push({
        priority: "High",
        action: `Add ${missing.slice(0, 2).join(" and ")} skills`,
        impact: "+12 points"
      });
    }

    improvements.push(
      {
        priority: "High",
        action: "Include quantifiable metrics in bullets",
        impact: "+10 points"
      },
      {
        priority: "Medium",
        action: "Add Projects section",
        impact: "+8 points"
      },
      {
        priority: "Medium",
        action: "Expand professional summary",
        impact: "+5 points"
      }
    );

    return improvements;
  };

  const downloadReport = () => {
    if (!result) return;
    const lines = [
      "AI RESUME ANALYZER - COMPREHENSIVE REPORT",
      "=".repeat(60),
      "",
      "OVERALL SCORES",
      "-".repeat(60),
      `ATS Score: ${result.scores?.final || "N/A"}/100`,
      `Match Rate: ${Math.round((result.match_rate || 0) * 100)}%`,
      `Readability: ${result.readability?.score || "N/A"}/100`,
      `ATS Compatibility: ${result.atsCompatibility?.score}/100`,
      "",
      "SCORE BREAKDOWN",
      "-".repeat(60),
      `Keywords: ${result.scores?.sub?.keywords}`,
      `Structure: ${result.scores?.sub?.structure}`,
      `Impact: ${result.scores?.sub?.impact}`,
      `Formatting: ${result.scores?.sub?.formatting}`,
      "",
      "YOUR SKILLS",
      "-".repeat(60),
      (result.skills || []).map(s => `  ✓ ${s}`).join("\n"),
      "",
      "MISSING SKILLS",
      "-".repeat(60),
      (result.missing_skills || []).map(s => `  ✗ ${s}`).join("\n"),
      "",
      "TOP IMPROVEMENTS",
      "-".repeat(60),
      (result.improvements || []).map(i => `  [${i.priority}] ${i.action} (${i.impact})`).join("\n"),
      "",
      "FEEDBACK",
      "-".repeat(60),
      result.feedback || "No feedback available.",
      "",
      "Generated by AI Resume Analyzer"
    ].join("\n");
    
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-analysis-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAnalysis = async () => {
    if (!result) return;
    
    setSaveLoading(true);
    try {
      const analysisData = buildAnalysisHistoryEntry();
      upsertSavedAnalysis(analysisData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError("Failed to save analysis");
      console.error("Save error:", err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAITailor = async () => {
    if (!result) {
      setError("Analyze your resume first for auto-tailoring.");
      return;
    }

    setError("");
    setRewriteLoading(true);
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Tailor this resume for the provided job description. Give a concise recruiter-ready tailoring package with:
1. A one-line headline
2. 4 prioritized actions
3. 3 rewritten resume bullets
4. 3 recruiter-fit reasons

Resume context:
${buildResumeBrief(result)}

Job description:
${jd || "No job description was provided. Tailor for the apparent target role."}`,
          },
        ],
        mode: "customize",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });

      const lines = String(response.reply || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const bullets = lines.filter((line) => /^[-*•\d]/.test(line));
      setTailoredResume({
        headline: response.title || `Customized for ${jd ? jd.split("\n")[0] : "target role"}`,
        actions: (bullets.slice(0, 4).map((line, idx) => ({
          step: idx + 1,
          advice: line.replace(/^[-*•\d.\s]+/, ""),
        })) || []).length
          ? bullets.slice(0, 4).map((line, idx) => ({
              step: idx + 1,
              advice: line.replace(/^[-*•\d.\s]+/, ""),
            }))
          : (result.missing_skills || []).slice(0, 4).map((skill, idx) => ({
              step: idx + 1,
              advice: `Highlight ${skill} in your top bullets and summary where you have real evidence.`,
            })),
        rewriteSuggestions: (result.bulletPoints || []).slice(0, 3).map((item, idx) => ({
          original: item.original,
          improved: bullets[idx + 4]?.replace(/^[-*•\d.\s]+/, "") || item.improved,
        })),
        recruiterReasons: bullets.slice(7, 10).map((line) => line.replace(/^[-*•\d.\s]+/, "")),
        rawReply: response.reply || "",
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2700);
    } catch (err) {
      setError(err.message || "Failed to tailor resume.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleTailorForJob = async () => {
    if (!file) {
      setError("Upload your resume first to use the tailored resume writer.");
      return;
    }
    if (!jd) {
      setError("Provide a job description so the tailored resume matches a specific role.");
      return;
    }

    setError("");
    setRewriteLoading(true);
    try {
      const parseForm = new FormData();
      parseForm.append("file", file);
      const parsed = await api.parseResume(parseForm);
      const resumeText = parsed?.text || "";

      const response = await api.tailorResumeForJob(resumeText, jd);
      const keywordObj = response.keyword_optimization || response.keywordOptimization || {};
      let keywordList = [];
      if (Array.isArray(keywordObj)) {
        keywordList = keywordObj;
      } else if (keywordObj && typeof keywordObj === "object") {
        if (Array.isArray(keywordObj.missing_keywords) && keywordObj.missing_keywords.length) {
          keywordList = keywordObj.missing_keywords;
        } else if (Array.isArray(keywordObj.matched_keywords) && keywordObj.matched_keywords.length) {
          keywordList = keywordObj.matched_keywords;
        } else {
          // collect any string entries from object values
          keywordList = Object.values(keywordObj)
            .flat()
            .filter((v) => typeof v === "string");
        }
      }

      setTailoredResume({
        headline: `Tailored for ${jd.split("\n")[0] || "target role"}`,
        tailoredText: response.tailored_resume || "",
        atsScore: response.ats_score || 0,
        recommendations: (response.recommendations || []).map((rec) => {
          if (!rec) return "";
          if (typeof rec === "string") return rec;
          return `${rec.priority || "note"}: ${rec.issue || rec.fix || JSON.stringify(rec)}`;
        }),
        actions: (response.recommendations || []).slice(0, 4).map((rec, idx) => ({ step: idx + 1, advice: typeof rec === "string" ? rec : rec.fix || rec.issue || JSON.stringify(rec) })),
      });

      // Surface keyword guidance into the main analysis state so UI components pick it up
      setResult((prev) => {
        const prevState = prev || {};
        const newAtsSim = { ...(prevState.atsSimulation || {}), keywords: keywordList, score: response.ats_score || prevState.atsSimulation?.score };
        return { ...prevState, atsSimulation: newAtsSim, keywordTargeting: prevState.keywordTargeting || {} };
      });
      setAtsSimulation((prev) => ({ ...(prev || {}), keywords: keywordList, score: response.ats_score || prev?.score }));

      setNotice("Tailored resume package created from the job description.");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2700);
    } catch (err) {
      setError(err.message || "Failed to tailor resume.");
      console.error("Tailor error:", err);
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!file || !jd) {
      setError("Upload a resume and provide a job description to generate cover letter.");
      return;
    }
    setError("");
    setRewriteLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("job_description", jd);
      const payload = await api.coverLetter(form).catch(() => ({ letter: null }));
      const candidateName = file?.name?.split(".")[0] || "Candidate";
      const letter = payload?.letter || `Dear Hiring Team,\n\nI am excited to apply for the position described. With strong experience in ${result.skills?.slice(0, 3).join(", ")}, I can deliver immediate impact ...\n\nSincerely, ${candidateName}`;
      setCoverLetter(letter);
    } catch (err) {
      setError(err.message || "Failed to generate cover letter.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleAIRewrite = async () => {
    if (!result) {
      setError("Please analyze your resume first");
      return;
    }
    
    setRewriteLoading(true);
    try {
      const response = await api.chat({
        messages: [
          {
            role: "user",
            content: `Rewrite the weakest resume bullets into stronger achievement bullets. Return concise, polished text grounded in this resume analysis. Prefer action + scope + metric + outcome. If exact metrics are missing, keep the bullet honest and stronger without inventing numbers.

Resume analysis:
${buildResumeBrief(result)}

Target JD:
${jd || "No job description provided."}`,
          },
        ],
        mode: "resume",
        role: "Resume Strategist",
        language: "English",
        explainSimple: false,
        resumeText: buildAiModeResumeText(result),
        jobDescription: jd,
      });

      const bulletLines = String(response.reply || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[-*•\d]/.test(line))
        .map((line) => line.replace(/^[-*•\d.\s]+/, ""))
        .slice(0, 5);

      const rewriteData = {
        originalBullets: result.bulletPoints || [],
        improvedBullets: (result.bulletPoints || []).slice(0, 5).map((item, idx) => ({
          original: item.original,
          improved: bulletLines[idx] || item.improved,
        })),
        summary: response.reply || "Your resume has been enhanced with more impactful language and clearer achievement framing.",
        tips: [
          "✓ Added specific metrics and percentages",
          "✓ Used stronger action verbs",
          "✓ Emphasized business impact",
          "✓ Included quantifiable results",
          "✓ Improved readability and flow"
        ]
      };

      setRewriteResult(rewriteData);
      setActiveTab("overview");
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to rewrite resume");
      console.error("Rewrite error:", err);
    } finally {
      setRewriteLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "breakdown", label: "ATS Breakdown", icon: "📈" },
    { id: "skills", label: "Skills", icon: "🎯" },
    { id: "heatmap", label: "Heatmap", icon: "🔥" },
    { id: "skillgraph", label: "Skill Graph", icon: "🧩" },
    { id: "simulation", label: "ATS Simulation", icon: "🧠" },
    { id: "bullets", label: "Bullets", icon: "✍️" },
    { id: "keywords", label: "Keywords", icon: "🔑" },
    { id: "formatting", label: "Formatting", icon: "📋" },
    { id: "improvements", label: "Improvements", icon: "⭐" },
    { id: "actionverbs", label: "Action Verbs", icon: "💪" },
    { id: "metrics", label: "Metrics", icon: "📊" },
    { id: "sections", label: "Sections", icon: "📑" },
    { id: "checklist", label: "Checklist", icon: "🧾" },
    { id: "atscheck", label: "ATS Check", icon: "✅" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="pill-primary">
            <span>⚡</span>
            <span>Resume Analysis</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Resume Analyzer</h1>
        <p className="text-lg text-slate-600">Upload your resume and get detailed ATS analysis with actionable improvements</p>
        {notice && <div className="alert-success mt-4">{notice}</div>}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="card-elevated p-6 space-y-6 sticky top-6">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(99,102,241,0.08),rgba(251,146,60,0.08))] p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="pill-primary">AI Analysis Modes</div>
                      <h3 className="mt-3 font-semibold text-slate-900">Choose how this analyzer works</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Standard mode gives the classic ATS report. AI mode adds a conversational answer experience inspired by search-style AI summaries.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 p-1 shadow-sm">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setAiMode(false)}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            !aiMode ? "bg-slate-900 text-white shadow-sm" : "text-slate-600"
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiMode(true)}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            aiMode ? "bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 text-white shadow-lg" : "text-slate-600"
                          }`}
                        >
                          AI Mode
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={`rounded-2xl border p-3 ${aiMode ? "border-teal-200 bg-white/85" : "border-slate-200 bg-slate-50/80"}`}>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Direct answer</div>
                      <div className="mt-2 text-sm text-slate-700">Starts with a synthesized answer instead of making you inspect tabs first.</div>
                    </div>
                    <div className={`rounded-2xl border p-3 ${aiMode ? "border-cyan-200 bg-white/85" : "border-slate-200 bg-slate-50/80"}`}>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Evidence + gaps</div>
                      <div className="mt-2 text-sm text-slate-700">Surfaces strongest signals, recruiter risks, and the fastest fixes for shortlist readiness.</div>
                    </div>
                    <div className={`rounded-2xl border p-3 ${aiMode ? "border-indigo-200 bg-white/85" : "border-slate-200 bg-slate-50/80"}`}>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Follow-up prompts</div>
                      <div className="mt-2 text-sm text-slate-700">Lets you ask focused follow-ups like a search assistant without leaving the analyzer.</div>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900">Upload Resume</h3>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-input"
                />
                <label
                  htmlFor="resume-input"
                  className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition"
                >
                  <span className="text-3xl mb-2">📤</span>
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-900">✓ {file.name}</p>
                      <p className="text-xs text-slate-600 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">Click to upload</p>
                      <p className="text-xs text-slate-600 mt-1">PDF format recommended</p>
                    </div>
                  )}
                </label>
              </div>

              {file && (
                <button
                  onClick={() => setFile(null)}
                  className="btn-ghost w-full text-sm text-rose-600 hover:bg-rose-50"
                >
                  Remove file
                </button>
              )}
            </div>

            <div className="divider" />

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Job Description</h3>
              <textarea
                className="textarea text-sm"
                rows={6}
                placeholder="Paste the job description here for tailored analysis..."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
            </div>

            {error && (
              <div className="alert-danger">
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className="btn-primary w-full"
            >
              {loading ? (aiMode ? "Analyzing with AI Mode..." : "Analyzing...") : (aiMode ? "Analyze in AI Mode" : "Analyze Resume")}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <div className="card-elevated p-12 text-center space-y-4">
              <span className="text-6xl">📄</span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No analysis yet</h3>
                <p className="text-slate-600 mt-1">{aiMode ? "Upload a resume to unlock the AI answer layer and guided follow-up prompts." : "Upload a resume to get started"}</p>
              </div>
            </div>
          ) : (
            <>
              {aiMode && (
                <div className={`card-elevated overflow-hidden border-0 bg-gradient-to-br ${aiModeDisplay.config.accent} p-0`}>
                  <div className="border-b border-white/70 px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="pill-primary">AI Mode</div>
                          <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                            {aiModeDisplay.config.badge}
                          </div>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">
                          {aiModeAnswer?.title || aiModeDisplay.config.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {aiModeDisplay.config.subtitle}
                        </p>
                        {aiModeDisplay.latestQuestion && (
                          <div className="mt-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-slate-700">
                            <span className="mr-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest question</span>
                            {aiModeDisplay.latestQuestion}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => runAiModeAnalysis({
                          question: "Refresh the AI mode answer with the current resume analysis and job description.",
                        })}
                        disabled={aiModeLoading}
                        className="btn-secondary"
                      >
                        {aiModeLoading ? "Refreshing..." : "Refresh AI Answer"}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        aiStreamStatus === "streaming"
                          ? "bg-cyan-100 text-cyan-700"
                          : aiStreamStatus === "done"
                            ? "bg-emerald-100 text-emerald-700"
                            : aiStreamStatus === "error"
                              ? "bg-rose-100 text-rose-700"
                              : aiStreamStatus === "stopped"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                      }`}>
                        {aiStreamStatus === "streaming"
                          ? "Streaming live"
                          : aiStreamStatus === "done"
                            ? "Answer ready"
                            : aiStreamStatus === "error"
                              ? "Stream error"
                              : aiStreamStatus === "stopped"
                                ? "Stopped"
                                : "Idle"}
                      </span>
                      {aiModeLoading && (
                        <button
                          type="button"
                          onClick={stopAiModeStream}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Stop generating
                        </button>
                      )}
                      {aiStreamError && (
                        <span className="text-xs text-rose-600">{aiStreamError}</span>
                      )}
                      <button
                        type="button"
                        onClick={sendToInterviewPrep}
                        disabled={!result}
                        className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Practice in Interview Prep
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-5 px-6 py-5 lg:grid-cols-[1.5fr,1fr]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        <div className="mb-3 text-sm font-semibold text-slate-900">{aiModeDisplay.config.primaryTitle}</div>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={copyAiAnswer}
                            disabled={!aiModeAnswer?.reply && !streamedAiReply}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {copySuccess ? "Copied" : "Copy answer"}
                          </button>
                          <button
                            type="button"
                            onClick={downloadAiSnapshot}
                            disabled={!result}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Download AI Snapshot
                          </button>
                        </div>
                        {aiModeLoading ? (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-slate-900">Generating AI mode answer</div>
                            <div className="text-sm text-slate-600">Thinking across resume signals, JD fit, and recruiter priorities...</div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {streamedAiReply || aiModeAnswer?.reply || "Run AI mode to get a direct answer about this resume, what stands out, and what to fix first."}
                          </p>
                        )}
                      </div>

                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        {!!savedAiSessions.length && (
                          <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">Saved AI sessions</div>
                              <div className="text-xs text-slate-500">Recent answers across sessions</div>
                            </div>
                            <div className="space-y-2">
                              {savedAiSessions.slice(0, 3).map((session) => (
                                <button
                                  key={session.id}
                                  type="button"
                                  onClick={() => restoreAiSession(session)}
                                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-200 hover:bg-white"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-800">{session.fileName}</div>
                                    <div className="text-[11px] text-slate-500">{session.atsScore}/100 ATS</div>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">{session.jdTitle}</div>
                                  <div className="mt-2 line-clamp-2 text-xs text-slate-600">{session.answer?.reply}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {!!aiModeHistory.length && (
                          <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
                            <div className="text-sm font-semibold text-slate-900">Conversation</div>
                            <div className="space-y-2">
                              {aiModeHistory.slice(-6).map((item, index) => (
                                <div
                                  key={`${item.role}-${index}-${item.content.slice(0, 20)}`}
                                  className={`rounded-2xl px-4 py-3 text-sm ${
                                    item.role === "user"
                                      ? "bg-slate-900 text-white"
                                      : "border border-slate-100 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                    item.role === "user" ? "text-slate-300" : "text-slate-500"
                                  }`}>
                                    {item.role === "user" ? "You" : "AI"}
                                  </div>
                                  <div className="whitespace-pre-wrap leading-6">{item.content}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Ask AI mode</div>
                            <div className="text-xs text-slate-500">Ask a follow-up the same way you would in an AI search experience.</div>
                          </div>
                        </div>
                        <textarea
                          className="textarea mt-4 text-sm"
                          rows={3}
                          value={aiModeQuestion}
                          onChange={(e) => setAiModeQuestion(e.target.value)}
                          placeholder="Examples: What would a recruiter doubt? Which 3 bullets should I rewrite first? How should I tailor this for the JD?"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={aiModeLoading || !aiModeQuestion.trim()}
                            onClick={() => {
                              const nextQuestion = aiModeQuestion.trim();
                              setAiModeQuestion("");
                              runAiModeAnalysis({ question: nextQuestion });
                            }}
                          >
                            {aiModeLoading ? "Thinking..." : "Ask AI Mode"}
                          </button>
                          {(aiModeAnswer?.followUps || aiModePrompts).slice(0, 3).map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={aiModeLoading}
                              onClick={() => runAiModeAnalysis({ question: prompt })}
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">
                            {aiModeDisplay.type === "scan" ? "Recruiter scan verdict" : "Recruiter verdict"}
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            aiModeAnswer?.recruiterVerdict?.confidence === "High"
                              ? "bg-emerald-100 text-emerald-700"
                              : aiModeAnswer?.recruiterVerdict?.confidence === "Medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                          }`}>
                            {aiModeAnswer?.recruiterVerdict?.confidence || "Signal scan"}
                          </div>
                        </div>
                        <div className="mt-3 text-2xl font-bold text-slate-900">
                          {aiModeAnswer?.recruiterVerdict?.label || "Needs deeper AI read"}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {aiModeAnswer?.recruiterVerdict?.summary || "Run AI mode with a resume and JD to see a recruiter-style verdict."}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision</div>
                            <div className="mt-1 text-sm font-medium text-slate-800">
                              {aiModeAnswer?.recruiterVerdict?.decision || "No decision yet"}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Biggest risk</div>
                            <div className="mt-1 text-sm font-medium text-slate-800">
                              {aiModeAnswer?.recruiterVerdict?.risk || "No major risk surfaced yet"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        <div className="text-sm font-semibold text-slate-900">{aiModeDisplay.config.secondaryTitle}</div>
                        <div className="mt-3 space-y-3">
                          {aiModeDisplay.highlights.map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">
                            {aiModeDisplay.type === "fixes" ? "Recommended Fix Sequence" : aiModeDisplay.type === "rewrite" ? "Rewrite Priorities" : "What To Change First"}
                          </div>
                          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {aiModeDisplay.type === "rewrite" ? "Rewrite focus" : "Top 3 fixes"}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {aiModeDisplay.type === "scan"
                            ? "These are the fastest changes for improving the first recruiter impression."
                            : aiModeDisplay.type === "rewrite"
                              ? "Use these priorities to turn diagnosis into better wording and cleaner evidence."
                              : "These are the highest-value changes to make before re-running the analyzer."}
                        </p>
                        <div className="mt-4 space-y-3">
                          {aiModeDisplay.topFixes.map((item) => (
                            <div key={`${item.step}-${item.title}`} className="rounded-2xl border border-white bg-white/90 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                    {item.step}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{item.title}</div>
                                    <div className="mt-1 text-sm text-slate-600">{item.reason}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    item.priority === "High"
                                      ? "bg-rose-100 text-rose-700"
                                      : item.priority === "Medium"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-700"
                                  }`}>
                                    {item.priority}
                                  </div>
                                  <div className="mt-2 text-xs font-semibold text-teal-700">{item.impact}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        <div className="text-sm font-semibold text-slate-900">
                          {aiModeDisplay.type === "rewrite" ? "Rewrite action plan" : "Action plan"}
                        </div>
                        <div className="mt-3 space-y-3">
                          {aiModeDisplay.actions.map((item, index) => (
                            <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                                {index + 1}
                              </div>
                              <div className="text-sm text-slate-700">{item}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
                        <div className="text-sm font-semibold text-slate-900">Recruiter Questions To Prepare</div>
                        <div className="mt-3 space-y-3">
                          {buildRecruiterQuestions(result).map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Score Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-elevated p-4 space-y-2">
                  <div className="text-xs text-slate-600">ATS Score</div>
                  <div className={`text-3xl font-bold ${getScoreMeta(result.scores?.final || 0, "general").color}`}>{result.scores?.final || "—"}</div>
                  <div className="text-sm font-semibold text-slate-900">{getScoreMeta(result.scores?.final || 0, "general").label}</div>
                  <div className="text-xs text-slate-500">{getScoreMeta(result.scores?.final || 0, "general").note}</div>
                  <div className="progress-bar">
                    <div className="progress-fill-primary" style={{ width: `${result.scores?.final || 0}%` }} />
                  </div>
                </div>
                <div className="card-elevated p-4 space-y-2">
                  <div className="text-xs text-slate-600">Match Rate</div>
                  <div className={`text-3xl font-bold ${getScoreMeta(Math.round((result.match_rate || 0) * 100), "match").color}`}>
                    {Math.round((result.match_rate || 0) * 100)}%
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{getScoreMeta(Math.round((result.match_rate || 0) * 100), "match").label}</div>
                  <div className="text-xs text-slate-500">{getScoreMeta(Math.round((result.match_rate || 0) * 100), "match").note}</div>
                  <div className="progress-bar">
                    <div className="progress-fill-primary" style={{ width: `${(result.match_rate || 0) * 100}%` }} />
                  </div>
                </div>
                <div className="card-elevated p-4 space-y-2">
                  <div className="text-xs text-slate-600">Readability</div>
                  <div className={`text-3xl font-bold ${getScoreMeta(result.readability?.score || 0, "readability").color}`}>
                    {result.readability?.score || "—"}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{getScoreMeta(result.readability?.score || 0, "readability").label}</div>
                  <div className="text-xs text-slate-500">{getScoreMeta(result.readability?.score || 0, "readability").note}</div>
                  <div className="progress-bar">
                    <div className="progress-fill-success" style={{ width: `${result.readability?.score || 0}%` }} />
                  </div>
                </div>
                <div className="card-elevated p-4 space-y-2">
                  <div className="text-xs text-slate-600">ATS Compat</div>
                  <div className={`text-3xl font-bold ${getScoreMeta(result.atsCompatibility?.score || 0, "compat").color}`}>
                    {result.atsCompatibility?.score || "—"}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{getScoreMeta(result.atsCompatibility?.score || 0, "compat").label}</div>
                  <div className="text-xs text-slate-500">{getScoreMeta(result.atsCompatibility?.score || 0, "compat").note}</div>
                  <div className="progress-bar">
                    <div className="progress-fill-primary" style={{ width: `${result.atsCompatibility?.score || 0}%` }} />
                  </div>
                </div>
              </div>

              {versionHistory?.length > 0 && (
                <div className="card-elevated p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Resume Version History</div>
                  <div className="grid gap-2">
                    {versionHistory.slice(0, 4).map((snapshot) => (
                      <div key={snapshot.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>{new Date(snapshot.timestamp).toLocaleString()}</span>
                          <span>{snapshot.totalScore}/100</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">{snapshot.summary || "Snapshot"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="card-elevated">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-3 text-xs md:text-sm font-medium transition whitespace-nowrap ${
                        activeTab === tab.id
                          ? "border-b-2 border-teal-600 text-teal-600"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span className="mr-1">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6 space-y-6">
                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">AI Summary Writer</h3>
                            <p className="mt-1 text-sm text-slate-600">Generate a tighter professional summary tailored to your current resume signals and JD.</p>
                          </div>
                          <button
                            type="button"
                            onClick={generateSummaryDraft}
                            disabled={summaryLoading}
                            className="btn-secondary"
                          >
                            {summaryLoading ? "Writing..." : "Generate Summary Draft"}
                          </button>
                        </div>
                        <div className="mt-4 rounded-2xl border border-white bg-white/90 p-4 text-sm text-slate-700">
                          {summaryDraft || "No summary draft yet. Generate one from your current analysis."}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-semibold text-slate-900">Summary</h3>
                        <p className="text-slate-700">
                          {result.ai_summary || "Your resume looks good overall."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-900">Top Skills ({result.skills?.length || 0})</h4>
                          <div className="flex flex-wrap gap-2">
                            {(result.skills || []).slice(0, 5).map((skill) => (
                              <span key={skill} className="pill-primary">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-900">Missing Skills ({result.missing_skills?.length || 0})</h4>
                          <div className="flex flex-wrap gap-2">
                            {(result.missing_skills || []).slice(0, 5).map((skill) => (
                              <span key={skill} className="pill-warning">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {!!result.summarySuggestions?.length && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <h4 className="font-semibold text-slate-900">AI Summary Suggestions</h4>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {result.summarySuggestions.map((item) => (
                              <div key={item} className="flex items-start gap-2">
                                <span className="mt-1 text-teal-600">•</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">Resume health</div>
                          <div className="mt-3 space-y-3 text-sm text-slate-700">
                            <div className="flex items-center justify-between">
                              <span>ATS score</span>
                              <span className="font-semibold text-slate-900">{result.scores?.final || 0}/100</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Match rate</span>
                              <span className="font-semibold text-slate-900">{Math.round((result.match_rate || 0) * 100)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>ATS compatibility</span>
                              <span className="font-semibold text-slate-900">{result.atsCompatibility?.score || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Readability</span>
                              <span className="font-semibold text-slate-900">{result.readability?.score || 0}/100</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">Top fixes</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {buildTopFixes(result).map((fix) => (
                              <div key={fix.title} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-slate-900">{fix.title}</span>
                                  <span className="text-xs font-semibold uppercase text-slate-500">{fix.priority}</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-600">{fix.reason}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">Tailoring highlights</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {buildTailoringHighlights(result).length ? (
                              buildTailoringHighlights(result).map((hint, idx) => (
                                <div key={idx} className="rounded-xl bg-slate-50 p-3">{hint}</div>
                              ))
                            ) : (
                              <div className="text-slate-500">Use a job description to get more tailored keyword guidance.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {jd && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">Job context loaded</h4>
                              <p className="text-sm text-slate-600">This analysis is tailored to your current job description.</p>
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target match</span>
                          </div>
                          <div className="mt-3 text-sm text-slate-700 whitespace-pre-line max-h-32 overflow-y-auto">{jd}</div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
                        <h4 className="font-semibold text-slate-900">Real-Time Content Analysis</h4>
                        <div className="mt-3 space-y-3">
                          {buildContentAudit(result).map((item) => (
                            <div key={`${item.title}-${item.level}`} className="rounded-2xl border border-white bg-white/90 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-slate-900">{item.title}</div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  item.level === "High"
                                    ? "bg-rose-100 text-rose-700"
                                    : item.level === "Medium"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}>
                                  {item.level}
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4">
                        <h4 className="font-semibold text-slate-900">Section-Specific ATS Warnings</h4>
                        <div className="mt-3 space-y-3">
                          {buildSectionWarnings(result).length ? (
                            buildSectionWarnings(result).map((item) => (
                              <div key={`${item.section}-${item.detail}`} className="rounded-2xl border border-white bg-white/90 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-medium text-slate-900">{item.section}</div>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    item.level === "High" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {item.level}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-white bg-white/90 p-4 text-sm text-slate-600">
                              No major section-level ATS warnings were detected from the current analysis.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ATS Breakdown Tab */}
                  {activeTab === "breakdown" && (
                    <div className="space-y-4">
                      {[
                        { label: "Keywords", score: result.scores?.sub?.keywords || 75, desc: "Core ATS term coverage" },
                        { label: "Structure", score: result.scores?.sub?.structure || 80, desc: "Section ordering and scannability" },
                        { label: "Impact", score: result.scores?.sub?.impact || 70, desc: "Metrics and outcomes" },
                        { label: "Formatting", score: result.scores?.sub?.formatting || 85, desc: "Layout compatibility" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-900">{item.label}</span>
                            <span className="text-sm font-semibold text-slate-600">{item.score}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill-primary" style={{ width: `${item.score}%` }} />
                          </div>
                          <p className="text-xs text-slate-600">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills Tab */}
                  {activeTab === "skills" && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>✓</span>
                          Matched Skills ({result.skills?.length || 0})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(result.skills || []).map((skill) => (
                            <span key={skill} className="pill-success">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>⚠️</span>
                          Missing Skills ({result.missing_skills?.length || 0})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(result.missing_skills || []).map((skill) => (
                            <span key={skill} className="pill-warning">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Skill Graph Tab */}
                  {activeTab === "skillgraph" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">Interactive skill graph: known skills (green) vs missing skills (orange).</p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {(skillGraph?.nodes || []).length ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(skillGraph.nodes || []).map((node) => (
                              <div key={node.id} className={`p-2 rounded-lg ${node.type === "known" ? "bg-green-100" : "bg-orange-100"}`}>
                                {node.type === "known" ? "✓" : "⚠"} {node.id}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Analyze your resume to generate the skill graph.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* ATS Simulation Tab */}
                  {activeTab === "simulation" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-slate-900">Simulated ATS score</div>
                          <div className="text-3xl font-bold text-indigo-700">{atsSimulation?.score || "—"}%</div>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">Rejection risk: {atsSimulation?.rejectionProbability || "—"}%</div>
                        <div className="text-sm text-slate-600">Hiring probability: {result.hiringProbability || "—"}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="text-sm font-semibold text-slate-800">Missing Keywords to add</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(atsSimulation?.keywords || []).length ? (
                            (atsSimulation.keywords || []).map((kw) => <span key={kw} className="pill-warning">{kw}</span>)
                          ) : (
                            <span className="text-sm text-slate-500">No missing keywords identified yet. Try a deeper analysis.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Heatmap Tab */}
                  {activeTab === "heatmap" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">Resume section strength analysis</p>
                      {(result.heatmap || []).map((item) => (
                        <div key={item.section} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-900">{item.section}</span>
                            <span className={`text-sm font-semibold ${
                              item.status === "strong" ? "text-green-600" :
                              item.status === "moderate" ? "text-amber-600" :
                              "text-red-600"
                            }`}>
                              {item.score > 0 ? Math.round(item.score) : "Missing"}
                            </span>
                          </div>
                          <div className="progress-bar">
                            <div className={`progress-fill ${
                              item.status === "strong" ? "bg-green-500" :
                              item.status === "moderate" ? "bg-amber-500" :
                              "bg-red-500"
                            }`} style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bullets Tab */}
                  {activeTab === "bullets" && (
                    <div className="space-y-4">
                      {buildBulletScorecards(result).map((item, idx) => (
                        <div key={item.id} className="p-4 border border-slate-200 rounded-lg space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">Bullet {idx + 1}</div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.status === "Strong"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.status === "Needs polish"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                              }`}>
                                {item.status}
                              </span>
                              <span className="text-sm font-bold text-slate-700">{item.score}/100</span>
                            </div>
                          </div>
                          <div className="text-sm">
                            <p className="text-slate-600 line-through">❌ {item.original}</p>
                            <p className="text-slate-900 font-medium mt-2">✓ {item.improved}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Keywords Tab */}
                  {activeTab === "keywords" && (
                    <div className="space-y-6">
                      {!!result.keywordTargeting?.prioritizedMissing?.length && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-900">Keyword Targeting Priorities</h4>
                          <div className="space-y-3">
                            {result.keywordTargeting.prioritizedMissing.map((item) => (
                              <div key={item.keyword} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-slate-900">{item.keyword}</div>
                                    <div className="text-sm text-slate-600 mt-1">Best placement: {item.placement}</div>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    item.priority === "High" ? "bg-rose-100 text-rose-700" :
                                    item.priority === "Medium" ? "bg-amber-100 text-amber-700" :
                                    "bg-slate-100 text-slate-700"
                                  }`}>
                                    {item.priority}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">Keywords Present</h4>
                        <div className="flex flex-wrap gap-2">
                          {(result.keywords?.present || []).map((kw) => (
                            <span key={kw} className="pill-success">{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">Missing Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {(result.keywords?.missing || []).map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => applyKeywordSuggestion(kw)}
                              className="pill-warning transition hover:scale-[1.02]"
                              title="Add this keyword to the JD box for targeting"
                            >
                              + {kw}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500">Click a keyword to add it into the JD box as a quick targeting suggestion.</div>
                      </div>
                      {!!result.keywordTargeting?.lowFrequency?.length && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-900">Keywords That Need Stronger Mention</h4>
                          <div className="flex flex-wrap gap-2">
                            {result.keywordTargeting.lowFrequency.map((kw) => (
                              <span key={kw} className="pill-secondary">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">Keyword Frequency</h4>
                        {Object.entries(result.keywords?.frequency || {}).map(([kw, freq]) => (
                          <div key={kw} className="flex justify-between text-sm">
                            <span className="text-slate-700">{kw}</span>
                            <span className="font-semibold text-teal-600">{freq}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formatting Tab */}
                  {activeTab === "formatting" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-900">Formatting Score</span>
                        <span className="text-2xl font-bold text-teal-600">{result.formatting?.score}/100</span>
                      </div>
                      <div className="space-y-2">
                        {(result.formatting?.issues || []).map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                            <span className="mt-0.5">{issue.startsWith("✓") ? "✓" : "⚠"}</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvements Tab */}
                  {activeTab === "improvements" && (
                    <div className="space-y-3">
                      {(result.improvements || []).map((imp, idx) => (
                        <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-slate-900">{imp.action}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              imp.priority === "High" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {imp.priority}
                            </span>
                          </div>
                          <p className="text-sm text-teal-600 font-medium">{imp.impact}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Verbs Tab */}
                  {activeTab === "actionverbs" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">Recommended action verbs to strengthen your resume</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(result.actionVerbs?.length ? result.actionVerbs : [
                          "Spearheaded", "Orchestrated", "Engineered", "Architected",
                          "Accelerated", "Optimized", "Transformed", "Revolutionized",
                          "Pioneered", "Championed", "Elevated", "Amplified",
                          "Streamlined", "Automated", "Scaled", "Maximized"
                        ]).map((verb) => (
                          <div key={verb} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                            <p className="font-semibold text-slate-900">{verb}</p>
                            <p className="text-xs text-slate-600 mt-1">High-impact verb</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metrics Tab */}
                  {activeTab === "metrics" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">{result.metricsGuide?.note || "Add quantifiable metrics to strengthen your bullets"}</p>
                      <div className="space-y-3">
                        {(result.metricsGuide?.examples?.length
                          ? result.metricsGuide.examples.map((example, idx) => ({
                              metric: `Metric Idea ${idx + 1}`,
                              examples: example,
                            }))
                          : [
                              { metric: "Percentage Improvements", examples: "Increased by 25%, Reduced by 40%, Improved by 35%" },
                              { metric: "Time Savings", examples: "Saved 200+ hours, Reduced time by 50%, Cut processing time by 60%" },
                              { metric: "Financial Impact", examples: "Saved $500K, Generated $2M revenue, Reduced costs by 30%" },
                              { metric: "Scale & Volume", examples: "Managed 10K+ users, Processed 1M+ records, Served 500+ clients" },
                              { metric: "Team Leadership", examples: "Led team of 12, Mentored 5 junior members, Managed 3 departments" },
                              { metric: "Project Delivery", examples: "Delivered 25+ projects, 100% on-time delivery, 15% under budget" }
                            ]).map((item, idx) => (
                          <div key={idx} className="p-4 border border-slate-200 rounded-lg">
                            <h4 className="font-semibold text-slate-900">{item.metric}</h4>
                            <p className="text-sm text-slate-600 mt-2">{item.examples}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sections Tab */}
                  {activeTab === "sections" && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">Resume section analysis and recommendations</p>
                      <div className="space-y-3">
                        {[
                          { section: "Professional Summary", status: result.sections?.summary, tips: "2-3 lines highlighting role fit, strongest skills, and measurable impact." },
                          { section: "Experience", status: result.sections?.experience, tips: "Use 4-6 bullets per role with action, metric, and outcome." },
                          { section: "Education", status: result.sections?.education, tips: "Include degree, institution, graduation year, and relevant coursework only if needed." },
                          { section: "Skills", status: result.sections?.skills, tips: "Group role-relevant keywords and keep the strongest ones near the top." },
                          { section: "Projects", status: result.sections?.projects, tips: "Add 2-3 projects with tools used, ownership, and measurable outcomes." },
                          { section: "Certifications", status: result.sections?.certifications, tips: "Only include certifications that support the target role." }
                        ].map((item, idx) => (
                          <div key={idx} className="p-4 border border-slate-200 rounded-lg">
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold text-slate-900">{item.section}</h4>
                              <span className={`text-lg ${item.status ? "text-green-500" : "text-amber-500"}`}>
                                {item.status ? "✓" : "⚠"}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-2">{item.tips}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "checklist" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900">Resume readiness checklist</h4>
                            <p className="text-sm text-slate-600">A quick status overview of the strongest recruiter signals.</p>
                          </div>
                          <button type="button" onClick={() => setActiveTab("overview")} className="text-sm text-teal-600 hover:text-teal-800">
                            Back to overview
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {buildResumeChecklist(result).map((item) => (
                          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-slate-900">{item.label}</span>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {item.status ? "Done" : "Needs work"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="font-semibold text-slate-900">Why this matters</h4>
                        <p className="mt-2 text-sm text-slate-600">A cleaner resume with stronger keyword focus and measurable bullet points helps both ATS systems and hiring managers decide faster.</p>
                      </div>
                    </div>
                  )}

                  {/* ATS Check Tab */}
                  {activeTab === "atscheck" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <span className="font-semibold text-slate-900">ATS Compatibility Score</span>
                        <span className="text-3xl font-bold text-green-600">{result.atsCompatibility?.score}%</span>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900">ATS Compatibility Checklist</h4>
                        {(result.atsChecks?.length ? result.atsChecks : []).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <span className={`text-lg mt-0.5 ${item.status ? "text-green-500" : "text-amber-500"}`}>
                              {item.status ? "✓" : "⚠"}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{item.label}</p>
                              <p className="text-sm text-slate-600">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Success Message */}
              {saveSuccess && (
                <div className="alert-success">
                  ✓ Analysis saved successfully!
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button onClick={downloadReport} className="btn-secondary flex-1 min-w-[170px]">
                  📥 Download Report
                </button>
                <button 
                  onClick={handleSaveAnalysis}
                  disabled={saveLoading}
                  className="btn-secondary flex-1 min-w-[170px]"
                >
              {saveLoading ? "Saving..." : "💾 Save Analysis"}
                </button>
                <button 
                  onClick={handleAIRewrite}
                  disabled={rewriteLoading}
                  className="btn-primary flex-1 min-w-[170px]"
                >
                  {rewriteLoading ? "Rewriting..." : "✨ Rewrite Resume"}
                </button>
                <button 
                  onClick={handleTailorForJob}
                  className="btn-secondary flex-1 min-w-[170px]"
                  disabled={rewriteLoading}
                >
                  {rewriteLoading ? "Tailoring..." : "🧠 Tailor for this job"}
                </button>
                <button 
                  onClick={handleAITailor}
                  className="btn-accent flex-1 min-w-[170px]"
                  disabled={rewriteLoading}
                >
                  {rewriteLoading ? "Tailoring..." : "🧩 Auto Tailor Resume"}
                </button>
                <button 
                  onClick={handleGenerateCoverLetter}
                  disabled={rewriteLoading}
                  className="btn-success flex-1 min-w-[170px]"
                >
                  ✉️ Generate Cover Letter
                </button>
              </div>

              {/* Loading skeleton and Missing Keywords panel */}
              {loading && (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                </div>
              )}

              {!loading && result?.atsSimulation?.keywords?.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-rose-800">Missing ATS keywords</h4>
                      <p className="text-sm text-rose-700">Suggested terms to add to improve job match.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-sm text-rose-700 hover:underline"
                        onClick={() => {
                          try {
                            navigator.clipboard?.writeText((result.atsSimulation?.keywords || []).join(", "));
                            setNotice("Keywords copied to clipboard.");
                          } catch {
                            setNotice("Unable to copy keywords.");
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(result.atsSimulation?.keywords || []).map((k, idx) => (
                      <span key={idx} className="pill-warning">{k}</span>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const missing = (result.atsSimulation?.keywords || []).map(String).map((s) => s.trim()).filter(Boolean);
                        setResumeEditor((prev) => {
                          const existing = String(prev.skills || "").split(",").map((x) => x.trim()).filter(Boolean);
                          const merged = Array.from(new Set([...existing, ...missing]));
                          return { ...prev, skills: merged.join(", ") };
                        });
                        setNotice("Added suggested keywords to Skills section.");
                      }}
                    >
                      Add to Skills
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setActiveTab("checklist");
                        setNotice("Opened checklist to review where to place keywords.");
                      }}
                    >
                      Review Checklist
                    </button>
                  </div>
                </div>
              )}

              {(tailoredResume || coverLetter || rewriteResult || summaryDraft) && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={downloadResumeDraftTxt} className="btn-secondary">
                      Export Resume Draft TXT
                    </button>
                    <button type="button" onClick={downloadResumeDraftDoc} className="btn-secondary">
                      Export Resume Draft DOC
                    </button>
                    <button type="button" onClick={createShareableResume} className="btn-secondary" disabled={shareLoading}>
                      {shareLoading ? "Creating Link..." : "Create Share Link"}
                    </button>
                  </div>
                  {shareLink && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                      <div className="font-semibold">Shareable link ready</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a href={shareLink} target="_blank" rel="noreferrer" className="font-semibold underline break-all">
                          {shareLink}
                        </a>
                        <button type="button" onClick={copyShareLink} className="btn-secondary">
                          {copySuccess ? "Copied" : "Copy Link"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900">Inline Resume Editor</h4>
                        <p className="mt-1 text-sm text-slate-600">Edit the generated draft directly before exporting.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedTemplate(key)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            selectedTemplate === key
                              ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          title={preset.summary}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold">{preset.name}</div>
                              <div className={`mt-1 text-xs ${selectedTemplate === key ? "text-slate-200" : "text-slate-500"}`}>
                                {preset.summary}
                              </div>
                            </div>
                            <span
                              className="h-4 w-4 rounded-full border border-white/40"
                              style={{ backgroundColor: preset.accent }}
                            />
                          </div>
                          <div className={`mt-3 text-xs font-medium ${selectedTemplate === key ? "text-slate-100" : "text-slate-600"}`}>
                            Best for: {preset.bestFor}
                          </div>
                          <div className={`mt-2 text-[11px] uppercase tracking-[0.18em] ${selectedTemplate === key ? "text-slate-300" : "text-slate-400"}`}>
                            Density: {preset.density}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Active template: {TEMPLATE_PRESETS[selectedTemplate]?.name || "Classic ATS"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {TEMPLATE_PRESETS[selectedTemplate]?.summary}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {TEMPLATE_PRESETS[selectedTemplate]?.density} layout
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        {TEMPLATE_PRESETS[selectedTemplate]?.bestFor}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Template Starter Guide</div>
                          <div className="mt-1 text-sm text-slate-600">Use these starter tips to draft the selected resume style quickly.</div>
                        </div>
                        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                          {TEMPLATE_PRESETS[selectedTemplate]?.name}
                        </span>
                      </div>
                      <ul className="mt-4 space-y-3 text-sm text-slate-700">
                        {(TEMPLATE_PRESETS[selectedTemplate]?.starterTips || []).map((tip) => (
                          <li key={tip} className="flex gap-3">
                            <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-teal-500" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                      <div className="rounded-xl border border-white bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">Draft completion</div>
                          <div className="text-sm font-bold text-slate-800">{buildEditorCompletion().score}%</div>
                        </div>
                        <div className="mt-3 progress-bar">
                          <div className="progress-fill-primary" style={{ width: `${buildEditorCompletion().score}%` }} />
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                          {buildEditorCompletion().complete}/{buildEditorCompletion().total} core resume signals completed
                        </div>
                      </div>
                      <div className="rounded-xl border border-white bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Example library quick apply</div>
                            <div className="mt-1 text-xs text-slate-500">Use a role-aligned sample as a starting point, then customize it.</div>
                          </div>
                          <button
                            type="button"
                            onClick={applyExampleToEditor}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Apply example
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Version Label</div>
                          <input
                            className="input mt-2"
                            value={versionLabel}
                            onChange={(e) => setVersionLabel(e.target.value)}
                            placeholder="Name this tailored version"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Headline</div>
                          <input
                            className="input mt-2"
                            value={resumeEditor.headline}
                            onChange={(e) => setResumeEditor((prev) => ({ ...prev, headline: e.target.value }))}
                            placeholder="Target role / headline"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Professional Summary</div>
                            <button
                              type="button"
                              onClick={regenerateEditorSummary}
                              disabled={editorAiLoading.summary}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {editorAiLoading.summary ? "Rewriting..." : "Rewrite summary"}
                            </button>
                          </div>
                          <textarea
                            className="textarea mt-2"
                            rows={4}
                            value={resumeEditor.summary}
                            onChange={(e) => setResumeEditor((prev) => ({ ...prev, summary: e.target.value }))}
                            placeholder="Edit the generated summary"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Skills</div>
                            <button
                              type="button"
                              onClick={regenerateEditorSkills}
                              disabled={editorAiLoading.skills}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {editorAiLoading.skills ? "Rewriting..." : "Strengthen skills"}
                            </button>
                          </div>
                          <input
                            className="input mt-2"
                            value={resumeEditor.skills}
                            onChange={(e) => setResumeEditor((prev) => ({ ...prev, skills: e.target.value }))}
                            placeholder="Comma-separated skills"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white bg-white p-4">
                          <div className="text-sm font-semibold text-slate-900">Live Content Analysis</div>
                          <div className="mt-3 space-y-2">
                            {buildEditorAudit().length ? (
                              buildEditorAudit().map((item, index) => (
                                <div key={`${item.detail}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                  <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    item.level === "High" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {item.level}
                                  </span>
                                  {item.detail}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                The current draft looks solid on core ATS and recruiter writing signals.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white bg-white p-4">
                          <div className="text-sm font-semibold text-slate-900">Example Library</div>
                          <div className="mt-2 text-xs text-slate-500">Browse by role, switch between examples, and apply one into the draft editor.</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(EXAMPLE_LIBRARY).map(([roleKey, pack]) => (
                              <button
                                key={roleKey}
                                type="button"
                                onClick={() => {
                                  setSelectedExampleRole(roleKey);
                                  setSelectedExampleIndex(0);
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  activeExampleRole === roleKey
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                }`}
                              >
                                {pack.label}
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                            <div>
                              <div className="font-semibold text-slate-900">{currentExamplePack.label}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {currentExamplePack.category} sample library
                                {activeExampleRole === inferredExampleRole ? " • Suggested from current resume signals" : ""}
                              </div>
                            </div>
                            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                              {currentExamplePack.samples.length} sample{currentExamplePack.samples.length > 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {currentExamplePack.samples.map((sample, index) => (
                              <button
                                key={`${currentExamplePack.label}-${sample.title}`}
                                type="button"
                                onClick={() => setSelectedExampleIndex(index)}
                                className={`rounded-xl border p-3 text-left transition ${
                                  selectedExampleIndex === index
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                }`}
                              >
                                <div className="text-sm font-semibold">{sample.title}</div>
                                <div className={`mt-1 text-xs ${selectedExampleIndex === index ? "text-slate-200" : "text-slate-500"}`}>
                                  {(sample.summary || "").slice(0, 120)}
                                  {(sample.summary || "").length > 120 ? "..." : ""}
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 text-sm text-slate-700">
                            <div className="font-medium text-slate-900">Sample Summary</div>
                            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3">{currentExample.summary}</div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {currentExample.bullets.map((item) => (
                              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        {!!savedAnalyses.length && (
                          <div className="rounded-xl border border-white bg-white p-4">
                            <div className="text-sm font-semibold text-slate-900">Saved Draft Versions</div>
                            <div className="mt-2 text-xs text-slate-500">Reload a previously saved analysis into the editor workspace.</div>
                            <div className="mt-3 space-y-2">
                              {savedAnalyses.slice(-3).reverse().map((item, index) => (
                                <button
                                  key={`${item.timestamp || index}-${item.fileName || "draft"}`}
                                  type="button"
                                  onClick={() => restoreAnalysisIntoEditor(item)}
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-white"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-800">
                                      {item.versionLabel || item.jobDescription?.split("\n")[0] || item.fileName || "Saved draft"}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {item.result?.scores?.final || item.result?.atsCompatibility?.score || 0}/100
                                    </div>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Saved analysis"}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {!!savedAnalyses.length && (
                          <div className="rounded-xl border border-white bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">Resume History</div>
                                <div className="mt-1 text-xs text-slate-500">Search every uploaded resume analysis, reopen it, or remove it from history.</div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                  {savedAnalyses.length} saved
                                </div>
                                <button
                                  type="button"
                                  onClick={openCompareFromHistory}
                                  disabled={compareSelection.length !== 2}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Compare Selected ({compareSelection.length}/2)
                                </button>
                              </div>
                            </div>
                            <input
                              className="input mt-3"
                              value={historyQuery}
                              onChange={(e) => setHistoryQuery(e.target.value)}
                              placeholder="Search by file name, role, JD, or skills"
                            />
                            <div className="mt-3 overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-slate-500">
                                    <th className="pb-2 pr-4 font-semibold">Pick</th>
                                    <th className="pb-2 pr-4 font-semibold">Resume</th>
                                    <th className="pb-2 pr-4 font-semibold">Score</th>
                                    <th className="pb-2 pr-4 font-semibold">Match</th>
                                    <th className="pb-2 pr-4 font-semibold">Saved</th>
                                    <th className="pb-2 font-semibold">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredSavedAnalyses.length ? (
                                    filteredSavedAnalyses.map((item, index) => {
                                      const score = item?.result?.scores?.final || item?.result?.atsCompatibility?.score || 0;
                                      const match = Math.round((item?.result?.match_rate || 0) * 100);
                                      const isSelected = compareSelection.some(
                                        (selected) =>
                                          selected?.timestamp === item?.timestamp &&
                                          selected?.fileName === item?.fileName &&
                                          selected?.jobDescription === item?.jobDescription
                                      );
                                      return (
                                        <tr key={`${item?.timestamp || index}-${item?.fileName || "resume"}`} className="border-t border-slate-100 align-top">
                                          <td className="py-3 pr-4">
                                            <button
                                              type="button"
                                              onClick={() => toggleCompareSelection(item)}
                                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                                isSelected
                                                  ? "bg-slate-900 text-white"
                                                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                              }`}
                                            >
                                              {isSelected ? "Selected" : "Select"}
                                            </button>
                                          </td>
                                          <td className="py-3 pr-4">
                                            <div className="font-semibold text-slate-900">
                                              {item?.versionLabel || item?.jobDescription?.split("\n")[0] || item?.fileName || "Saved resume"}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                              {item?.fileName || "resume"}{item?.template ? ` • ${TEMPLATE_PRESETS[item.template]?.name || item.template}` : ""}
                                            </div>
                                          </td>
                                          <td className="py-3 pr-4 text-slate-700">{score}/100</td>
                                          <td className="py-3 pr-4 text-slate-700">{match}%</td>
                                          <td className="py-3 pr-4 text-slate-500">
                                            {item?.timestamp ? new Date(item.timestamp).toLocaleString() : "Saved analysis"}
                                          </td>
                                          <td className="py-3">
                                            <div className="flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                onClick={() => reopenSavedAnalysis(item)}
                                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white"
                                              >
                                                Reopen
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => restoreAnalysisIntoEditor(item)}
                                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white"
                                              >
                                                Load in Editor
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => deleteSavedAnalysis(item)}
                                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                                        No saved resumes match this search yet.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Experience Bullets</div>
                        {(resumeEditor.bullets || []).slice(0, 6).map((bullet, index) => (
                          <div key={`${index}-${bullet.slice(0, 20)}`} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold text-slate-600">Bullet {index + 1}</div>
                              <button
                                type="button"
                                onClick={() => regenerateEditorBullet(index)}
                                disabled={editorAiLoading.bulletIndex === index}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {editorAiLoading.bulletIndex === index ? "Rewriting..." : "Rewrite bullet"}
                              </button>
                            </div>
                            <textarea
                              className="textarea"
                              rows={3}
                              value={bullet}
                              onChange={(e) => updateEditorBullet(index, e.target.value)}
                              placeholder={`Bullet ${index + 1}`}
                            />
                            {bulletSuggestions[index] && (
                              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                                <div className="text-sm text-slate-700">{bulletSuggestions[index]}</div>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => applyBulletSuggestion(index)}
                                    className="btn-primary"
                                  >
                                    Apply suggestion
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => dismissBulletSuggestion(index)}
                                    className="btn-secondary"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  {tailoredResume && (
                    <div>
                      <h4 className="font-bold text-slate-900">Auto-Tailored Resume Advice</h4>
                      <p className="text-sm text-slate-600 mt-1">{tailoredResume.headline}</p>
                      <ul className="list-disc list-inside mt-2 text-sm text-slate-700">
                        {tailoredResume.actions.map((item, idx) => (
                          <li key={`${item.step}-${idx}`}>{item.advice}</li>
                        ))}
                      </ul>
                      {!!tailoredResume.rewriteSuggestions?.length && (
                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-semibold text-slate-900">Suggested JD-Aligned Rewrites</div>
                          {tailoredResume.rewriteSuggestions.map((item, idx) => (
                            <div key={`${item.original}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                              <div className="text-slate-500 line-through">{item.original}</div>
                              <div className="mt-2 font-medium text-slate-800">{item.improved}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!!tailoredResume.tailoredText && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Tailored resume preview</div>
                              <div className="text-xs text-slate-500">Generated text includes job-specific keyword and ATS guidance.</div>
                            </div>
                            <div className="text-xs font-semibold text-slate-600">ATS score: {tailoredResume.atsScore || "—"}</div>
                          </div>
                          <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">{tailoredResume.tailoredText}</pre>
                        </div>
                      )}
                      {!!tailoredResume.recommendations?.length && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-slate-900">Resume tailoring recommendations</div>
                          <ul className="list-disc list-inside mt-2 text-sm text-slate-700">
                            {tailoredResume.recommendations.map((item, idx) => (
                              <li key={`${item}-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!tailoredResume.recruiterReasons?.length && (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-slate-900">Recruiter Fit Reasons</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tailoredResume.recruiterReasons.map((item) => (
                              <span key={item} className="pill-success">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {rewriteResult && (
                    <div>
                      <h4 className="font-bold text-slate-900">AI Rewrite Suggestions</h4>
                      <p className="text-sm text-slate-600 mt-1">{rewriteResult.summary}</p>
                      <div className="mt-3 space-y-3">
                        {(rewriteResult.improvedBullets || []).map((item, idx) => (
                          <div key={`${item.original}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm text-slate-500 line-through">{item.original}</div>
                            <div className="mt-2 text-sm font-medium text-slate-800">{item.improved}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {coverLetter && (
                    <div>
                      <h4 className="font-bold text-slate-900">Generated Cover Letter</h4>
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 border border-slate-200 rounded-lg p-3 mt-2 bg-slate-50">{coverLetter}</pre>
                    </div>
                  )}
                  {/* Application Tracker Panel */}
                  <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">Applications Tracker</h4>
                      <div className="text-sm text-slate-500">{applications.length} saved</div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <input
                        className="input"
                        placeholder="Job title"
                        value={appForm.job_title}
                        onChange={(e) => setAppForm((s) => ({ ...s, job_title: e.target.value }))}
                      />
                      <input
                        className="input"
                        placeholder="Company"
                        value={appForm.company}
                        onChange={(e) => setAppForm((s) => ({ ...s, company: e.target.value }))}
                      />
                      <input
                        className="input"
                        placeholder="Job URL"
                        value={appForm.job_url}
                        onChange={(e) => setAppForm((s) => ({ ...s, job_url: e.target.value }))}
                      />
                      <select
                        className="input"
                        value={appForm.resume_version}
                        onChange={(e) => setAppForm((s) => ({ ...s, resume_version: e.target.value }))}
                      >
                        <option value="">Select resume version (optional)</option>
                        {versionHistory.map((v) => (
                          <option key={v.id} value={v.id}>{v.versionLabel || v.summary || v.timestamp}</option>
                        ))}
                      </select>
                      <select
                        className="input"
                        value={appForm.status}
                        onChange={(e) => setAppForm((s) => ({ ...s, status: e.target.value }))}
                      >
                        <option>Interested</option>
                        <option>Applied</option>
                        <option>Interviewing</option>
                        <option>Offer</option>
                        <option>Rejected</option>
                      </select>
                      <textarea
                        className="textarea"
                        placeholder="Notes"
                        rows={2}
                        value={appForm.notes}
                        onChange={(e) => setAppForm((s) => ({ ...s, notes: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button type="button" className="btn-primary" onClick={handleCreateApplication} disabled={saveLoading}>
                          Save to tracker
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setAppForm({ job_title: "", company: "", job_url: "", resume_version: "", status: "Interested", notes: "" })}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-semibold text-slate-700">Saved applications</div>
                      <div className="mt-2 space-y-2">
                        {appsLoading && <div className="text-sm text-slate-500">Loading...</div>}
                        {!appsLoading && applications.length === 0 && <div className="text-sm text-slate-500">No applications yet.</div>}
                        {applications.map((app) => (
                          <div key={app.id} className="rounded-lg border border-slate-100 p-3 flex items-start justify-between">
                            <div>
                              <div className="text-sm font-semibold">{app.job_title} <span className="text-xs text-slate-500">@ {app.company}</span></div>
                              <div className="text-xs text-slate-500">{app.resume_version || "-"} · {app.status}</div>
                              {app.notes && <div className="mt-2 text-sm text-slate-600">{app.notes}</div>}
                              {app.job_url && <div className="mt-1 text-xs"><a className="link" href={app.job_url} target="_blank" rel="noreferrer">View posting</a></div>}
                            </div>
                            <div className="flex flex-col gap-2">
                              <select className="input text-sm" value={app.status} onChange={(e) => handleUpdateApplication(app.id, { status: e.target.value })}>
                                <option>Interested</option>
                                <option>Applied</option>
                                <option>Interviewing</option>
                                <option>Offer</option>
                                <option>Rejected</option>
                              </select>
                              <button className="btn-ghost text-sm" onClick={() => handleDeleteApplication(app.id)}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
