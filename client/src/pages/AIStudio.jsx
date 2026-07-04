import { useMemo, useState } from "react";
import { api } from "../api";

const STORAGE_KEY = "resumeai_ai_studio_history";
const HISTORY_LIMIT = 8;

const roleProfiles = {
  "AI Engineer": {
    baseScore: 82,
    demand: "Very high",
    salary: "₹12-28 LPA",
    summary: "Build intelligent products using NLP, LLMs, vector search, and production ML workflows.",
    hotSkills: ["Python", "LLMs", "MLOps", "FastAPI", "Vector DBs", "Docker"],
    projects: [
      "Build a resume-ranking engine with semantic matching",
      "Deploy an interview copilot with evaluation scoring",
      "Create a personal recruiter analytics dashboard",
    ],
    recruiterSignals: ["RAG", "Prompt engineering", "Model evaluation", "Production deployment"],
  },
  "Data Scientist": {
    baseScore: 79,
    demand: "High",
    salary: "₹10-24 LPA",
    summary: "Turn data into predictions, dashboards, experiments, and decision-ready recommendations.",
    hotSkills: ["Python", "SQL", "Statistics", "ML", "Visualization", "A/B Testing"],
    projects: [
      "Predict job match probability from resume features",
      "Design a salary intelligence dashboard",
      "Create a candidate success propensity model",
    ],
    recruiterSignals: ["Feature engineering", "Experimentation", "Business impact", "Storytelling"],
  },
  "ML Engineer": {
    baseScore: 84,
    demand: "Very high",
    salary: "₹14-30 LPA",
    summary: "Focus on scalable training, deployment, monitoring, and model reliability.",
    hotSkills: ["PyTorch", "CI/CD", "Kubernetes", "Monitoring", "APIs", "Inference"],
    projects: [
      "Serve a recommendation model through FastAPI",
      "Add model monitoring and drift alerts",
      "Containerize a multi-service AI product",
    ],
    recruiterSignals: ["Scalability", "Latency", "Pipelines", "Cloud deployment"],
  },
  "Product Manager": {
    baseScore: 74,
    demand: "Strong",
    salary: "₹11-26 LPA",
    summary: "Own product strategy, user research, roadmap prioritization, and AI feature delivery.",
    hotSkills: ["Roadmapping", "Discovery", "Analytics", "User empathy", "Experiment design", "AI products"],
    projects: [
      "Write a full AI feature PRD for this app",
      "Track funnel conversion from upload to shortlist",
      "Design an application-tracker experience",
    ],
    recruiterSignals: ["Execution", "Metrics", "Prioritization", "Cross-functional leadership"],
  },
};

const experienceBoost = {
  Student: -6,
  "Early Career": 0,
  "Mid Level": 5,
  Senior: 9,
};

const focusPlans = {
  Portfolio: ["Ship one visible feature every week", "Turn each feature into a polished case study", "Capture screenshots, metrics, and UX rationale"],
  Interviews: ["Practice 3 domain questions daily", "Refine STAR stories with measurable impact", "Record mock answers and compare improvements"],
  Freelancing: ["Package this product as a service demo", "Create pricing tiers and a landing page", "Add recruiter-facing reporting features"],
  Networking: ["Post project updates on LinkedIn twice weekly", "Message 5 aligned recruiters each week", "Turn every feature into a portfolio talking point"],
};

const toolCards = [
  { id: "cover", title: "Cover letter", icon: "✉️", desc: "Generate a tailored letter from your resume and job description." },
  { id: "keywords", title: "ATS keywords", icon: "🔑", desc: "Create a recruiter-ready keyword bank and placement ideas." },
  { id: "headline", title: "LinkedIn profile", icon: "🪄", desc: "Write a strong headline and about section for your public profile." },
  { id: "networking", title: "Outreach", icon: "🤝", desc: "Create a recruiter message and follow-up email with better context." },
  { id: "bullet", title: "Bullet rewrite", icon: "✍️", desc: "Turn weak bullets into stronger, sharper recruiter-ready lines." },
  { id: "recommendation", title: "Role recommendation", icon: "🎯", desc: "Get grounded role suggestions, strengths, gaps, and next steps." },
];

