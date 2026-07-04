import { useMemo, useState } from "react";
import { api } from "../api";

const makeSearchApplyUrl = (job) => {
  const keywords = encodeURIComponent(`${job.title} ${job.company || ""}`.trim());
  const location = encodeURIComponent(job.location || "");
  return `https://www.indeed.com/jobs?q=${keywords}&l=${location}`;
};

const normalizeUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
};

const getApplyDestination = (job) => {
  const rawUrl = normalizeUrl(job.applyLink || job.apply_url || job.url || "");
  if (!rawUrl) return makeSearchApplyUrl(job);

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("indeed.") && parsed.pathname.includes("/viewjob")) {
      const jobKey = parsed.searchParams.get("jk") || "";
      if (!/^[a-z0-9]{12,}$/i.test(jobKey)) {
        return makeSearchApplyUrl(job);
      }
    }
    return parsed.toString();
  } catch {
    return makeSearchApplyUrl(job);
  }
};

const scoreToConfidence = (score = 0) => (score >= 85 ? "Very high" : score >= 70 ? "High" : score >= 60 ? "Medium" : "Low");

const scoreToFitType = (score = 0) => (score >= 88 ? "Excellent Fit" : score >= 78 ? "Strong Fit" : score >= 68 ? "Moderate Fit" : "Stretch Fit");

const getResumeActionTips = (job = {}) => {
  const tips = [];
  if (job.auto_apply?.summary) {
    tips.push(job.auto_apply.summary);
  }
  if (job.missing?.length) {
    tips.push(`Add these missing skills to your resume: ${job.missing.join(", ")}.`);
  }
  if (job.track) {
    tips.push(`Frame your experience for ${job.track} roles in your summary and bullets.`);
  }
  if (job.highlights?.length) {
    tips.push(`Mirror this hiring signal in your resume: ${job.highlights[0]}.`);
  }
  if (job.recommendationScore && job.recommendationScore < 80) {
    tips.push("Use stronger metrics and action verbs to boost fit for this role.");
  }
  return tips.slice(0, 3);
};

const inferWorkMode = (job = {}) => {
  const text = `${job.workMode || ""} ${job.location || ""} ${job.description || ""}`.toLowerCase();
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("onsite") || text.includes("on-site")) return "Onsite";
  if (text.includes("remote")) return "Remote";
  return "Any";
};

const inferTrack = (job = {}) => {
  const text = `${job.role || ""} ${job.title || ""} ${job.description || ""}`.toLowerCase();
  if (/(ml|machine learning|ai|nlp|llm|pytorch|tensorflow)/i.test(text)) return "AI / ML";
  if (/(data|analytics|analyst|scientist|sql|dashboard)/i.test(text)) return "Data / Analytics";
  if (/(product|strategy|roadmap|stakeholder)/i.test(text)) return "Product / Strategy";
  if (/(frontend|react|ui|ux|design system)/i.test(text)) return "Frontend + AI";
  return "All roles";
};

const parsePostedDateValue = (value = "") => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getTime();
};

const getWorkModeTone = (mode = "") => {
  if (/remote/i.test(mode)) return "bg-emerald-100 text-emerald-700";
  if (/hybrid/i.test(mode)) return "bg-amber-100 text-amber-700";
  if (/onsite/i.test(mode)) return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
};

const getEmploymentTone = (type = "") => {
  if (/intern/i.test(type)) return "bg-violet-100 text-violet-700";
  if (/contract/i.test(type)) return "bg-rose-100 text-rose-700";
  if (/part/i.test(type)) return "bg-cyan-100 text-cyan-700";
  return "bg-indigo-100 text-indigo-700";
};

const parseSalaryMin = (salary = "") => {
  const text = String(salary || "");
  const lakhMatch = text.match(/₹?\s*(\d+(?:\.\d+)?)\s*L/i);
  if (lakhMatch) return Math.round(Number(lakhMatch[1]));
  const kMatch = text.match(/(\d{2,3})\s*k/i);
  if (kMatch) return Math.max(1, Math.round(Number(kMatch[1]) / 10));
  return 0;
};

const trackToBackendRole = (track = "") => {
  const mapping = {
    "AI / ML": "ML Engineer",
    "Data / Analytics": "Data Analyst",
    "Product / Strategy": "Product Manager",
    "Frontend + AI": "Frontend",
  };
  return mapping[track] || "";
};

const getValueTier = (salaryMin = 0) =>
  salaryMin >= 20 ? "Premium Package" :
  salaryMin >= 15 ? "High Value" :
  salaryMin >= 10 ? "Balanced Value" :
  "Growth Starter";

