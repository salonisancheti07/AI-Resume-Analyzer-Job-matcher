import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function SummaryCard({ title, value, hint, tone }) {
  return (
    <div className={`card p-4 bg-gradient-to-br ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{hint}</div>
    </div>
  );
}

function ScorePill({ score }) {
  const value = Math.round((score || 0) * 100);
  const tone = value >= 85 ? "bg-emerald-100 text-emerald-800" : value >= 75 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <span className={`pill ${tone} border-transparent`}>{value}% match</span>;
}

function buildClientSkillHeatmap(candidates = []) {
  const map = new Map();
  candidates.forEach((candidate) => {
    (candidate.skills || []).forEach((skill) => {
      map.set(skill, (map.get(skill) || 0) + 1);
    });
  });
  return Array.from(map.entries())
    .map(([skill, count]) => ({
      skill,
      count,
      intensity: Math.min(100, count * 25),
    }))
    .sort((a, b) => b.count - a.count);
}

function PipelineBadge({ label, value, tone }) {
  return (
    <div className={`rounded-3xl border p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

export default function RecruiterDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [shortlistedIds, setShortlistedIds] = useState([]);
  const [compareIds, setCompareIds] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [jdForm, setJdForm] = useState({ title: "", jobDescription: "" });
  const [jdSaving, setJdSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ candidateId: "", stage: "Recruiter Screen", slot: "" });
  const [noteForm, setNoteForm] = useState({ candidateId: "", note: "", rating: "Strong yes" });
  const [notes, setNotes] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.recruiterDashboard();
        setData(res);
        setNotes(res.notes || []);
        setJdForm({
          title: res.activeJobDescription?.title || "",
          jobDescription: res.activeJobDescription?.text || "",
        });
        setShortlistedIds((res.candidates || []).filter((candidate) => candidate.shortlist).map((candidate) => candidate.candidateId));
      } catch (e) {
        setError(e.message || "Failed to load recruiter dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const candidates = useMemo(() => data?.candidates || [], [data]);
  const roleOptions = useMemo(() => ["All", ...new Set(candidates.map((candidate) => candidate.role))], [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const haystack = `${candidate.name} ${candidate.role} ${candidate.location} ${candidate.skills.join(" ")}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesRole = selectedRole === "All" || candidate.role === selectedRole;
      return matchesQuery && matchesRole;
    });
  }, [candidates, query, selectedRole]);

  const comparisonCandidates = useMemo(
    () => candidates.filter((candidate) => compareIds.includes(candidate.candidateId)).slice(0, 3),
    [candidates, compareIds]
  );
  const topCandidates = useMemo(() => data?.topCandidates || [], [data]);
  const urgentReviews = useMemo(() => data?.urgentReviews || [], [data]);

  const activeCandidateId = noteForm.candidateId || filteredCandidates[0]?.candidateId || candidates[0]?.candidateId || "";

  const toggleShortlist = async (candidateId) => {
    const next = shortlistedIds.includes(candidateId)
      ? shortlistedIds.filter((id) => id !== candidateId)
      : [...shortlistedIds, candidateId];
    setShortlistedIds(next);
    try {
      await api.recruiterShortlist(next);
      setSaveMessage("Shortlist updated.");
    } catch (e) {
      setSaveMessage(e.message || "Failed to save shortlist.");
    }
  };

  const toggleCompare = (candidateId) => {
    setCompareIds((current) => {
      if (current.includes(candidateId)) return current.filter((id) => id !== candidateId);
      if (current.length >= 3) return [...current.slice(1), candidateId];
      return [...current, candidateId];
    });
  };

  const handleBulkUpload = async () => {
    if (!uploadedFiles.length) return;
    const form = new FormData();
    uploadedFiles.forEach((file) => form.append("files", file));
    form.append("title", jdForm.title);
    form.append("jobDescription", jdForm.jobDescription);
    try {
      setUploading(true);
      const res = await api.recruiterUploadCandidates(form);
      setData((current) => {
        const updatedCandidates = [...(current?.candidates || []), ...(res.candidates || [])];
        const averageScore = updatedCandidates.length
          ? Math.round((updatedCandidates.reduce((sum, item) => sum + (item.score || 0), 0) / updatedCandidates.length) * 100)
          : 0;
        return {
          ...current,
          candidates: updatedCandidates,
          summary: {
            ...(current?.summary || {}),
            totalCandidates: updatedCandidates.length,
            averageScore,
          },
          activeJobDescription: res.jdProfile || current?.activeJobDescription,
          skillHeatmap: buildClientSkillHeatmap(updatedCandidates),
        };
      });
      setSaveMessage(`${res.ingested || 0} resumes analyzed against ${res.jdProfile?.title || "the active JD"}.`);
      setUploadedFiles([]);
    } catch (e) {
      setSaveMessage(e.message || "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveJD = async () => {
    if (!jdForm.title.trim() && !jdForm.jobDescription.trim()) return;
    try {
      setJdSaving(true);
      const res = await api.recruiterUploadJD(jdForm);
      setData((current) => ({
        ...current,
        activeJobDescription: res.profile,
      }));
      setSaveMessage(`Active hiring brief updated to ${res.profile?.title || "the selected role"}.`);
    } catch (e) {
      setSaveMessage(e.message || "Saving job description failed.");
    } finally {
      setJdSaving(false);
    }
  };

  const handleSchedule = async () => {
    const candidate = candidates.find((item) => item.candidateId === scheduleForm.candidateId);
    if (!candidate || !scheduleForm.slot) return;
    try {
      const res = await api.recruiterSchedule({
        candidateId: candidate.candidateId,
        candidate: candidate.name,
        stage: scheduleForm.stage,
        slot: scheduleForm.slot,
      });
      setData((current) => ({
        ...current,
        interviewSchedule: [res.scheduled, ...(current?.interviewSchedule || [])],
      }));
      setSaveMessage("Interview scheduled.");
    } catch (e) {
      setSaveMessage(e.message || "Scheduling failed.");
    }
  };

  const handleSaveNote = async () => {
    if (!noteForm.candidateId || !noteForm.note.trim()) return;
    try {
      const res = await api.recruiterSaveNote(noteForm);
      setNotes((current) => [res.note, ...current]);
      setNoteForm((current) => ({ ...current, note: "" }));
      setSaveMessage("Recruiter note saved.");
    } catch (e) {
      setSaveMessage(e.message || "Saving note failed.");
    }
  };

  return (
    <div className="recruiter-theme-page mx-auto max-w-7xl space-y-6">
      <section className="recruiter-dark-keep card relative overflow-hidden p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 text-white border-slate-800">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="pill bg-white/10 text-white border-white/10">Recruiter command center</div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Recruiter Dashboard</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Search candidates, rank resumes, shortlist top talent, compare profiles side by side, and manage interview flow from one premium hiring workspace.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Candidate Search System</div>
                <div className="mt-2 text-sm text-slate-300">Filter by role, skill, and location in one view.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Resume Ranking AI</div>
                <div className="mt-2 text-sm text-slate-300">See fit score, gaps, and hiring recommendation instantly.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Notes + Scheduling</div>
                <div className="mt-2 text-sm text-slate-300">Move from review to interview without leaving the page.</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Active hiring brief</div>
            <input
              className="input mt-3 bg-white/90 text-slate-900"
              value={jdForm.title}
              onChange={(e) => setJdForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Job title, for example ML Engineer"
            />
            <textarea
              className="input mt-3 min-h-[120px] bg-white/90 text-slate-900"
              rows={5}
              value={jdForm.jobDescription}
              onChange={(e) => setJdForm((current) => ({ ...current, jobDescription: e.target.value }))}
              placeholder="Paste the job description recruiters are hiring for..."
            />
            <button className="btn-secondary mt-3 w-full" type="button" onClick={handleSaveJD} disabled={jdSaving}>
              {jdSaving ? "Saving JD..." : "Set Active Job Description"}
            </button>
            <div className="text-sm font-semibold text-white">Bulk Resume Upload & Analysis</div>
            <div className="mt-2 text-sm text-slate-300">Upload multiple resume files and rank them against the active job description.</div>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))}
              className="mt-4 text-sm text-slate-200"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <span key={file.name} className="pill bg-white/10 text-white border-white/10">
                  {file.name}
                </span>
              ))}
            </div>
            <button className="btn-primary mt-5 w-full" type="button" onClick={handleBulkUpload} disabled={uploading || !uploadedFiles.length}>
              {uploading ? "Analyzing resumes..." : "Analyze Uploaded Resumes"}
            </button>
            {saveMessage && <div className="mt-3 text-sm text-teal-100">{saveMessage}</div>}
          </div>
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">Loading recruiter dashboard...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="Candidates" value={data.summary?.totalCandidates || 0} hint="Profiles currently in your pipeline" tone="from-sky-50 to-white border-sky-100" />
            <SummaryCard title="Shortlisted" value={shortlistedIds.length} hint="Profiles marked for fast follow-up" tone="from-emerald-50 to-white border-emerald-100" />
            <SummaryCard title="Avg Match" value={`${data.summary?.averageScore || 0}%`} hint={`Ranked against ${data.activeJobDescription?.title || "the active JD"}`} tone="from-amber-50 to-white border-amber-100" />
            <SummaryCard title="Interviews" value={data.summary?.interviewsThisWeek || 0} hint="Scheduled interview loops this week" tone="from-rose-50 to-white border-rose-100" />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Pipeline overview</div>
                  <div className="text-sm text-slate-500">See where the recruiting queue is healthy and where manual review is still needed.</div>
                </div>
                <div className="pill bg-slate-100 text-slate-700">{data.activeJobDescription?.title || "No active JD"}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <PipelineBadge label="Ready to shortlist" value={data.pipelineBreakdown?.readyToShortlist || 0} tone="border-emerald-100 bg-emerald-50" />
                <PipelineBadge label="Recruiter screen" value={data.pipelineBreakdown?.recruiterScreen || 0} tone="border-amber-100 bg-amber-50" />
                <PipelineBadge label="Deep review" value={data.pipelineBreakdown?.deepReview || 0} tone="border-rose-100 bg-rose-50" />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Next recruiter actions</div>
                <div className="mt-3 grid gap-2">
                  {(data.nextActions || []).map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div className="text-lg font-semibold text-slate-900">Fast-lane candidates</div>
              <div className="space-y-3">
                {topCandidates.slice(0, 4).map((candidate) => (
                  <div key={candidate.candidateId} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{candidate.name}</div>
                        <div className="text-sm text-slate-500">{candidate.role} • {candidate.status}</div>
                      </div>
                      <ScorePill score={candidate.score} />
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{candidate.recommendation}</div>
                  </div>
                ))}
                {!topCandidates.length && <div className="text-sm text-slate-500">Top-ranked candidates will appear here after resume analysis.</div>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Candidate Search System</div>
                  <div className="text-sm text-slate-500">Search by name, role, location, or skill. Current ranking target: {data.activeJobDescription?.title || "general hiring"}.</div>
                </div>
                <div className="pill bg-slate-100 text-slate-700">{filteredCandidates.length} visible</div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates, skills, locations..." />
                <select className="input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {filteredCandidates.map((candidate) => (
                  <div key={candidate.candidateId} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-slate-900">{candidate.name}</div>
                          <ScorePill score={candidate.score} />
                        </div>
                        <div className="text-sm text-slate-500">
                          {candidate.role} • {candidate.location} • {candidate.experience}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {candidate.skills.map((skill) => (
                            <span key={skill} className="pill">
                              {skill}
                            </span>
                          ))}
                        </div>
                        <div className="text-sm text-slate-600">AI recommendation: {candidate.recommendation}</div>
                        {!!candidate.matchedSkills?.length && (
                          <div className="text-sm text-emerald-700">Matched to JD: {candidate.matchedSkills.join(", ")}</div>
                        )}
                        <div className="text-sm text-slate-500">Gaps: {candidate.gaps.join(", ") || "None"}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button className="btn-secondary text-sm" type="button" onClick={() => toggleShortlist(candidate.candidateId)}>
                          {shortlistedIds.includes(candidate.candidateId) ? "Remove shortlist" : "Shortlist"}
                        </button>
                        <button className="btn-secondary text-sm" type="button" onClick={() => toggleCompare(candidate.candidateId)}>
                          {compareIds.includes(candidate.candidateId) ? "Remove compare" : "Compare"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                <div className="text-lg font-semibold text-slate-900">AI Hiring Recommendation</div>
                <div className="mt-4 space-y-3">
                  {data.hiringRecommendations?.map((item, index) => (
                    <div key={index} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5 bg-gradient-to-br from-rose-50 to-white border-rose-100">
                <div className="text-lg font-semibold text-slate-900">Needs Attention</div>
                <div className="mt-4 space-y-3">
                  {urgentReviews.length ? urgentReviews.map((candidate) => (
                    <div key={candidate.candidateId} className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{candidate.name}</div>
                      <div className="mt-1 text-slate-500">{candidate.role} • {Math.round((candidate.score || 0) * 100)}% match</div>
                      <div className="mt-2 text-rose-700">Check: {candidate.gaps?.join(", ") || "profile depth and proof"}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-slate-500">No urgent review candidates right now.</div>}
                </div>
              </div>

              <div className="card p-5 bg-gradient-to-br from-sky-50 to-white border-sky-100">
                <div className="text-lg font-semibold text-slate-900">Interview Scheduling System</div>
                <div className="mt-4 space-y-3">
                  <select
                    className="input"
                    value={scheduleForm.candidateId}
                    onChange={(e) => setScheduleForm((current) => ({ ...current, candidateId: e.target.value }))}
                  >
                    <option value="">Select candidate</option>
                    {candidates.map((candidate) => (
                      <option key={candidate.candidateId} value={candidate.candidateId}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={scheduleForm.stage}
                    onChange={(e) => setScheduleForm((current) => ({ ...current, stage: e.target.value }))}
                  >
                    <option>Recruiter Screen</option>
                    <option>Technical Round</option>
                    <option>Hiring Manager</option>
                    <option>Final Round</option>
                  </select>
                  <input
                    className="input"
                    type="datetime-local"
                    value={scheduleForm.slot}
                    onChange={(e) => setScheduleForm((current) => ({ ...current, slot: e.target.value }))}
                  />
                  <button className="btn-primary w-full" type="button" onClick={handleSchedule}>
                    Schedule Interview
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {(data.interviewSchedule || []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{item.candidate}</div>
                      <div>
                        {item.stage} • {item.slot}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="card p-5 space-y-4">
              <div className="text-lg font-semibold text-slate-900">Candidate Skill Heatmap</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.skillHeatmap?.map((item) => (
                  <div
                    key={item.skill}
                    className="rounded-3xl border border-slate-200 p-4 text-center"
                    style={{ background: `linear-gradient(180deg, rgba(20,184,166,${Math.max(item.intensity / 140, 0.08)}), rgba(255,255,255,0.95))` }}
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.skill}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{item.count}</div>
                    <div className="text-xs text-slate-500">candidates</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Candidate Comparison Tool</div>
                  <div className="text-sm text-slate-500">Pick up to three profiles to compare side by side.</div>
                </div>
                <div className="pill bg-slate-100 text-slate-700">{comparisonCandidates.length}/3 selected</div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {comparisonCandidates.length ? (
                  comparisonCandidates.map((candidate) => (
                    <div key={candidate.candidateId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-base font-semibold text-slate-900">{candidate.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{candidate.role}</div>
                      <div className="mt-3">
                        <ScorePill score={candidate.score} />
                      </div>
                      <div className="mt-4 text-sm text-slate-600">Strengths: {candidate.strengths.join(", ")}</div>
                      <div className="mt-3 text-sm text-slate-500">Gaps: {candidate.gaps.join(", ") || "None"}</div>
                      <div className="mt-3 text-sm text-slate-500">Salary: {candidate.salary}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 md:col-span-3">Select candidates from the ranking panel to compare them here.</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="card p-5 space-y-4">
              <div className="text-lg font-semibold text-slate-900">Shortlisting Tool</div>
              <div className="space-y-3">
                {candidates
                  .filter((candidate) => shortlistedIds.includes(candidate.candidateId))
                  .map((candidate) => (
                    <div key={candidate.candidateId} className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{candidate.name}</div>
                          <div className="text-sm text-slate-500">
                            {candidate.role} • {candidate.status}
                          </div>
                        </div>
                        <ScorePill score={candidate.score} />
                      </div>
                    </div>
                  ))}
                {!shortlistedIds.length && <div className="text-sm text-slate-500">No candidates shortlisted yet.</div>}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div className="text-lg font-semibold text-slate-900">Notes & Feedback System</div>
              <div className="space-y-3">
                <select
                  className="input"
                  value={noteForm.candidateId || activeCandidateId}
                  onChange={(e) => setNoteForm((current) => ({ ...current, candidateId: e.target.value }))}
                >
                  <option value="">Select candidate</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.candidateId} value={candidate.candidateId}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={noteForm.rating}
                  onChange={(e) => setNoteForm((current) => ({ ...current, rating: e.target.value }))}
                >
                  <option>Strong yes</option>
                  <option>Yes</option>
                  <option>Maybe</option>
                  <option>No</option>
                </select>
                <textarea
                  className="input min-h-[140px]"
                  value={noteForm.note}
                  onChange={(e) => setNoteForm((current) => ({ ...current, note: e.target.value }))}
                  placeholder="Capture recruiter notes, interview feedback, and next-step context..."
                />
                <button className="btn-primary w-full" type="button" onClick={handleSaveNote}>
                  Save Note
                </button>
              </div>
              <div className="space-y-3">
                {notes.map((item) => {
                  const candidate = candidates.find((entry) => entry.candidateId === item.candidateId);
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {candidate?.name || "Candidate"} • {item.rating}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{item.note}</div>
                    </div>
                  );
                })}
                {!notes.length && <div className="text-sm text-slate-500">Saved recruiter notes will appear here.</div>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
