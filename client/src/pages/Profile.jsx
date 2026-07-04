import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";
import { useNavigate } from "react-router-dom";

const PROFILE_STORAGE_KEY = "profile_workspace";

const bar = (pct) => ({ width: `${Math.max(0, Math.min(100, pct || 0))}%` });

function readStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistProfile(payload) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
}

function MetricCard({ title, value, hint, icon, tone = "from-white to-slate-50" }) {
  return (
    <div className={`card-elevated bg-gradient-to-br ${tone} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{hint}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className="card-elevated p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ProgressRow({ label, value, target = 100 }) {
  const pct = Math.min(100, Math.round(((value || 0) / (target || 100)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}/{target}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoPill({ children, tone = "pill-primary" }) {
  return <span className={tone}>{children}</span>;
}

function mergeProfile(base, stored) {
  if (!stored) return base;
  return {
    ...base,
    user: {
      ...base.user,
      ...(stored.user || {}),
    },
    resumes: stored.resumes || base.resumes,
    resumeEditor: {
      ...(base.resumeEditor || {}),
      ...(stored.resumeEditor || {}),
    },
    interests: stored.interests || base.interests,
    portfolio: stored.portfolio || base.portfolio,
    photo: stored.photo || "",
  };
}

function calculateProfileCompletion(data = {}) {
  if (!data || !data.user) return 0;
  const fields = [
    data.user.name,
    data.user.title,
    data.user.email,
    data.resumeEditor?.headline,
    data.resumeEditor?.summary,
    data.resumeEditor?.targetRole,
    (data.interests || []).length,
    (data.portfolio || []).length,
    (data.resumes || []).length,
  ];
  const filled = fields.reduce((acc, value) => acc + (value ? 1 : 0), 0);
  return Math.round((filled / fields.length) * 100);
}

export default function Profile() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuth = auth.isAuthed();

    (async () => {
      try {
        const res = await api.profile();
        const merged = mergeProfile(res, readStoredProfile());
        setData(merged);
        setDraft({
          name: merged.user.name || "",
          title: merged.user.title || "",
          headline: merged.resumeEditor?.headline || "",
          summary: merged.resumeEditor?.summary || "",
          targetRole: merged.resumeEditor?.targetRole || "",
          interests: (merged.interests || []).join(", "),
          portfolio: (merged.portfolio || []).join("\n"),
          photo: merged.photo || "",
        });

        if (!isAuth) {
          // In guest/demo mode, keep page visible and show helpful label.
          setError("");
        }
      } catch (e) {
        console.error("Profile load error:", e);
        if (e.message?.includes("Authentication") || e.message?.includes("401")) {
          // For private deployments, redirect to login in auth-required cases.
          if (isAuth) {
            auth.clear();
            navigate("/login");
            return;
          }
          // For demo mode fallback, continue with last-known data.
        }
        setError(e.message || "Failed to load profile");
      }
    })();
  }, [navigate]);

  const currentScore = useMemo(() => {
    const history = Array.isArray(data?.scoreHistory) ? data.scoreHistory : [];
    return history.length ? history[history.length - 1]?.ats || 0 : 0;
  }, [data]);

  const profileCompletion = useMemo(() => calculateProfileCompletion(data), [data]);
  const liveSavedJobs = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("resumeai_saved_jobs") || "[]");
      return Array.isArray(stored) && stored.length ? stored : data?.savedJobs || [];
    } catch {
      return data?.savedJobs || [];
    }
  }, [data]);

  const logout = () => {
    auth.clear();
    navigate("/login");
  };

  const beginEdit = () => {
    if (!data) return;
    setDraft({
      name: data.user.name || "",
      title: data.user.title || "",
      headline: data.resumeEditor?.headline || "",
      summary: data.resumeEditor?.summary || "",
      targetRole: data.resumeEditor?.targetRole || "",
      interests: (data.interests || []).join(", "),
      portfolio: (data.portfolio || []).join("\n"),
      photo: data.photo || "",
    });
    setEditing(true);
    setSaveMessage("");
  };

  const cancelEdit = () => {
    if (!data) return;
    setDraft({
      name: data.user.name || "",
      title: data.user.title || "",
      headline: data.resumeEditor?.headline || "",
      summary: data.resumeEditor?.summary || "",
      targetRole: data.resumeEditor?.targetRole || "",
      interests: (data.interests || []).join(", "),
      portfolio: (data.portfolio || []).join("\n"),
      photo: data.photo || "",
    });
    setEditing(false);
    setSaveMessage("Changes discarded.");
  };

  const saveProfile = () => {
    if (!data || !draft) return;
    const next = {
      ...data,
      user: {
        ...data.user,
        name: draft.name.trim() || data.user.name,
        title: draft.title.trim() || data.user.title,
      },
      resumeEditor: {
        ...(data.resumeEditor || {}),
        headline: draft.headline.trim(),
        summary: draft.summary.trim(),
        targetRole: draft.targetRole.trim(),
      },
      interests: draft.interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      portfolio: draft.portfolio
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      photo: draft.photo || "",
    };

    setData(next);
    persistProfile({
      user: next.user,
      resumeEditor: next.resumeEditor,
      interests: next.interests,
      portfolio: next.portfolio,
      resumes: next.resumes,
      photo: next.photo,
    });
    setEditing(false);
    setSaveMessage("Profile updated successfully.");
  };

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, photo: reader.result }));
      if (!editing) {
        setData((current) => {
          if (!current) return current;
          const next = { ...current, photo: reader.result };
          persistProfile({
            user: next.user,
            resumeEditor: next.resumeEditor,
            interests: next.interests,
            portfolio: next.portfolio,
            resumes: next.resumes,
            photo: next.photo,
          });
          return next;
        });
        setSaveMessage("Profile image updated.");
      }
    };
    reader.readAsDataURL(file);
  };

  const onResumeUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setData((current) => {
      if (!current) return current;
      const nextResumes = [...(current.resumes || []), file.name];
      const next = { ...current, resumes: nextResumes };
      persistProfile({
        user: next.user,
        resumeEditor: next.resumeEditor,
        interests: next.interests,
        portfolio: next.portfolio,
        resumes: next.resumes,
        photo: next.photo,
      });
      return next;
    });
    setSaveMessage("Resume uploaded to your profile list.");
  };

  if (error) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-rose-600 text-lg font-semibold mb-2">Error loading profile</p>
        <p className="text-slate-600">{error}</p>
        <button 
          className="mt-4 btn-primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
  if (!data || !draft) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading profile...</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="card-elevated profile-header-section overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-950 p-6 text-white md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <InfoPill tone="pill bg-white/10 text-white border-white/20">✨ Premium profile hub</InfoPill>
              <InfoPill tone="pill bg-emerald-500/15 text-emerald-100 border-emerald-300/20">{data?.careerInsights?.bestRole || "Best role"}</InfoPill>
            </div>

            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
              <div className="relative flex w-28 shrink-0 flex-col items-center sm:w-auto">
                <div className="h-20 w-20 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-hard md:h-24 md:w-24">
                  {(editing ? draft.photo : data.photo) ? (
                    <img src={editing ? draft.photo : data.photo} alt="profile" className="h-full w-full object-cover object-center" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                      {(data.user.name || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="profile-photo-button mt-2 rounded-full border border-white/20 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm sm:absolute sm:-bottom-2 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2"
                >
                  Change photo
                </button>
              </div>

              <div className="min-w-0 pt-1">
                <h1 className="text-2xl font-bold leading-tight text-white profile-text sm:text-3xl">{editing ? draft.name || "Your name" : data?.user?.name || "Your name"}</h1>
                <p className="mt-1 text-base text-slate-200 profile-text-muted">{editing ? draft.title || "Your title" : data?.user?.title || "Your title"}</p>
                <p className="mt-1 text-sm text-slate-300 profile-text-muted">{data?.user?.email || "your.email@example.com"}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {(data?.interests || []).slice(0, 4).map((item) => (
                    <InfoPill key={item} tone="pill bg-white/10 text-white border-white/10">{item}</InfoPill>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Profile headline</div>
              <div className="mt-2 text-lg font-semibold text-white">{(editing ? draft.headline : data.resumeEditor?.headline) || "Build a sharper personal brand with one clear, recruiter-friendly line."}</div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {(editing ? draft.summary : data.resumeEditor?.summary) || data.resumeSummary?.blurb}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Profile strength</span>
                <span>{data.careerInsights?.profileStrength || 0}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-300" style={bar(data?.careerInsights?.profileStrength || 0)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-100">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xs text-slate-300">Resume score</div>
                  <div className="mt-1 text-2xl font-bold">{currentScore}%</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xs text-slate-300">Weekly streak</div>
                  <div className="mt-1 text-2xl font-bold">{data?.momentum?.weeklyStreak || 0}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {!editing ? (
                <button className="btn-primary w-full" type="button" onClick={beginEdit}>Edit profile</button>
              ) : (
                <>
                  <button className="btn-primary w-full" type="button" onClick={saveProfile}>Save changes</button>
                  <button className="btn-secondary w-full border-white/20 bg-white/10 text-white hover:bg-white/15" type="button" onClick={cancelEdit}>Cancel</button>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15" type="button" onClick={() => resumeInputRef.current?.click()}>
                  Upload resume
                </button>
                <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15" type="button" onClick={logout}>
                  Logout
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              <input ref={resumeInputRef} type="file" className="hidden" onChange={onResumeUpload} />
            </div>
          </div>
        </div>
      </section>

      {saveMessage && <div className="alert-success">{saveMessage}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Target role" value={data.careerInsights?.bestRole || "Not set"} hint={`Salary signal: ${data.careerInsights?.salaryRange || "—"}`} icon="🎯" tone="from-white to-teal-50" />
        <MetricCard title="Saved jobs" value={liveSavedJobs.length || 0} hint="Opportunities tracked across the platform" icon="💼" tone="from-white to-indigo-50" />
        <MetricCard title="Applications" value={data.momentum?.applicationsThisWeek || 0} hint="Submitted this week" icon="📨" tone="from-white to-amber-50" />
        <MetricCard title="Interviews" value={data.momentum?.interviewsThisWeek || 0} hint="Active conversations this week" icon="🎤" tone="from-white to-emerald-50" />
        <MetricCard title="Profile completeness" value={`${profileCompletion}%`} hint="AI suggests at least 100% for best visibility" icon="✅" tone="from-white to-blue-50" />
      </section>

      <section className="card-elevated border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Quick action center</h2>
          <span className="text-sm text-slate-500">Complete these actions for faster hiring impact</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a href="/analyzer" className="btn-primary w-full justify-center">Analyze resume</a>
          <a href="/matcher" className="btn-secondary w-full justify-center">Match with jobs</a>
          <a href="/coach" className="btn-secondary w-full justify-center">Run coach sprint</a>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Career identity"
          subtitle="Make your profile look recruiter-ready with stronger role positioning, headline, summary, and personal brand details."
          action={<InfoPill tone="pill-secondary">Personal brand</InfoPill>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Name</div>
                {editing ? (
                  <input className="input" value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{data.user.name}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Title</div>
                {editing ? (
                  <input className="input" value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{data.user.title}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Headline</div>
                {editing ? (
                  <input className="input" value={draft.headline} onChange={(e) => setDraft((current) => ({ ...current, headline: e.target.value }))} placeholder="e.g. AI-focused full-stack developer building career tools" />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{data.resumeEditor?.headline || "—"}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Target role</div>
                {editing ? (
                  <input className="input" value={draft.targetRole} onChange={(e) => setDraft((current) => ({ ...current, targetRole: e.target.value }))} placeholder="ML Engineer / Data Scientist / AI Engineer" />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{data.resumeEditor?.targetRole || data.careerInsights?.bestRole || "—"}</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Professional summary</div>
                {editing ? (
                  <textarea className="input min-h-[150px]" value={draft.summary} onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">{data.resumeEditor?.summary || data.resumeSummary?.blurb || "—"}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Skills & interests</div>
                {editing ? (
                  <textarea className="input min-h-[100px]" value={draft.interests} onChange={(e) => setDraft((current) => ({ ...current, interests: e.target.value }))} placeholder="Comma-separated interests" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(data.interests || []).map((item) => (
                      <InfoPill key={item} tone="pill bg-slate-100 text-slate-700 border-slate-200">{item}</InfoPill>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Resume vault & quick launch"
          subtitle="Keep your resume versions organized and jump into the areas that move your profile forward fastest."
          action={<InfoPill>Resume workspace</InfoPill>}
        >
          <div className="space-y-3">
            {(data.resumes || []).map((resume, index) => (
              <div key={`${resume}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-medium text-slate-800">{resume}</span>
                {index === 0 ? <InfoPill>Primary</InfoPill> : <span className="text-slate-500">Saved</span>}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <a href="/analyzer" className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 hover:border-teal-300">
              Open analyzer →
            </a>
            <a href="/matcher" className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800 hover:border-indigo-300">
              Explore jobs →
            </a>
            <a href="/coach" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:border-amber-300">
              Career coach →
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Resume summary</div>
            <p className="mt-2 text-sm leading-7 text-slate-700">{data.resumeSummary?.blurb}</p>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Skill profile" subtitle="See where you are already strong and what the AI suggests you sharpen next.">
          <div className="space-y-4">
            {(data.skillProfile || []).map((skill) => (
              <div key={skill.skill}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{skill.skill}</span>
                  <span>{skill.score}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill-primary" style={bar(skill.score)} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">AI recommendations</div>
            <ul className="mt-3 list-disc pl-4 text-sm leading-7 text-slate-700">
              {(data.recommendations || []).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Opportunity radar" subtitle="A cleaner view of where to aim next based on role fit, market signals, and networking momentum.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Target companies</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data.opportunityRadar?.targetCompanies || []).map((company) => (
                  <InfoPill key={company} tone="pill bg-white text-slate-700 border-slate-200">{company}</InfoPill>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Next roles to pursue</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data.opportunityRadar?.nextRoles || []).map((role) => (
                  <InfoPill key={role}>{role}</InfoPill>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(data.marketSignals || []).map((signal) => (
              <div key={signal.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{signal.label}</span>
                  <span className="text-slate-500">{signal.value}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill-primary" style={bar(signal.value)} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{signal.note}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Hiring signals</div>
              <ul className="mt-2 list-disc pl-4 text-sm leading-6 text-slate-700">
                {(data.opportunityRadar?.hiringSignals || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Networking moves</div>
              <ul className="mt-2 list-disc pl-4 text-sm leading-6 text-slate-700">
                {(data.opportunityRadar?.networkingMoves || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Progress & weekly action plan" subtitle="Keep the profile actionable, not just informational.">
          <div className="space-y-4">
            {(data.progressTracking || []).map((item) => (
              <ProgressRow key={item.label} {...item} />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">This week’s action plan</div>
            <div className="mt-3 space-y-3">
              {(data.weeklyActionPlan || []).map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="flex gap-2">
                      <InfoPill tone="pill bg-amber-50 text-amber-700 border-amber-200">{item.effort}</InfoPill>
                      <InfoPill tone="pill bg-emerald-50 text-emerald-700 border-emerald-200">{item.impact} impact</InfoPill>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Activity, notifications, and momentum" subtitle="A more polished summary of what you have done lately and what needs attention next.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Strongest area</div>
              <div className="mt-2 text-base font-semibold text-slate-800">{data.momentum?.strongestArea || "Resume quality"}</div>
              <div className="mt-3 text-sm font-semibold text-slate-900">Weakest area</div>
              <div className="mt-2 text-sm text-slate-700">{data.momentum?.weakestArea || "Cloud deployment proof"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Coach prompts</div>
              <div className="mt-2 space-y-2">
                {(data.coachPrompts || []).map((prompt, index) => (
                  <div key={`${prompt}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(data.notificationsCenter || []).slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <InfoPill tone={item.priority === "high" ? "pill-danger" : "pill-warning"}>{item.priority}</InfoPill>
                </div>
                <div className="mt-1 text-sm text-slate-600">{item.message}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {(data.activity || []).map((item, index) => (
              <div key={`${item.date}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.date}</div>
                <div className="mt-1 text-sm text-slate-700">{item.action}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Portfolio links" subtitle="Share your best public proof.">
          {editing ? (
            <textarea className="input min-h-[170px]" value={draft.portfolio} onChange={(e) => setDraft((current) => ({ ...current, portfolio: e.target.value }))} placeholder="One link per line" />
          ) : (
            <div className="space-y-2">
              {(data.portfolio || []).map((link, index) => (
                <a key={`${link}-${index}`} href={link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-teal-700 hover:border-teal-300">
                  {link}
                </a>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Connected accounts" subtitle="Accounts linked to your job search profile.">
          <div className="flex flex-wrap gap-2">
            {(data.connectedAccounts || []).map((account) => (
              <InfoPill key={account}>{account}</InfoPill>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Preferences" subtitle="Your current communication and theme settings.">
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Job alerts</span><span>{data.preferences?.notifications?.jobAlerts ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Interview reminders</span><span>{data.preferences?.notifications?.interviewReminders ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Resume tips</span><span>{data.preferences?.notifications?.resumeTips ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Weekly report</span><span>{data.preferences?.notifications?.weeklyReport ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Theme</span><span className="capitalize">{data.preferences?.theme || "light"}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Security" subtitle="Privacy and account protection overview.">
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>MFA</span><span>{data.security?.mfa ? "Enabled" : "Disabled"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Last login</span><span>{data.security?.lastLogin || "—"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Recruiter view</span><span>{data.security?.privacy?.recruiterView ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Anonymized analytics</span><span>{data.security?.privacy?.anonymized ? "On" : "Off"}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Private mode</span><span>{data.security?.privacy?.privateMode ? "On" : "Off"}</span></div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Platform settings" subtitle="Quick access to site info, terms, privacy, and support.">
          <div className="space-y-2 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-900">App name</div>
              <div className="text-slate-600">ResumeAI Pro</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-900">Current version</div>
              <div className="text-slate-600">v1.0.0</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-900">Support channel</div>
              <div className="text-slate-600">support@resumeai.example</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-900">Legal</div>
              <div className="text-slate-600">Terms of Service · Privacy Policy</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-medium text-slate-900">Service status</div>
              <div className="text-slate-600">All systems operational</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Data & Privacy center" subtitle="Manage your data and account privacy settings.">
          <div className="space-y-3">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => alert("Data export initiated. You'll receive an email with your data shortly.")}
            >
              Download my data
            </button>
            <button
              type="button"
              className="btn-secondary w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              onClick={() => {
                if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                  alert("Account deletion requested. You'll receive a confirmation email.");
                }
              }}
            >
              Delete account
            </button>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