const mapBackendJobToCard = (job, index = 0) => {
  const rawScore = Number(job.match_percentage ?? job.rerank_score ?? job.score ?? 0);
  const recommendationScore = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
  const salaryText = job.salary || "Competitive";
  const salaryMin = parseSalaryMin(salaryText);
  const postedDate = job.posted_at || job.postedAt || "";
  const posted = postedDate ? new Date(postedDate).toLocaleDateString() : "Recently posted";
  return {
    id: job.job_id || `match-${index}`,
    track: inferTrack(job),
    title: job.title || job.role || "Recommended role",
    company: job.company || "Hiring Company",
    location: job.location || "Remote / Flexible",
    workMode: inferWorkMode(job),
    salaryMin,
    salary: salaryText,
    match: recommendationScore,
    recommendationScore,
    recommendationConfidence: scoreToConfidence(recommendationScore),
    fitType: scoreToFitType(recommendationScore),
    skills: Array.isArray(job.matched_skills) && job.matched_skills.length ? job.matched_skills : (job.required_skills || ["Relevant experience"]),
    missing: Array.isArray(job.missing_skills) ? job.missing_skills : [],
    growth: job.company_fit ? `${Math.round(Number(job.company_fit) * 100)}% company fit` : "Growing opportunity",
    careerGrowthPotential: job.career_growth_potential || job.careerGrowthPotential || "Not specified",
    posted,
    experienceRequired: job.experience_required || "Not specified",
    interviewProb: recommendationScore >= 85 ? "High" : recommendationScore >= 72 ? "Medium" : "Low",
    description: Array.isArray(job.jd_simplified) && job.jd_simplified.length ? job.jd_simplified.join(". ") : "Resume-aligned opportunity.",
    applyLink: getApplyDestination({ ...job, applyLink: job.apply_url || job.applyLink || job.apply_link || job.url }),
    highlights: Array.isArray(job.why_this_job) && job.why_this_job.length ? job.why_this_job : ["Matched from your uploaded resume"],
    whyRecommended: job.why_recommended || job.whyRecommended || "",
    relevantProjects: Array.isArray(job.relevant_projects) ? job.relevant_projects : [],
    matchBreakdown: job.match_breakdown || job.matchBreakdown || {},
    source: job.source || "Recommended",
    finalScore: recommendationScore,
  };
};

const rankJobsByValue = (jobs = []) =>
  jobs
    .filter((job) => (job.recommendationScore || job.finalScore || 0) >= 68)
    .sort((a, b) => {
      if ((b.salaryMin || 0) !== (a.salaryMin || 0)) return (b.salaryMin || 0) - (a.salaryMin || 0);
      if ((b.recommendationScore || 0) !== (a.recommendationScore || 0)) return (b.recommendationScore || 0) - (a.recommendationScore || 0);
      return (b.match || 0) - (a.match || 0);
    })
    .map((job, index) => ({
      ...job,
      packageRank: index + 1,
      valueTier:
        (job.salaryMin || 0) >= 20 ? "Premium Package" :
        (job.salaryMin || 0) >= 15 ? "High Value" :
        (job.salaryMin || 0) >= 10 ? "Balanced Value" :
        "Growth Starter",
    }));

const tierSections = [
  { key: "Premium Package", title: "Premium Jobs", desc: "Highest salary opportunities with strong relevance." },
  { key: "High Value", title: "Best Value Jobs", desc: "Great balance of package and fit for your profile." },
  { key: "Balanced Value", title: "Balanced Jobs", desc: "Solid roles with good relevance and steady compensation." },
  { key: "Growth Starter", title: "Growth Starter Jobs", desc: "Entry-growth opportunities with lower package but useful upside." },
];