const presetIdeas = [
  {
    label: "AI Engineer pitch",
    tool: "headline",
    text: "Built an AI resume platform with ATS analysis, semantic job matching, recruiter dashboards, and LLM-powered career tools.",
  },
  {
    label: "Recruiter outreach",
    tool: "networking",
    text: "I want a short LinkedIn message for a recruiter hiring AI Engineers for product-focused teams.",
  },
  {
    label: "ATS keyword sprint",
    tool: "keywords",
    text: "Looking for AI Engineer, ML Engineer, and data platform roles using Python, NLP, FastAPI, Docker, and semantic search.",
  },
  {
    label: "Project bullet rewrite",
    tool: "bullet",
    text: "Built a resume analysis project using React and Node.js and improved the UI for users.",
  },
];

const toneOptions = ["impactful", "professional", "confident", "concise"];

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AIStudio() {
  const [track, setTrack] = useState("AI Engineer");
  const [experience, setExperience] = useState("Early Career");
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [focus, setFocus] = useState("Portfolio");
  const [activeTool, setActiveTool] = useState("cover");
  const [resumeFile, setResumeFile] = useState(null);
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [headlineContext, setHeadlineContext] = useState("Built an AI resume platform with ATS analysis, job matching, recruiter insights, and polished product UX.");
  const [networkingGoal, setNetworkingGoal] = useState("I am applying for an AI Engineer role and want a warm, concise outreach message for a recruiter.");
  const [bulletInput, setBulletInput] = useState("Built and redesigned an AI resume analyzer web app using React, Node.js, and LLM-backed workflows.");
  const [tone, setTone] = useState("impactful");
  const [loadingTool, setLoadingTool] = useState("");
  const [toolNotice, setToolNotice] = useState("");
  const [history, setHistory] = useState(() => loadHistory());
  const [outputs, setOutputs] = useState({
    cover: "",
    keywords: "",
    headline: "",
    networking: "",
    bullet: "",
    recommendation: "",
  });

  const plan = useMemo(() => {
    const profile = roleProfiles[track];
    const bonus = experienceBoost[experience] || 0;
    const studyBoost = Math.min(8, Math.floor(weeklyHours / 2));
    const readiness = Math.max(58, Math.min(96, profile.baseScore + bonus + studyBoost));
    const confidence = Math.max(60, Math.min(97, readiness + 4));
    const portfolioStrength = Math.max(52, Math.min(95, readiness - 6 + Math.floor(weeklyHours / 3)));
    const planType = weeklyHours >= 12 ? "Accelerated" : weeklyHours >= 7 ? "Balanced" : "Lean";

    return {
      ...profile,
      readiness,
      confidence,
      portfolioStrength,
      planType,
      nextWeek: [
        `Deepen ${profile.hotSkills[0]} and ${profile.hotSkills[1]} practice`,
        `Ship or polish: ${profile.projects[0]}`,
        `Document one recruiter-ready impact metric for ${track}`,
      ],
    };
  }, [experience, track, weeklyHours]);

  const saveHistoryItem = (type, content) => {
    const next = [
      {
        id: `${Date.now()}-${type}`,
        type,
        preview: content.slice(0, 180),
        createdAt: new Date().toLocaleString(),
      },
      ...history,
    ].slice(0, HISTORY_LIMIT);
    setHistory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const setToolOutput = (toolId, title, content) => {
    setOutputs((current) => ({ ...current, [toolId]: content }));
    saveHistoryItem(title, content);
  };

  const copyText = async (text) => {
    if (!text) {
      setToolNotice("Generate content first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setToolNotice("Copied to clipboard.");
    } catch {
      setToolNotice("Copy failed. Please copy manually.");
    }
  };

  const applyPreset = (preset) => {
    setActiveTool(preset.tool);
    if (preset.tool === "headline") {
      setHeadlineContext(preset.text);
    } else if (preset.tool === "networking") {
      setNetworkingGoal(preset.text);
    } else if (preset.tool === "keywords" || preset.tool === "cover") {
      setJobDescription(preset.text);
    } else if (preset.tool === "bullet") {
      setBulletInput(preset.text);
    }
    setToolNotice(`Loaded preset: ${preset.label}`);
  };

  const createCoverLetter = async () => {
    setLoadingTool("cover");
    setToolNotice("");
    try {
      const form = new FormData();
      if (resumeFile) {
        form.append("file", resumeFile);
      }
      form.append(
        "job_description",
        `Target role: ${track}\nCompany: ${company || "Not specified"}\nJob description:\n${jobDescription || "Please tailor it to a modern AI/product role using my project background."}`
      );
      const res = await api.coverLetter(form);
      const text = res.cover_letter || "No cover letter was generated.";
      setToolOutput("cover", "Cover letter", text);
      setToolNotice("Cover letter ready.");
    } catch (err) {
      setToolNotice(err.message || "Cover letter generation failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const createKeywords = async () => {
    setLoadingTool("keywords");
    setToolNotice("");
    try {
      const form = new FormData();
      if (resumeFile) {
        form.append("file", resumeFile);
      }
      form.append("job_description", jobDescription || `Target role: ${track}. Use modern AI / ML recruiter keywords.`);

      let text = "";
      try {
        const res = await api.keywordOptimize(form);
        text = res.keywords || "";
      } catch {
        const res = await api.chat({
          role: track,
          mode: "resume",
          jobDescription,
          messages: [
            {
              role: "user",
              content: `Create 15 ATS keywords and 5 phrases to include for a ${track} application. Context: ${jobDescription || headlineContext}`,
            },
          ],
        });
        text = res.reply || "";
      }

      setToolOutput("keywords", "ATS keywords", text || "No keyword suggestions generated.");
      setToolNotice("ATS keyword suggestions ready.");
    } catch (err) {
      setToolNotice(err.message || "Keyword generation failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const createHeadline = async () => {
    setLoadingTool("headline");
    setToolNotice("");
    try {
      const res = await api.chat({
        role: track,
        mode: "career",
        messages: [
          {
            role: "user",
            content: `Using this profile context: ${headlineContext}\nWrite:\n1) one LinkedIn headline under 220 characters\n2) one 3-sentence About section\n3) three short resume headline alternatives. Keep it premium and recruiter-friendly.`,
          },
        ],
      });
      const text = res.reply || "No profile content generated.";
      setToolOutput("headline", "LinkedIn profile", text);
      setToolNotice("LinkedIn summary ready.");
    } catch (err) {
      setToolNotice(err.message || "Profile generation failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const createNetworkingMessage = async () => {
    setLoadingTool("networking");
    setToolNotice("");
    try {
      const res = await api.chat({
        role: track,
        mode: "career",
        jobDescription,
        messages: [
          {
            role: "user",
            content: `Company: ${company || "target company"}\nGoal: ${networkingGoal}\nWrite one short LinkedIn message and one concise follow-up email for a ${track} opportunity. Make it warm, professional, and practical.`,
          },
        ],
      });
      const text = res.reply || "No outreach draft generated.";
      setToolOutput("networking", "Outreach draft", text);
      setToolNotice("Outreach draft ready.");
    } catch (err) {
      setToolNotice(err.message || "Outreach generation failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const createBulletRewrite = async () => {
    setLoadingTool("bullet");
    setToolNotice("");
    try {
      const res = await api.feedbackRewrite(bulletInput, tone);
      const text = res.rewritten || "No rewrite generated.";
      setToolOutput("bullet", "Bullet enhancer", text);
      setToolNotice("Bullet rewrite ready.");
    } catch (err) {
      setToolNotice(err.message || "Bullet rewrite failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const createRecommendations = async () => {
    setLoadingTool("recommendation");
    setToolNotice("");
    try {
      let text = "";
      if (resumeFile) {
        const form = new FormData();
        form.append("file", resumeFile);
        form.append("role", track);
        form.append("experience", experience);
        form.append("weekly_hours", String(weeklyHours));
        form.append("focus", focus);
        form.append("company", company || "");
        form.append("job_description", jobDescription || "");
        form.append("headline_context", headlineContext || "");
        const res = await api.careerRecommendation(form);
        text = res.recommendations || "";
      } else {
        const res = await api.careerCoach({
          question: `Suggest the best next-fit roles for me based on ${track}, ${experience}, ${weeklyHours} hours per week, and this context: ${headlineContext}`,
          role: track,
          context: `${focus} focus | ${headlineContext}`,
        });
        text = res.answer || "";
      }

      setToolOutput("recommendation", "Role recommendation", text || "No recommendation generated.");
      setToolNotice("Career recommendations ready.");
    } catch (err) {
      setToolNotice(err.message || "Role recommendation failed.");
    } finally {
      setLoadingTool("");
    }
  };

  const activeOutput = outputs[activeTool];

  return (
    <div className="space-y-8">
      <div className="card-elevated overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-950 p-6 text-white md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
          <div className="space-y-5">
            <div className="pill bg-white/10 text-white border-white/20">🧠 AI / ML Showcase Studio</div>
            <div>
              <h1 className="text-4xl font-bold text-white">Turn this project into a standout resume piece</h1>
              <p className="mt-3 max-w-2xl text-slate-200">
                Explore a polished AI product layer with market-fit scoring, portfolio guidance, recruiter signals,
                and a personalized growth plan.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Market fit", value: `${plan.readiness}%` },
                { label: "Confidence", value: `${plan.confidence}%` },
                { label: "Plan mode", value: plan.planType },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-300">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-white/10 bg-white/10 p-5 text-slate-100">
            <div className="grid gap-3">
              <label className="text-sm font-medium">Target track</label>
              <select className="select border-white/20 bg-slate-950/30 text-white" value={track} onChange={(e) => setTrack(e.target.value)}>
                {Object.keys(roleProfiles).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <label className="text-sm font-medium">Experience</label>
              <select className="select border-white/20 bg-slate-950/30 text-white" value={experience} onChange={(e) => setExperience(e.target.value)}>
                {Object.keys(experienceBoost).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <label className="text-sm font-medium">Weekly learning hours: {weeklyHours}</label>
              <input type="range" min="3" max="18" value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value))} />

              <label className="text-sm font-medium">Current focus</label>
              <select className="select border-white/20 bg-slate-950/30 text-white" value={focus} onChange={(e) => setFocus(e.target.value)}>
                {Object.keys(focusPlans).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Role outlook", value: plan.demand, note: plan.summary, tone: "from-teal-50 to-white" },
          { title: "Salary signal", value: plan.salary, note: "Use this as your target band while positioning the project.", tone: "from-indigo-50 to-white" },
          { title: "Portfolio strength", value: `${plan.portfolioStrength}%`, note: "Higher when you add screenshots, metrics, and deployment proof.", tone: "from-amber-50 to-white" },
          { title: "AI outputs", value: `${history.length}+`, note: "Generated drafts, rewrites, and recommendations stay in this workspace.", tone: "from-rose-50 to-white" },
        ].map((card) => (
          <div key={card.title} className={`card-elevated bg-gradient-to-br ${card.tone} p-5`}>
            <div className="text-sm font-semibold text-slate-700">{card.title}</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{card.value}</div>
            <p className="mt-2 text-sm text-slate-600">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-elevated p-6 space-y-5">
          <div>
            <div className="pill-primary">🚀 90-day roadmap</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">What to do next</h2>
          </div>
          <div className="space-y-4">
            {plan.nextWeek.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Sprint action {index + 1}</div>
                  <div className="text-sm text-slate-600">{item}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="text-sm font-semibold text-indigo-900">Focus strategy: {focus}</div>
            <div className="mt-2 space-y-2 text-sm text-indigo-900/80">
              {focusPlans[focus].map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-elevated p-6 space-y-5">
          <div>
            <div className="pill-secondary">🔥 Recruiter signals</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">Keywords to emphasize</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.recruiterSignals.concat(plan.hotSkills).map((item) => (
              <span key={item} className="pill-primary">{item}</span>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Resume-ready positioning</div>
            <p className="mt-2 text-sm text-slate-600">
              Built an end-to-end AI resume platform with ATS scoring, semantic job matching, skill-gap analysis,
              recruiter tools, and an interactive career growth cockpit.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated p-6">
          <div className="text-lg font-semibold text-slate-900">Portfolio project blueprints</div>
          <div className="mt-4 space-y-3">
            {plan.projects.map((project, index) => (
              <div key={project} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Project {index + 1}</div>
                <div className="mt-1 text-sm text-slate-600">{project}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="text-lg font-semibold text-slate-900">High-value skills to highlight</div>
          <div className="mt-4 space-y-3">
            {plan.hotSkills.map((skill, index) => (
              <div key={skill}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{skill}</span>
                  <span className="text-slate-500">{92 - index * 7}% relevance</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill-primary" style={{ width: `${92 - index * 7}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <div className="pill-primary">🤖 Interactive LLM workspace</div>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Generate more AI-powered career assets</h2>
          <p className="mt-2 text-slate-600">Use built-in LLM flows to create cover letters, ATS keyword packs, LinkedIn summaries, outreach drafts, rewrites, and role recommendations.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="card-elevated p-6 space-y-5">
            <div>
              <div className="text-lg font-semibold text-slate-900">Shared AI context</div>
              <p className="mt-1 text-sm text-slate-500">Upload a resume and reuse the same context across all generators.</p>
            </div>

            <div className="space-y-3">
              <input id="ai-studio-resume" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
              <label htmlFor="ai-studio-resume" className="flex cursor-pointer items-center justify-between rounded-2xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-700 hover:border-teal-400 hover:bg-teal-50">
                <span>{resumeFile ? `✓ ${resumeFile.name}` : "Upload resume for AI context"}</span>
                <span className="badge-primary">Optional</span>
              </label>

              <input className="input" placeholder="Target company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
              <textarea className="textarea" rows={5} placeholder="Paste a target job description or opportunity details..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Choose a tool</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {toolCards.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveTool(tool.id)}
                    className={`rounded-2xl border p-3 text-left transition ${activeTool === tool.id ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-200"}`}
                  >
                    <div className="text-lg">{tool.icon}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{tool.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{tool.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Quick presets</div>
              <div className="flex flex-wrap gap-2">
                {presetIdeas.map((preset) => (
                  <button key={preset.label} type="button" className="btn-secondary btn-sm" onClick={() => applyPreset(preset)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card-elevated p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{toolCards.find((tool) => tool.id === activeTool)?.title}</div>
                <div className="text-sm text-slate-500">{toolCards.find((tool) => tool.id === activeTool)?.desc}</div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => copyText(activeOutput)}>
                Copy output
              </button>
            </div>

            {toolNotice && <div className="alert-info">{toolNotice}</div>}

            {activeTool === "cover" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Generates a tailored cover letter from your uploaded resume and the job description above.
                </div>
                <button type="button" className="btn-primary" onClick={createCoverLetter} disabled={loadingTool === "cover"}>
                  {loadingTool === "cover" ? "Generating..." : "Generate cover letter"}
                </button>
              </div>
            )}

            {activeTool === "keywords" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Use this to create ATS terms, stack keywords, and recruiter phrases you should add to your resume.
                </div>
                <button type="button" className="btn-primary" onClick={createKeywords} disabled={loadingTool === "keywords"}>
                  {loadingTool === "keywords" ? "Generating..." : "Generate ATS keywords"}
                </button>
              </div>
            )}

            {activeTool === "headline" && (
              <div className="space-y-3">
                <textarea className="textarea" rows={5} value={headlineContext} onChange={(e) => setHeadlineContext(e.target.value)} placeholder="Add your achievements, stack, and project context..." />
                <button type="button" className="btn-primary" onClick={createHeadline} disabled={loadingTool === "headline"}>
                  {loadingTool === "headline" ? "Generating..." : "Generate LinkedIn summary"}
                </button>
              </div>
            )}

            {activeTool === "networking" && (
              <div className="space-y-3">
                <textarea className="textarea" rows={5} value={networkingGoal} onChange={(e) => setNetworkingGoal(e.target.value)} placeholder="Describe the outreach goal, tone, and who you are contacting..." />
                <button type="button" className="btn-primary" onClick={createNetworkingMessage} disabled={loadingTool === "networking"}>
                  {loadingTool === "networking" ? "Generating..." : "Generate outreach draft"}
                </button>
              </div>
            )}

            {activeTool === "bullet" && (
              <div className="space-y-3">
                <textarea className="textarea" rows={4} value={bulletInput} onChange={(e) => setBulletInput(e.target.value)} placeholder="Paste a project or experience bullet here..." />
                <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {toneOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <button type="button" className="btn-primary" onClick={createBulletRewrite} disabled={loadingTool === "bullet"}>
                  {loadingTool === "bullet" ? "Generating..." : "Rewrite bullet"}
                </button>
              </div>
            )}

            {activeTool === "recommendation" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Suggests the best next-fit roles and positioning strategy from your current background and target track.
                </div>
                <button type="button" className="btn-primary" onClick={createRecommendations} disabled={loadingTool === "recommendation"}>
                  {loadingTool === "recommendation" ? "Generating..." : "Generate role recommendations"}
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Generated output</div>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{activeOutput || "Run the selected AI tool to see the result here."}</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card-elevated p-6">
          <div className="text-lg font-semibold text-slate-900">Recent AI generations</div>
          <div className="mt-4 space-y-3">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{item.type}</div>
                    <div className="text-[11px] text-slate-500">{item.createdAt}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.preview}...</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Your generated AI drafts will appear here so you can reuse them while polishing the project and your resume.
              </div>
            )}
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="text-lg font-semibold text-slate-900">High-value feature ideas to ship next</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "One-click cover letter PDF export",
              "Personal cold-email generator for recruiters",
              "Auto-generated portfolio case study writer",
              "LinkedIn About section builder",
              "Project pitch generator for interviews",
              "Resume version tracker with AI notes",
            ].map((idea) => (
              <div key={idea} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {idea}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
