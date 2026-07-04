import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const fallbackRecentAnalyses = [
  { id: 1, date: "2026-03-28", role: "Senior Data Scientist", score: 85, match: 78, status: "strong" },
  { id: 2, date: "2026-03-25", role: "ML Engineer", score: 91, match: 86, status: "strong" },
  { id: 3, date: "2026-03-21", role: "Product Analyst", score: 74, match: 69, status: "moderate" },
];

const recommendations = [
  { id: 1, title: "Add deployment proof", impact: "high", effort: "medium", description: "Mention that you shipped this project with multiple AI-powered modules and polished UX." },
  { id: 2, title: "Quantify project outcomes", impact: "high", effort: "low", description: "Add metrics like ATS uplift, response rate, or number of features completed." },
  { id: 3, title: "Highlight MLOps keywords", impact: "medium", effort: "medium", description: "Use keywords such as semantic matching, NLP pipeline, explainability, and model-backed insights." },
];

const marketPulse = [
  { label: "AI Engineer", score: 94 },
  { label: "Data Scientist", score: 88 },
  { label: "Analytics Engineer", score: 79 },
  { label: "Product Analyst", score: 74 },
];

const defaultPipeline = [
  { stage: "Saved", count: 4 },
  { stage: "Applied", count: 3 },
  { stage: "Interviewing", count: 2 },
  { stage: "Offer-ready", count: 1 },
];

const initialSprint = [
  { id: 1, title: "Polish top 3 resume bullets with metrics", done: true },
  { id: 2, title: "Save 5 best-fit roles from Job Matcher", done: false },
  { id: 3, title: "Complete one AI Studio roadmap task", done: false },
  { id: 4, title: "Practice 2 interview answers", done: true },
];

const DASHBOARD_NOTIFICATIONS_KEY = "dashboard_notifications_hidden";
const DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY = "dashboard_activity_notifications";
const INTERVIEW_PLANNER_KEY = "resumeai_interview_planner";