export default function JobMatcher() {
  const [file, setFile] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("resumeai_saved_jobs") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [filters, setFilters] = useState({
    track: "All roles",
    workMode: "Any",
    location: "",
    targetRole: "",
    experienceLevel: "Any",
    industry: "",
    jobDescription: "",
    minSalary: 5,
  });
  const [sortBy, setSortBy] = useState("Highest Match");
  const [companyFilter, setCompanyFilter] = useState("Any");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("Any");
  const [platformFilter, setPlatformFilter] = useState("Any");
  const [skillFilter, setSkillFilter] = useState("");
  const [postedWindow, setPostedWindow] = useState("Any");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const allJobs = useMemo(() => matches?.allJobs || matches?.jobs || [], [matches]);

  const stats = useMemo(() => {
    if (!allJobs.length) return null;
    const avgMatch = Math.round(allJobs.reduce((sum, job) => sum + (job.recommendationScore || job.match || 0), 0) / allJobs.length);
    const strongMatches = allJobs.filter((job) => (job.recommendationScore || job.match || 0) >= 85).length;
    const bestSalary = Math.max(...allJobs.map((job) => job.salaryMin || 0));
    return {
      avgMatch,
      strongMatches,
      bestSalary,
      total: allJobs.length,
    };
  }, [allJobs]);

  const companyOptions = useMemo(() => [...new Set(allJobs.map((job) => job.company).filter(Boolean))].sort(), [allJobs]);
  const platformOptions = useMemo(() => [...new Set(allJobs.map((job) => job.source || job.platform).filter(Boolean))].sort(), [allJobs]);
  const skillOptions = useMemo(() => [...new Set(allJobs.flatMap((job) => job.skills || []).filter(Boolean))].sort(), [allJobs]);

  const visibleJobs = useMemo(() => {
    const searchTerm = skillFilter.trim().toLowerCase();
    const filtered = allJobs.filter((job) => {
      const titleText = `${job.title || ""} ${job.company || ""} ${job.description || ""}`.toLowerCase();
      if (filters.track !== "All roles" && job.track !== filters.track) return false;
      if (filters.workMode !== "Any" && job.workMode !== filters.workMode) return false;
      if (job.salaryMin < Number(filters.minSalary || 0)) return false;
      if (filters.location && !titleText.includes(filters.location.toLowerCase())) return false;
      if (filters.targetRole && !titleText.includes(filters.targetRole.toLowerCase())) return false;
      if (filters.experienceLevel !== "Any" && !`${job.experienceRequired || ""}`.toLowerCase().includes(filters.experienceLevel.toLowerCase())) return false;
      if (companyFilter !== "Any" && job.company !== companyFilter) return false;
      if (employmentTypeFilter !== "Any" && `${job.employmentType || job.workMode || ""}`.toLowerCase() !== employmentTypeFilter.toLowerCase()) return false;
      if (platformFilter !== "Any" && `${job.source || job.platform || ""}` !== platformFilter) return false;
      if (remoteOnly && job.workMode !== "Remote") return false;
      if (searchTerm && !(job.skills || []).some((skill) => String(skill).toLowerCase().includes(searchTerm))) return false;
      if (postedWindow !== "Any") {
        const postedAt = parsePostedDateValue(job.posted || job.postedAt || job.posted_at);
        const ageInDays = Math.max(0, Math.floor((Date.now() - postedAt) / 86_400_000));
        if (postedWindow === "Last 7 days" && ageInDays > 7) return false;
        if (postedWindow === "Last 30 days" && ageInDays > 30) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "Newest Jobs":
          return (parsePostedDateValue(b.posted || b.postedAt || b.posted_at) || 0) - (parsePostedDateValue(a.posted || a.postedAt || a.posted_at) || 0);
        case "Highest Salary":
          return (b.salaryMin || 0) - (a.salaryMin || 0);
        case "Remote Jobs":
          return Number(b.workMode === "Remote") - Number(a.workMode === "Remote");
        case "Most Relevant":
          return ((b.recommendationScore || b.match || 0) - (a.recommendationScore || a.match || 0)) || ((b.matchBreakdown?.skill_match || 0) - (a.matchBreakdown?.skill_match || 0));
        case "Highest Match":
        default:
          return (b.recommendationScore || b.match || 0) - (a.recommendationScore || a.match || 0);
      }
    });

    return sorted.map((job, index) => ({ ...job, packageRank: index + 1 }));
  }, [allJobs, companyFilter, employmentTypeFilter, filters, platformFilter, postedWindow, remoteOnly, skillFilter, sortBy]);

  const curatedSections = useMemo(() => {
    const sections = [
      {
        key: "top-matches",
        title: "Top Matches",
        icon: "✨",
        description: "The sharpest fits for your current profile",
        jobs: visibleJobs.filter((job) => (job.recommendationScore || job.match || 0) >= 90).slice(0, 3),
      },
      {
        key: "remote-jobs",
        title: "Remote Jobs",
        icon: "🌐",
        description: "Flexible roles you can apply to from anywhere",
        jobs: visibleJobs.filter((job) => job.workMode === "Remote").slice(0, 3),
      },
      {
        key: "internships",
        title: "Internships",
        icon: "🎓",
        description: "Starter roles and early-career opportunities",
        jobs: visibleJobs.filter((job) => /intern/i.test(job.employmentType || "")).slice(0, 3),
      },
      {
        key: "high-salary",
        title: "High Salary",
        icon: "💸",
        description: "Strong package opportunities first",
        jobs: visibleJobs.filter((job) => (job.salaryMin || 0) >= 15).slice(0, 3),
      },
    ];
    return sections.filter((section) => section.jobs.length);
  }, [visibleJobs]);

  const handleMatch = async () => {
    if (!file) {
      setError("Please upload your resume to unlock AI job matching.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("location", filters.location || "");
      form.append("minSalary", String(filters.minSalary || 0));
      form.append("job_description", filters.jobDescription || "");
      form.append("target_role", filters.targetRole || "");
      form.append("experience_level", filters.experienceLevel || "");
      form.append("industry", filters.industry || "");
      form.append("k", "40");
      if (filters.track !== "All roles") {
        form.append("role", trackToBackendRole(filters.track));
      }

      const response = await api.matchJobs(form);
      const backendJobs = Array.isArray(response?.results) ? response.results : [];
      let sourceJobs = backendJobs.map((job, idx) => mapBackendJobToCard(job, idx));

      if (!sourceJobs.length) {
        setNotice(response?.provider_status || "No relevant jobs found");
      }

      const filteredJobs = sourceJobs
        .filter((job) => (filters.track === "All roles" ? true : job.track === filters.track))
        .filter((job) => (filters.workMode === "Any" ? true : job.workMode === filters.workMode))
        .filter((job) => !job.salaryMin || job.salaryMin >= Number(filters.minSalary))
        .filter((job) =>
          filters.location
            ? `${job.location} ${job.workMode}`.toLowerCase().includes(filters.location.toLowerCase())
            : true
        );

      const rankedJobs = rankJobsByValue(filteredJobs);
      const displayJobs = (rankedJobs.length ? rankedJobs : filteredJobs.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))).map((job, index) => ({
        ...job,
        packageRank: index + 1,
        valueTier: job.valueTier || getValueTier(job.salaryMin || 0),
      }));

      setMatches({
        jobs: displayJobs,
        allJobs: displayJobs,
        candidateProfile: response?.candidate_profile || null,
        searchLinks: Array.isArray(response?.search_links) ? response.search_links : [],
        summary: displayJobs.length
          ? `${displayJobs[0].title} at ${displayJobs[0].company} is the strongest match for your uploaded resume right now.${response?.inferred_role ? ` Inferred profile: ${response.inferred_role}.` : ""}`
          : "No relevant jobs found",
        careerPaths: Array.isArray(response?.career_paths) ? response.career_paths : [],
        skillsToLearn: Array.isArray(response?.skills_to_learn) ? response.skills_to_learn : [],
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Job matching failed.");
    } finally {
      setLoading(false);
    }
  };

  const saveJob = (job) => {
    if (savedJobs.some((item) => item.id === job.id)) {
      setNotice(`${job.title} is already saved in your tracker.`);
      return;
    }

    const updated = [
      ...savedJobs,
      {
        ...job,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "Saved",
        notes: job.notes || "",
        savedFrom: job.source || "Recommended",
      },
    ];
    setSavedJobs(updated);
    localStorage.setItem("resumeai_saved_jobs", JSON.stringify(updated));
    setNotice(`${job.title} was added to your dashboard tracker.`);
    logJobAction(job, "save");
  };

  const bestMatch = visibleJobs?.[0];

  const trackerStats = useMemo(() => {
    const stats = savedJobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (job.status === "Applied") acc.applied += 1;
        if (job.status === "Interviewing") acc.interviewing += 1;
        if (job.status === "Offer") acc.offer += 1;
        if (job.status === "Rejected") acc.rejected += 1;
        return acc;
      },
      { total: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 }
    );
    return stats;
  }, [savedJobs]);

  const groupedMatches = useMemo(() => {
    if (!visibleJobs.length) return [];
    return tierSections
      .map((section) => ({
        ...section,
        jobs: visibleJobs.filter((job) => job.valueTier === section.key),
      }))
      .filter((section) => section.jobs.length);
  }, [visibleJobs]);

  const loadingSkeletons = Array.from({ length: 3 }, (_, index) => index);

  const logJobAction = async (job, action) => {
    try {
      await api.matchFeedback({
        jobId: job.id,
        action,
        score: job.recommendationScore || job.match || 0,
        filters,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        source: job.source || "Recommended",
      });
    } catch {
      // Keep the core job action responsive even if analytics logging fails.
    }
  };

  const prepareInterview = (job) => {
    localStorage.setItem(
      "resumeai_interview_prefill",
      JSON.stringify({
        jd: job.description || "",
        role: job.title || job.track || "Target role",
        company: job.company || "Any",
        source: "job-matcher",
        createdAt: new Date().toISOString(),
      })
    );
    window.location.href = "/interview";
  };

  const openAnalyzerForJob = (job) => {
    const context = {
      jobDescription: job.description || "",
      role: job.title || job.track || "Target role",
      company: job.company || "",
      source: "job-matcher",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("resumeai_match_context", JSON.stringify(context));
    window.location.href = "/analyzer";
  };

  const loadJobDescription = (job) => {
    setFilters((prev) => ({
      ...prev,
      jobDescription: job.description || `${job.title} at ${job.company}`,
    }));
    setNotice("Job description loaded into matcher input. Re-run to refresh matching with this role.");
  };

  const handleApplyNow = async (job) => {
    const destination = job.computedApplyLink || getApplyDestination(job);
    window.open(destination, "_blank", "noopener,noreferrer");
    setNotice(`Opened ${job.title} at ${job.company}. The action was added to your tracker.`);
    await logJobAction(job, "apply");
  };

  const updateSavedJobStatus = (jobId, status) => {
    const updated = savedJobs.map((item) =>
      item.id === jobId ? { ...item, status, updatedAt: new Date().toISOString() } : item
    );
    setSavedJobs(updated);
    localStorage.setItem("resumeai_saved_jobs", JSON.stringify(updated));
    setNotice(`Saved job status updated to ${status}.`);
    const found = updated.find((item) => item.id === jobId);
    if (found) logJobAction(found, `status:${status}`);
  };

  const updateSavedJobNotes = (jobId, notes) => {
    const updated = savedJobs.map((item) =>
      item.id === jobId ? { ...item, notes, updatedAt: new Date().toISOString() } : item
    );
    setSavedJobs(updated);
    localStorage.setItem("resumeai_saved_jobs", JSON.stringify(updated));
  };

  const removeSavedJob = (jobId) => {
    const updated = savedJobs.filter((item) => item.id !== jobId);
    setSavedJobs(updated);
    localStorage.setItem("resumeai_saved_jobs", JSON.stringify(updated));
    setNotice("Removed job from your tracker.");
  };

  return (
    <div className="jobs-theme-page space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="pill-primary">
            <span>🔍</span>
            <span>AI job intelligence</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Job Matcher</h1>
        <p className="text-lg text-slate-600">Find stronger roles, understand why they fit, and save them to your application tracker.</p>
      </div>

      <div className="card-elevated p-6 md:p-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Upload your resume</h3>
            <input id="job-matcher-input" type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label htmlFor="job-matcher-input" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-teal-400 hover:bg-teal-50">
              <span className="mb-3 text-5xl">📤</span>
              {file ? (
                <>
                  <p className="text-lg font-semibold text-slate-900">✓ {file.name}</p>
                  <p className="text-sm text-slate-600 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-900">Click to upload resume</p>
                  <p className="text-sm text-slate-600 mt-1">PDF format recommended</p>
                </>
              )}
            </label>
            {file && (
              <button onClick={() => setFile(null)} className="btn-ghost text-sm text-rose-600 hover:bg-rose-50">
                Remove file
              </button>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Refine your search</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="select" value={filters.track} onChange={(e) => setFilters((prev) => ({ ...prev, track: e.target.value }))}>
                {[
                  "All roles",
                  "AI / ML",
                  "Data / Analytics",
                  "Product / Strategy",
                  "Frontend + AI",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select className="select" value={filters.workMode} onChange={(e) => setFilters((prev) => ({ ...prev, workMode: e.target.value }))}>
                {["Any", "Remote", "Hybrid", "Onsite"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <input className="input" placeholder="Target role (e.g. Product Analyst)" value={filters.targetRole} onChange={(e) => setFilters((prev) => ({ ...prev, targetRole: e.target.value }))} />

              <select className="select" value={filters.experienceLevel} onChange={(e) => setFilters((prev) => ({ ...prev, experienceLevel: e.target.value }))}>
                {["Any", "Intern", "Entry", "Mid", "Senior", "Lead"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <input className="input" placeholder="Industry (e.g. Fintech, Healthcare)" value={filters.industry} onChange={(e) => setFilters((prev) => ({ ...prev, industry: e.target.value }))} />

              <input className="input" placeholder="Preferred city / mode" value={filters.location} onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))} />

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                Minimum salary: <span className="font-semibold">₹{filters.minSalary}L</span>
                <input type="range" min="5" max="24" value={filters.minSalary} onChange={(e) => setFilters((prev) => ({ ...prev, minSalary: Number(e.target.value) }))} className="mt-2 w-full" />
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
              <div className="font-semibold">AI recommendation</div>
              <div className="mt-1">Aim for roles where you can mention the platform redesign, AI workflow features, and product thinking together.</div>
            </div>

            <button onClick={handleMatch} disabled={!file || loading} className="btn-primary w-full">
              {loading ? "Finding matches..." : "Find matching jobs"}
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Use your job details</div>
          <textarea
            className="input mt-3 h-28 resize-none"
            placeholder="Paste the job description or role summary here to improve matching."
            value={filters.jobDescription}
            onChange={(e) => setFilters((prev) => ({ ...prev, jobDescription: e.target.value }))}
          />
          <div className="mt-3 text-slate-600">Matching against descriptions helps prioritize jobs that align with your actual target role and keywords.</div>
        </div>

        {error && <div className="alert-danger">{error}</div>}
        {notice && <div className="alert-success">{notice}</div>}
      </div>

      {!matches && !loading && (
        <div className="empty-state p-12 text-center space-y-4">
          <span className="text-6xl">💼</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">No matches yet</h3>
            <p className="text-slate-600 mt-1">Upload your resume to see AI-ranked opportunities and save them for later.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {loadingSkeletons.map((item) => (
            <div key={item} className="card-elevated p-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="skeleton-line h-7 w-2/3" />
                  <div className="skeleton-line h-4 w-full" />
                  <div className="skeleton-line h-4 w-5/6" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="skeleton-line h-8 w-24 ml-auto" />
                  <div className="skeleton-line h-4 w-32 ml-auto" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="skeleton-line h-20 w-full rounded-2xl" />
                <div className="skeleton-line h-20 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {matches && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="pill-primary">AI recruiter intelligence</div>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">A smarter, premium job discovery experience</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">Your resume is analyzed semantically to surface the strongest career opportunities, explain the fit, and surface the skills that matter next.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {visibleJobs.length} opportunities surfaced
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Matching intelligence</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Target role</div>
                    <div className="mt-1 text-sm text-slate-700">{filters.targetRole || "Any role"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Experience level</div>
                    <div className="mt-1 text-sm text-slate-700">{filters.experienceLevel}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Industry focus</div>
                    <div className="mt-1 text-sm text-slate-700">{filters.industry || "Any"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">JD matched</div>
                    <div className="mt-1 text-sm text-slate-700">{filters.jobDescription ? "Yes" : "No"}</div>
                  </div>
                </div>
                {matches.candidateProfile ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Extracted resume profile</div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                      <div><strong>Skills:</strong> {(matches.candidateProfile.skills || []).slice(0, 8).join(", ") || "Not detected"}</div>
                      <div><strong>Technical:</strong> {(matches.candidateProfile.technical_skills || matches.candidateProfile.technical_stack || []).slice(0, 8).join(", ") || "Not detected"}</div>
                      <div><strong>Soft skills:</strong> {(matches.candidateProfile.soft_skills || []).slice(0, 6).join(", ") || "Not detected"}</div>
                      <div><strong>Projects:</strong> {(matches.candidateProfile.projects || []).slice(0, 3).map((item) => item.name || item).join(", ") || "Not detected"}</div>
                      <div><strong>Education:</strong> {(matches.candidateProfile.education_entries || matches.candidateProfile.education || []).slice(0, 2).join(", ") || matches.candidateProfile.education_level || "Not detected"}</div>
                      <div><strong>Experience:</strong> {matches.candidateProfile.years_of_experience || 0} years • {matches.candidateProfile.career_level || "Career level not detected"}</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Career guidance</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(matches.careerPaths || []).map((path) => (
                    <span key={path} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm">{path}</span>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-sm font-semibold">Skills you should learn next</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(matches.skillsToLearn || []).map((skill) => (
                      <span key={skill} className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-100">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky top-24 z-20 rounded-[24px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Refine results</h3>
                <p className="text-sm text-slate-600">Fine-tune the list for your target role, work style, and salary expectations.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {['Highest Match', 'Newest Jobs', 'Highest Salary', 'Remote Jobs', 'Most Relevant'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              <input className="input" placeholder="Search skills" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
              <select className="select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <option value="Any">Any company</option>
                {companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
              <select className="select" value={employmentTypeFilter} onChange={(e) => setEmploymentTypeFilter(e.target.value)}>
                <option value="Any">Any employment type</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
              <select className="select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="Any">Any platform</option>
                {platformOptions.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
              <select className="select" value={postedWindow} onChange={(e) => setPostedWindow(e.target.value)}>
                <option value="Any">Any posted date</option>
                <option value="Last 7 days">Last 7 days</option>
                <option value="Last 30 days">Last 30 days</option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                Remote-only roles
              </label>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">Showing {visibleJobs.length} of {allJobs.length} results</span>
            </div>
          </div>

          {curatedSections.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-4">
              {curatedSections.map((section) => (
                <div key={section.key} className="rounded-[24px] border border-slate-200 bg-white/70 p-4 shadow-sm">
                  <div className="text-2xl">{section.icon}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{section.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{section.description}</div>
                  <div className="mt-3 space-y-2">
                    {section.jobs.slice(0, 2).map((job) => (
                      <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{job.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{job.company} • {job.recommendationScore}% fit</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!visibleJobs.length && (
            <div className="empty-state p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900">No relevant jobs found</h3>
              <p className="mt-2 text-slate-600">Adjust the filters or broaden the search to see more opportunities tailored to your resume.</p>
            </div>
          )}
          {matches.searchLinks?.length > 0 && (
            <div className="card-elevated p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">More matching job links</h3>
                  <p className="mt-1 text-sm text-slate-600">Open the same resume-based search on major job platforms.</p>
                </div>
                <span className="pill-secondary">{matches.searchLinks.length} platforms</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {matches.searchLinks.map((link) => (
                  <a
                    key={`${link.platform}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
                  >
                    {link.platform}
                    <span className="mt-1 block text-xs font-normal text-slate-500">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {bestMatch && (
            <div className="card-elevated overflow-hidden bg-gradient-to-r from-teal-600 to-indigo-600 p-6 text-white">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] items-center">
                <div>
                  <div className="text-sm font-semibold text-teal-50">Top recommendation</div>
                  <h2 className="mt-2 text-3xl font-bold">{bestMatch.title} • {bestMatch.company}</h2>
                  <p className="mt-2 text-sm text-teal-50">{matches.summary}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
                  <div className="font-semibold">Why it fits</div>
                  <div className="mt-2 space-y-1">
                    {bestMatch.highlights.map((item) => (
                      <div key={item}>• {item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="card-elevated p-4 text-center">
                <div className="text-3xl font-bold text-teal-600">{stats.strongMatches}</div>
                <div className="text-sm text-slate-600 mt-1">Strong matches</div>
              </div>
              <div className="card-elevated p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">{stats.avgMatch}%</div>
                <div className="text-sm text-slate-600 mt-1">Avg match rate</div>
              </div>
              <div className="card-elevated p-4 text-center">
                <div className="text-3xl font-bold text-green-600">₹{stats.bestSalary}L+</div>
                <div className="text-sm text-slate-600 mt-1">Top salary band</div>
              </div>
              <div className="card-elevated p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{savedJobs.length}</div>
                <div className="text-sm text-slate-600 mt-1">Saved to tracker</div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {groupedMatches.map((section) => (
              <div key={section.key} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{section.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{section.desc}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        {section.jobs.length} {section.jobs.length === 1 ? "job" : "jobs"} found
                      </p>
                    </div>
                    <div className="pill-secondary">{section.jobs.length} jobs</div>
                  </div>
                </div>

                {section.jobs.map((job) => {
                  const alreadySaved = savedJobs.some((item) => item.id === job.id);
                  return (
                    <div key={job.id} className="card-elevated p-6 space-y-4 hover:shadow-lg transition">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                            <span className={(job.recommendationScore || job.match) >= 85 ? "badge-success" : "badge-warning"}>{job.fitType}</span>
                            <span className="badge-accent">Match score: {job.recommendationScore}%</span>
                            {job.valueTier ? <span className="badge-secondary">{job.valueTier}</span> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <div>💼 {job.company}</div>
                            <div>📍 {job.location}</div>
                            <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${getWorkModeTone(job.workMode)}`}>🏡 {job.workMode}</div>
                            <div>💰 {job.salary}</div>
                            <div>🧭 Exp: {job.experienceRequired}</div>
                            <div>🔗 via {job.source}</div>
                            <div>🗓 Posted: {job.posted}</div>
                          </div>
                          <p className="text-slate-700">{job.description}</p>
                          <p className="text-xs text-slate-500">Recommendation confidence: {job.recommendationConfidence}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                          <div className="text-3xl font-bold text-teal-600">₹{job.salaryMin}L+</div>
                          <div className="text-xs text-slate-600">Package rank #{job.packageRank || "—"}</div>
                          <div className="mt-1 text-xs text-slate-500">Relevance: {job.recommendationScore}%</div>
                          <div className="mt-1 text-xs text-slate-500">Interview probability: {job.interviewProb}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getEmploymentTone(job.employmentType || job.workMode || "")}`}>{job.employmentType || "Full-Time"}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getWorkModeTone(job.workMode)}`}>{job.workMode}</span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Matched skills</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {job.skills.map((skill) => (
                              <span key={skill} className="pill-primary">{skill}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">AI gap to close</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {job.missing.length ? job.missing.map((skill) => (
                              <span key={skill} className="pill-warning">{skill}</span>
                            )) : <span className="text-sm text-slate-500">No major missing skills detected.</span>}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">Why recommended</div>
                        {job.whyRecommended ? <p className="mt-2">{job.whyRecommended}</p> : null}
                        <div className="mt-2 space-y-1">
                          {job.highlights.map((item) => (
                            <div key={item}>• {item}</div>
                          ))}
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-5">
                          {[
                            ["Skills", job.matchBreakdown.skill_match],
                            ["Projects", job.matchBreakdown.project_relevance],
                            ["Education", job.matchBreakdown.education_match],
                            ["Experience", job.matchBreakdown.experience_match],
                            ["Location", job.matchBreakdown.location_match],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-200 bg-white p-2 text-center">
                              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
                              <div className="mt-1 font-semibold text-slate-900">{Number.isFinite(Number(value)) ? `${value}%` : "—"}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div><strong>Relevant projects:</strong> {job.relevantProjects.length ? job.relevantProjects.join(", ") : "Not detected"}</div>
                          <div><strong>Career growth:</strong> {job.careerGrowthPotential}</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Apply link: {job.applyLink}</div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">Resume action tips</div>
                        <div className="mt-2 space-y-2">
                          {getResumeActionTips(job).map((tip) => (
                            <div key={tip}>• {tip}</div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-1">
                        <button onClick={() => openAnalyzerForJob(job)} className="btn-primary">
                          Improve resume for this role
                        </button>
                        <button onClick={() => loadJobDescription(job)} className="btn-secondary">
                          Load JD into matcher
                        </button>
                        <button onClick={() => saveJob(job)} className="btn-secondary" disabled={alreadySaved}>
                          {alreadySaved ? "Saved to tracker" : "Save to tracker"}
                        </button>
                        <button onClick={() => prepareInterview(job)} className="btn-secondary">
                          Prep interview
                        </button>
                        <button onClick={() => handleApplyNow(job)} className="btn-accent">
                          Apply now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {savedJobs?.length > 0 && (
        <div className="card-elevated p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Application tracker</h2>
              <p className="mt-1 text-sm text-slate-600">Track saved roles, update status, and see progress from the jobs you care about.</p>
            </div>
            <button type="button" onClick={() => { setSavedJobs([]); localStorage.removeItem("resumeai_saved_jobs"); setNotice("Cleared saved tracker."); }} className="btn-secondary">
              Clear tracker
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm">
              <div className="font-semibold text-slate-900">Saved</div>
              <div className="mt-2 text-2xl font-bold text-teal-600">{trackerStats.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm">
              <div className="font-semibold text-slate-900">Applied</div>
              <div className="mt-2 text-2xl font-bold text-indigo-600">{trackerStats.applied}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm">
              <div className="font-semibold text-slate-900">Interviewing</div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{trackerStats.interviewing}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm">
              <div className="font-semibold text-slate-900">Offers</div>
              <div className="mt-2 text-2xl font-bold text-purple-600">{trackerStats.offer}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm">
              <div className="font-semibold text-slate-900">Rejected</div>
              <div className="mt-2 text-2xl font-bold text-rose-600">{trackerStats.rejected}</div>
            </div>
          </div>
          <div className="grid gap-4">
            {savedJobs.map((job) => (
              <div key={job.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-slate-900">{job.title} • {job.company}</div>
                    <div className="text-sm text-slate-600">{job.location} • {job.workMode} • {job.salary}</div>
                    <div className="text-sm text-slate-500">Saved: {new Date(job.savedAt).toLocaleDateString()}</div>
                    {job.savedFrom ? <div className="text-xs text-slate-500">Source: {job.savedFrom}</div> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="select" value={job.status || "Saved"} onChange={(e) => updateSavedJobStatus(job.id, e.target.value)}>
                      {["Saved", "Applied", "Interviewing", "Offer", "Rejected"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => handleApplyNow(job)} className="btn-accent">Open listing</button>
                    <button type="button" onClick={() => removeSavedJob(job.id)} className="btn-ghost text-rose-600">Remove</button>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-semibold text-slate-900">Tracker notes</label>
                  <textarea
                    className="input mt-2 h-24 w-full resize-y"
                    placeholder="Add role-specific reminders, follow-up details, or resume changes."
                    value={job.notes || ""}
                    onChange={(e) => updateSavedJobNotes(job.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