export default function Dashboard() {
  const [remoteAnalyzerHistory, setRemoteAnalyzerHistory] = useState([]);
  const [profileNotifications, setProfileNotifications] = useState([]);
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const storedJobs = JSON.parse(localStorage.getItem("resumeai_saved_jobs") || "[]");
      return Array.isArray(storedJobs) ? storedJobs : [];
    } catch {
      return [];
    }
  });
  const [sprintTasks, setSprintTasks] = useState(() => {
    try {
      const storedTasks = JSON.parse(localStorage.getItem("resumeai_sprint_tasks") || "null");
      return Array.isArray(storedTasks) && storedTasks.length ? storedTasks : initialSprint;
    } catch {
      return initialSprint;
    }
  });
  const [newTask, setNewTask] = useState("");
  const [focusNote, setFocusNote] = useState(() => localStorage.getItem("resumeai_focus_note") || "");
  const [plannerItems, setPlannerItems] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(INTERVIEW_PLANNER_KEY) || "null");
      return Array.isArray(stored) && stored.length
        ? stored
        : [
            { id: 1, company: "NeuralStack", role: "Senior AI Engineer", date: "2026-04-05", stage: "Mock prep" },
            { id: 2, company: "ScaleForge", role: "ML Engineer", date: "2026-04-08", stage: "Round 1 prep" },
          ];
    } catch {
      return [
        { id: 1, company: "NeuralStack", role: "Senior AI Engineer", date: "2026-04-05", stage: "Mock prep" },
        { id: 2, company: "ScaleForge", role: "ML Engineer", date: "2026-04-08", stage: "Round 1 prep" },
      ];
    }
  });
  const [plannerDraft, setPlannerDraft] = useState({ company: "", role: "", date: "", stage: "Mock prep" });

  useEffect(() => {
    localStorage.setItem("resumeai_sprint_tasks", JSON.stringify(sprintTasks));
  }, [sprintTasks]);

  useEffect(() => {
    localStorage.setItem("resumeai_focus_note", focusNote);
  }, [focusNote]);

  useEffect(() => {
    localStorage.setItem("resumeai_saved_jobs", JSON.stringify(savedJobs));
  }, [savedJobs]);

  useEffect(() => {
    localStorage.setItem(INTERVIEW_PLANNER_KEY, JSON.stringify(plannerItems));
  }, [plannerItems]);

  useEffect(() => {
    let active = true;

    const hydrateDashboardHistory = async () => {
      try {
        const profile = await api.profile();
        if (!active) return;
        const analyzerHistory = profile?.dashboardState?.analyzerHistory;
        const notifications = Array.isArray(profile?.notificationsCenter) ? profile.notificationsCenter : [];
        if (notifications.length) {
          setProfileNotifications(notifications);
        }
        if (Array.isArray(analyzerHistory) && analyzerHistory.length) {
          setRemoteAnalyzerHistory(analyzerHistory);
          localStorage.setItem("saved_analyses", JSON.stringify(analyzerHistory));
        }
      } catch {
        // Keep local fallback when profile fetch fails.
      }
    };

    hydrateDashboardHistory();

    return () => {
      active = false;
    };
  }, []);

  const normalizedAnalysisHistory = useMemo(() => {
    const source = Array.isArray(remoteAnalyzerHistory) && remoteAnalyzerHistory.length
      ? remoteAnalyzerHistory
      : (() => {
          try {
            const stored = JSON.parse(localStorage.getItem("saved_analyses") || "[]");
            return Array.isArray(stored) ? stored : [];
          } catch {
            return [];
          }
        })();

    return source;
  }, [remoteAnalyzerHistory]);

  const sprintCompletion = useMemo(() => {
    const completed = sprintTasks.filter((item) => item.done).length;
    return Math.round((completed / sprintTasks.length) * 100);
  }, [sprintTasks]);

  const recentAnalyses = useMemo(() => {
    if (!normalizedAnalysisHistory.length) return fallbackRecentAnalyses;
    return normalizedAnalysisHistory.slice(-4).reverse().map((item, index) => {
      const score = item?.result?.scores?.final || item?.result?.atsCompatibility?.score || 0;
      const match = Math.round((item?.result?.match_rate || 0) * 100);
      return {
        id: item?.timestamp || `analysis-${index}`,
        date: item?.timestamp || new Date().toISOString(),
        role: item?.jobDescription?.split("\n")[0] || item?.fileName || "Resume analysis",
        score,
        match,
        status: score >= 85 ? "strong" : score >= 70 ? "moderate" : "needs work",
      };
    });
  }, [normalizedAnalysisHistory]);

  const notificationsSnapshot = useMemo(() => {
    try {
      const hidden = JSON.parse(localStorage.getItem(DASHBOARD_NOTIFICATIONS_KEY) || "[]");
      const activity = JSON.parse(localStorage.getItem(DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY) || "[]");
      const hiddenSet = new Set(Array.isArray(hidden) ? hidden : []);
      const items = [
        ...profileNotifications,
        ...(Array.isArray(activity) ? activity : []),
      ];
      return items
        .filter((item) => item && (!item.id || !hiddenSet.has(item.id)))
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [profileNotifications]);

  const resumeVersionComparison = useMemo(() => {
    if (normalizedAnalysisHistory.length < 2) return null;
    const latest = normalizedAnalysisHistory[normalizedAnalysisHistory.length - 1];
    const previous = normalizedAnalysisHistory[normalizedAnalysisHistory.length - 2];
    const latestScore = latest?.result?.scores?.final || 0;
    const previousScore = previous?.result?.scores?.final || 0;
    const latestMatch = Math.round((latest?.result?.match_rate || 0) * 100);
    const previousMatch = Math.round((previous?.result?.match_rate || 0) * 100);
    return {
      latestLabel: latest?.jobDescription?.split("\n")[0] || latest?.fileName || "Latest version",
      previousLabel: previous?.jobDescription?.split("\n")[0] || previous?.fileName || "Previous version",
      scoreDelta: latestScore - previousScore,
      matchDelta: latestMatch - previousMatch,
      latestScore,
      previousScore,
      latestMatch,
      previousMatch,
    };
  }, [normalizedAnalysisHistory]);

  const pipeline = useMemo(() => {
    const baseStages = ["Saved", "Applied", "Interviewing", "Offer-ready"];
    return baseStages.map((stage, index) => ({
      stage,
      count: savedJobs.filter((job) => (job.status || "Saved") === stage).length || defaultPipeline[index].count,
    }));
  }, [savedJobs]);

  const stats = {
    totalAnalyses: recentAnalyses.length || 12,
    avgScore: recentAnalyses.length ? Math.round(recentAnalyses.reduce((sum, item) => sum + item.score, 0) / recentAnalyses.length) : 81,
    bestScore: recentAnalyses.length ? Math.max(...recentAnalyses.map((item) => item.score)) : 92,
    jobsMatched: savedJobs.length ? savedJobs.length * 3 : 45,
    savedRoles: savedJobs.length,
  };

  const visibleSavedJobs = savedJobs.length
    ? savedJobs.slice(0, 3)
    : [
        { id: "sample-1", title: "AI Engineer", company: "Neuron Labs", match: 93 },
        { id: "sample-2", title: "ML Engineer", company: "ScaleStack", match: 89 },
        { id: "sample-3", title: "Data Scientist", company: "InsightWorks", match: 84 },
      ];

  const aiStudioHistory = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("resumeai_ai_studio_history") || "[]");
      return Array.isArray(stored) ? stored.slice(0, 4) : [];
    } catch {
      return [];
    }
  }, []);

  const opportunityRadar = useMemo(() => {
    if (!savedJobs.length) {
      return {
        topSalary: "₹18L+",
        strongestRole: "AI Engineer",
        averageMatch: 88,
      };
    }
    const topSalary = Math.max(...savedJobs.map((job) => Number(job.salaryMin || 0) || 0));
    const averageMatch = Math.round(
      savedJobs.reduce((sum, job) => sum + Number(job.match || job.recommendationScore || 0), 0) / savedJobs.length
    );
    return {
      topSalary: `₹${topSalary}L+`,
      strongestRole: savedJobs[0]?.title || "Best-fit role",
      averageMatch,
    };
  }, [savedJobs]);

  const recruiterScorecard = useMemo(() => {
    const latest = recentAnalyses[0];
    const savedCount = savedJobs.length;
    const ats = latest?.score || 78;
    const match = latest?.match || opportunityRadar.averageMatch || 82;
    const portfolioSignal = Math.min(100, 58 + aiStudioHistory.length * 10 + savedCount * 4);
    const consistency = Math.min(100, 50 + sprintCompletion / 2 + recentAnalyses.length * 8);
    return [
      {
        label: "ATS readiness",
        score: ats,
        note: ats >= 85 ? "Strong ATS alignment" : ats >= 70 ? "Good base, still improvable" : "Needs stronger resume optimization",
      },
      {
        label: "Role-fit strength",
        score: match,
        note: match >= 85 ? "Profile looks role-aligned" : match >= 70 ? "Relevant, but can be sharper" : "Target role is still broad",
      },
      {
        label: "Portfolio signal",
        score: portfolioSignal,
        note: portfolioSignal >= 80 ? "Project/storytelling signal is strong" : "More visible proof will help recruiters",
      },
      {
        label: "Execution consistency",
        score: consistency,
        note: consistency >= 80 ? "You are building momentum well" : "Consistency can become a stronger differentiator",
      },
    ];
  }, [recentAnalyses, savedJobs, aiStudioHistory, sprintCompletion, opportunityRadar.averageMatch]);

  const weeklyInsights = useMemo(() => {
    const latest = recentAnalyses[0];
    const previous = recentAnalyses[1];
    const atsTrend = latest && previous ? latest.score - previous.score : 0;
    const savedRoleCount = savedJobs.length;
    const topRole = savedJobs[0]?.title || opportunityRadar.strongestRole;
    return [
      latest
        ? `Your latest ATS score is ${latest.score}. ${atsTrend > 0 ? `That is up by ${atsTrend} points from the previous saved analysis.` : atsTrend < 0 ? `That is down by ${Math.abs(atsTrend)} points, so revisit the recent edits.` : "That is flat versus the previous saved analysis."}`
        : "Run a fresh analyzer pass to generate a sharper weekly insight.",
      savedRoleCount
        ? `You currently have ${savedRoleCount} saved role${savedRoleCount === 1 ? "" : "s"}. The strongest signal right now is around ${topRole}.`
        : "Save a few jobs from the matcher so the platform can surface more targeted opportunity insights.",
      aiStudioHistory.length
        ? `AI Studio activity is helping your profile story. ${aiStudioHistory.length} recent output${aiStudioHistory.length === 1 ? "" : "s"} can be turned into recruiter-facing resume proof.`
        : "Use AI Studio to create stronger summaries, keyword banks, and outreach drafts this week.",
    ];
  }, [recentAnalyses, savedJobs, aiStudioHistory, opportunityRadar.strongestRole]);

  const addSprintTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setSprintTasks((current) => [
      ...current,
      { id: Date.now(), title: trimmed, done: false },
    ]);
    setNewTask("");
  };

  const addPlannerItem = () => {
    const company = plannerDraft.company.trim();
    const role = plannerDraft.role.trim();
    const date = plannerDraft.date.trim();
    if (!company || !role || !date) return;
    setPlannerItems((current) => [
      ...current,
      { id: Date.now(), company, role, date, stage: plannerDraft.stage },
    ]);
    setPlannerDraft({ company: "", role: "", date: "", stage: "Mock prep" });
  };

  const updateJobStatus = (jobId, nextStatus) => {
    setSavedJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? { ...job, status: nextStatus, updatedAt: new Date().toISOString() }
          : job
      )
    );
  };

  const removePlannerItem = (id) => {
    setPlannerItems((current) => current.filter((item) => item.id !== id));
  };

  const exportWeeklySnapshot = () => {
    const lines = [
      "RESUMEAI PRO - WEEKLY SNAPSHOT",
      "=".repeat(40),
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `Sprint completion: ${sprintCompletion}%`,
      `Saved roles: ${savedJobs.length}`,
      `Average ATS: ${stats.avgScore}`,
      `Best ATS: ${stats.bestScore}`,
      `Top package: ${opportunityRadar.topSalary}`,
      `Strongest role: ${opportunityRadar.strongestRole}`,
      "",
      "WEEKLY INSIGHTS",
      ...weeklyInsights.map((item) => `- ${item}`),
      "",
      "FOCUS NOTE",
      focusNote || "No focus note added.",
      "",
      "INTERVIEW PLANNER",
      ...(plannerItems.length
        ? plannerItems.map((item) => `- ${item.date}: ${item.company} | ${item.role} | ${item.stage}`)
        : ["- No planner items yet."]),
      "",
      "SAVED JOBS",
      ...(savedJobs.length
        ? savedJobs.slice(0, 8).map((job) => `- ${job.title} at ${job.company} | ${job.status || "Saved"} | ${job.salary || `${job.salaryMin || 0}L+`}`)
        : ["- No saved jobs yet."]),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resumeai-weekly-snapshot.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="card-elevated overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="space-y-4">
            <div className="pill bg-white/10 text-white border-white/20">⚡ AI Command Center</div>
            <div>
              <h1 className="text-4xl font-bold text-white">Track progress, opportunities, and next-best actions</h1>
              <p className="mt-3 max-w-2xl text-slate-200">
                Your dashboard now surfaces portfolio signals, saved jobs, readiness trends, and action plans in one polished place.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Sprint progress", value: `${sprintCompletion}%` },
                { label: "Saved roles", value: stats.savedRoles || 3 },
                { label: "Best signal", value: "Strong fit" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-300">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-white/10 bg-white/10 p-5 text-slate-100">
            <div className="text-sm font-semibold">Today’s AI recommendation</div>
            <div className="mt-3 rounded-2xl border border-teal-400/20 bg-teal-500/10 p-4">
              <div className="text-lg font-semibold text-white">Push this project on your resume</div>
              <p className="mt-2 text-sm text-slate-200">
                Mention the upgraded frontend, AI-based matching, career planning, and recruiter dashboard to show full-stack product thinking.
              </p>
            </div>
            <div className="mt-4 text-sm text-slate-200">
              <div>• Add 2-3 screenshots to your GitHub README</div>
              <div>• Quantify the product workflow and features shipped</div>
              <div>• Keep one crisp line on NLP / semantic matching</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total analyses", value: stats.totalAnalyses, note: "+2 this week", icon: "📄" },
          { label: "Average ATS", value: stats.avgScore, note: "+6 this month", icon: "📊" },
          { label: "Best score", value: stats.bestScore, note: "Achieved recently", icon: "⚡" },
          { label: "Jobs matched", value: stats.jobsMatched, note: "+12 this week", icon: "💼" },
          { label: "Saved roles", value: stats.savedRoles, note: "Synced from matcher", icon: "⭐" },
        ].map((card) => (
          <div key={card.label} className="card-elevated p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted">{card.label}</span>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="mt-3 text-3xl font-bold text-main">{card.value}</div>
            <div className="mt-1 text-xs text-muted">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">Recent analyses</h2>
            <a href="/analyzer" className="text-sm font-medium text-teal-600 hover:text-teal-700">Open analyzer →</a>
          </div>
          <div className="space-y-3">
            {recentAnalyses.map((analysis) => (
              <div key={analysis.id} className="flex flex-col gap-3 rounded-2xl border card-light-bg p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-main">{analysis.role}</div>
                  <div className="mt-1 text-xs text-muted">📅 {new Date(analysis.date).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-main">{analysis.score} ATS</div>
                    <div className="text-xs text-muted">{analysis.match}% match</div>
                  </div>
                  <span className={analysis.status === "strong" ? "badge-success" : analysis.status === "moderate" ? "badge-warning" : "badge-danger"}>
                    {analysis.status === "strong" ? "Strong" : analysis.status === "moderate" ? "Moderate" : "Needs work"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <h2 className="text-xl font-semibold text-main">Quick launch</h2>
          <div className="space-y-3">
            {[
              ["New ATS analysis", "/analyzer"],
              ["Find matching jobs", "/matcher"],
              ["Open AI Studio", "/ai-studio"],
              ["Plan skill growth", "/skill-gap"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="flex items-center justify-between rounded-2xl border card-quick-launch p-4 font-medium text-main hover:border-teal-300 transition-colors">
                <span>{label}</span>
                <span>→</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">This week's action sprint</h2>
            <span className="badge-primary">{sprintCompletion}% done</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill-primary" style={{ width: `${sprintCompletion}%` }} />
          </div>
          <div className="space-y-3">
            {sprintTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSprintTasks((current) => current.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item)))}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${task.done ? "border-emerald-700 bg-emerald-900" : "card-light-bg"}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${task.done ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-200"}`}>
                  {task.done ? "✓" : task.id}
                </span>
                <span className="text-sm font-medium text-main">{task.title}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed card-light-bg p-4 md:flex-row">
            <input
              className="input"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a custom sprint task"
            />
            <button type="button" onClick={addSprintTask} className="btn-secondary whitespace-nowrap">
              Add task
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-main">Opportunity radar</h2>
              <a href="/matcher" className="text-sm font-medium text-teal-600 hover:text-teal-700">Open matcher →</a>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border card-light-bg p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Top package</div>
                <div className="mt-2 text-2xl font-bold text-main">{opportunityRadar.topSalary}</div>
              </div>
              <div className="rounded-2xl border card-light-bg p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Strongest role</div>
                <div className="mt-2 text-lg font-bold text-main">{opportunityRadar.strongestRole}</div>
              </div>
              <div className="rounded-2xl border card-light-bg p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Average match</div>
                <div className="mt-2 text-2xl font-bold text-main">{opportunityRadar.averageMatch}%</div>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <h2 className="text-xl font-semibold text-main">Saved opportunities</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {visibleSavedJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border card-light-bg p-4">
                  <div className="font-semibold text-main">{job.title}</div>
                  <div className="mt-1 text-sm text-muted">{job.company}</div>
                  <div className="mt-3 text-sm font-semibold text-teal-500">{job.match}% match</div>
                  <div className="mt-2 text-xs text-muted">{job.status || "Saved"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-main">Resume version comparison</h2>
              <a href="/analyzer" className="text-sm font-medium text-teal-600 hover:text-teal-700">Analyze again →</a>
            </div>
            <div className="mt-4">
              {resumeVersionComparison ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border card-light-bg p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted">Previous</div>
                    <div className="mt-2 font-semibold text-main">{resumeVersionComparison.previousLabel}</div>
                    <div className="mt-3 text-sm text-muted">ATS {resumeVersionComparison.previousScore} • Match {resumeVersionComparison.previousMatch}%</div>
                  </div>
                  <div className="rounded-2xl border card-light-bg p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted">Latest</div>
                    <div className="mt-2 font-semibold text-main">{resumeVersionComparison.latestLabel}</div>
                    <div className="mt-3 text-sm text-muted">ATS {resumeVersionComparison.latestScore} • Match {resumeVersionComparison.latestMatch}%</div>
                    <div className={`mt-3 text-sm font-semibold ${resumeVersionComparison.scoreDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      ATS {resumeVersionComparison.scoreDelta >= 0 ? "+" : ""}{resumeVersionComparison.scoreDelta} | Match {resumeVersionComparison.matchDelta >= 0 ? "+" : ""}{resumeVersionComparison.matchDelta}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border card-light-bg p-4 text-sm text-muted">
                  Save at least two analyses from the analyzer to compare resume versions here.
                </div>
              )}
            </div>
          </div>

          <div className="card-elevated p-6">
            <h2 className="text-xl font-semibold text-main">Market pulse</h2>
            <div className="mt-4 space-y-4">
              {marketPulse.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-main">{item.label}</span>
                    <span className="text-muted">{item.score}/100 demand</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill-primary" style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-6">
            <h2 className="text-xl font-semibold text-main">Latest AI Studio outputs</h2>
            <div className="mt-4 space-y-3">
              {aiStudioHistory.length ? (
                aiStudioHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border card-light-bg p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-main">{item.type}</div>
                      <div className="text-[11px] text-muted">{item.createdAt}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted">{item.preview}...</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border card-light-bg p-4 text-sm text-muted">
                  Open `AI Studio` to generate cover letters, ATS keywords, LinkedIn summaries, and outreach drafts.
                </div>
              )}
            </div>
          </div>

          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-main">Focus note</h2>
              <span className="badge-primary">Persistent</span>
            </div>
            <textarea
              className="textarea"
              rows={4}
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value)}
              placeholder="Write the one thing you want to improve this week: better ATS score, more saved jobs, stronger bullets, interview practice..."
            />
            <p className="text-xs text-muted">This note stays saved on this device so users can keep a clear weekly focus.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="card-elevated p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-main">{rec.title}</h3>
              <span className={rec.impact === "high" ? "badge-danger" : "badge-warning"}>
                {rec.impact === "high" ? "High impact" : "Medium impact"}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">{rec.description}</p>
            <div className="mt-3 text-xs text-muted">Effort: {rec.effort}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">Recruiter scorecard</h2>
            <span className="badge-primary">Signal view</span>
          </div>
          <div className="space-y-4">
            {recruiterScorecard.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-main">{item.label}</span>
                  <span className="text-sm font-semibold text-muted">{item.score}/100</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill-primary" style={{ width: `${item.score}%` }} />
                </div>
                <p className="text-xs text-muted">{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">AI weekly insights digest</h2>
            <span className="badge-secondary">Auto-generated</span>
          </div>
          <div className="space-y-3">
            {weeklyInsights.map((item) => (
              <div key={item} className="rounded-2xl border card-light-bg p-4 text-sm text-main">
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
            Next best move: refresh your resume analysis, move one saved role to `Applied`, and tighten the top 3 bullets for the strongest-fit job.
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">Interview planner</h2>
            <a href="/interview" className="text-sm font-medium text-teal-600 hover:text-teal-700">Open interview prep →</a>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="input"
              placeholder="Company"
              value={plannerDraft.company}
              onChange={(e) => setPlannerDraft((current) => ({ ...current, company: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Role"
              value={plannerDraft.role}
              onChange={(e) => setPlannerDraft((current) => ({ ...current, role: e.target.value }))}
            />
            <input
              type="date"
              className="input"
              value={plannerDraft.date}
              onChange={(e) => setPlannerDraft((current) => ({ ...current, date: e.target.value }))}
            />
            <select
              className="select"
              value={plannerDraft.stage}
              onChange={(e) => setPlannerDraft((current) => ({ ...current, stage: e.target.value }))}
            >
              {["Mock prep", "Round 1 prep", "Technical prep", "HR prep", "Final round"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={addPlannerItem} className="btn-secondary">
            Add planner item
          </button>
          <div className="space-y-3">
            {plannerItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border card-light-bg p-4">
                <div>
                  <div className="font-semibold text-main">{item.company} • {item.role}</div>
                  <div className="mt-1 text-sm text-muted">{item.date} • {item.stage}</div>
                </div>
                <button type="button" onClick={() => removePlannerItem(item.id)} className="btn-ghost text-rose-600 hover:bg-rose-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-main">Weekly progress snapshot</h2>
            <span className="badge-secondary">Exportable</span>
          </div>
          <div className="rounded-2xl border card-light-bg p-4 space-y-3 text-sm text-main">
            <div>Sprint completion: <span className="font-semibold text-main">{sprintCompletion}%</span></div>
            <div>Saved roles: <span className="font-semibold text-main">{savedJobs.length}</span></div>
            <div>Average ATS: <span className="font-semibold text-main">{stats.avgScore}</span></div>
            <div>Top package target: <span className="font-semibold text-main">{opportunityRadar.topSalary}</span></div>
          </div>
          <p className="text-sm text-muted">
            Export a lightweight weekly summary users can keep as a progress log or share with mentors and recruiters.
          </p>
          <button type="button" onClick={exportWeeklySnapshot} className="btn-primary">
            Export weekly snapshot
          </button>
        </div>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <h2 className="text-xl font-semibold text-main">Application pipeline snapshot</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {pipeline.map((item) => (
            <div key={item.stage} className={`rounded-2xl border card-light-bg p-4`}>
              <div className="text-sm font-medium text-muted">{item.stage}</div>
              <div className="mt-2 text-3xl font-bold text-main">{item.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-main">Application tracker</h2>
          <a href="/matcher" className="text-sm font-medium text-teal-600 hover:text-teal-700">Open matcher →</a>
        </div>
        {savedJobs.length ? (
          <div className="space-y-3">
            {savedJobs.slice(0, 6).map((job) => (
              <div key={job.id} className="rounded-2xl border card-light-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-main">{job.title}</div>
                    <div className="mt-1 text-sm text-muted">{job.company} • {job.location || "Remote"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Saved", "Applied", "Interviewing", "Offer-ready"].map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => updateJobStatus(job.id, stage)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          (job.status || "Saved") === stage
                            ? "bg-teal-600 text-white"
                            : "border border-slate-600 bg-slate-800 text-slate-200"
                        }`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border card-light-bg p-4 text-sm text-muted">
            Save jobs from the matcher to manage them here across `Saved`, `Applied`, `Interviewing`, and `Offer-ready`.
          </div>
        )}
      </div>

      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-main">Attention snapshot</h2>
          <a href="/notifications" className="text-sm font-medium text-teal-600 hover:text-teal-700">Open notifications →</a>
        </div>
        {notificationsSnapshot.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {notificationsSnapshot.map((item) => (
              <div key={item.id} className="rounded-2xl border card-light-bg p-4">
                <div className="text-sm font-semibold text-main">{item.title || "Platform update"}</div>
                <div className="mt-2 text-sm text-muted">{item.message || "New activity is available in your workspace."}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border card-light-bg p-4 text-sm text-muted">
            No unread attention items right now. Resume, matcher, and interview activity will appear here automatically.
          </div>
        )}
      </div>
    </div>
  );
}
