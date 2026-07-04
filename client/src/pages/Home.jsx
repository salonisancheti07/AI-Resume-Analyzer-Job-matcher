import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../auth";
import { api } from "../api";

const featureCards = [
  { icon: "📊", title: "ATS Score Analysis", desc: "See exactly how recruiters and ATS systems read your resume." },
  { icon: "🧠", title: "AI Job Matching", desc: "Get role-fit scores, recruiter signals, and interview probability insights." },
  { icon: "✨", title: "Bullet Rewriter", desc: "Turn generic bullets into quantified, high-impact achievements." },
  { icon: "🎯", title: "Skill Gap Planner", desc: "Surface missing skills and build a realistic learning sprint." },
  { icon: "💼", title: "Application Tracker", desc: "Save strong matches and move them into a clean application pipeline." },
  { icon: "🎤", title: "Interview Copilot", desc: "Practice responses and get AI-backed confidence feedback." },
  { icon: "🧾", title: "Resume Templates", desc: "Choose student-focused resume layouts that are optimized for ATS and internships." },
  { icon: "🧪", title: "AI Studio", desc: "Showcase your growth plan, recruiter keywords, and premium AI features." },
];

const workflow = [
  { step: "01", title: "Upload resume", desc: "Start with PDF parsing, ATS checks, and semantic skill extraction." },
  { step: "02", title: "Match to roles", desc: "Compare your profile against jobs, expectations, and missing capabilities." },
  { step: "03", title: "Improve faster", desc: "Use rewrite suggestions, gap plans, and career guidance in one place." },
  { step: "04", title: "Track progress", desc: "Save opportunities, monitor readiness, and build resume-worthy proof." },
];

const aiStack = [
  "Resume parsing + NLP",
  "Semantic similarity scoring",
  "Explainable ATS breakdown",
  "Predictive job-fit insights",
  "Career roadmap recommendations",
  "Recruiter-friendly analytics",
];

const personaPlaybooks = {
  "Students & Freshers": {
    title: "Build a sharp first impression",
    copy: "Highlight projects, quantify outcomes, and discover the fastest skills to learn for internships and entry-level roles.",
    points: ["ATS-safe formatting", "Project bullet rewrites", "Interview prep starter kit"],
  },
  "Developers": {
    title: "Position yourself for better tech roles",
    copy: "Map your engineering experience to high-demand keywords, stronger impact metrics, and better-fit openings.",
    points: ["Tech stack gap analysis", "Remote and salary-friendly roles", "AI/ML portfolio suggestions"],
  },
  "Career Switchers": {
    title: "Reduce uncertainty during transition",
    copy: "Get a practical learning sequence, recruiter-facing narrative, and next-best actions for a confident switch.",
    points: ["Roadmap by target role", "Resume narrative alignment", "Confidence-building guidance"],
  },
};

export default function Home({ authReady = false, isAuthenticated = false, currentUser = null }) {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [persona, setPersona] = useState("Students & Freshers");
  const [previewNotice, setPreviewNotice] = useState("");
  const isAuthed = authReady && isAuthenticated;

  const activePersona = useMemo(() => personaPlaybooks[persona], [persona]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout transport errors and clear the local session anyway.
    }
    auth.clear();
    window.location.href = "/login";
  };

  const handlePreview = () => {
    setPreviewNotice(
      file
        ? "Nice start — continue with sign up, login, Google, or GitHub to unlock full ATS analysis and AI matching."
        : "Upload a resume and continue with sign up or login to unlock the full AI workflow."
    );
  };

  return (
    <div className="space-y-16 pb-10">
      <section className="card-elevated overflow-hidden bg-hero p-6 md:p-8 lg:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="pill-primary">🚀 AI-powered resume, job, and career command center</div>
            <div>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight text-slate-900">
                Make your resume <span className="text-gradient">resume-worthy</span> too
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                This platform now looks and feels like a premium AI product: cleaner frontend, richer UX, and more
                features you can confidently mention in your resume and portfolio.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "ATS uplift", value: "+89%" },
                { label: "Job-fit clarity", value: "92/100" },
                { label: "AI modules", value: "10+" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-soft">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {isAuthed ? (
                <>
                  <Link to="/dashboard" className="btn-primary btn-lg">Open dashboard</Link>
                  <button type="button" onClick={handleLogout} className="btn-secondary btn-lg">Use different account</button>
                </>
              ) : (
                <>
                  <Link to="/signup" className="btn-primary btn-lg">Create new account</Link>
                  <Link to="/login" className="btn-secondary btn-lg">Login</Link>
                </>
              )}
            </div>

            <div className="text-sm text-slate-600">
              {isAuthed ? (
                <>
                  Signed in as <span className="font-semibold text-slate-800">{currentUser?.name || currentUser?.email || "user"}</span>. Open the dashboard or sign out to use another account.
                </>
              ) : (
                <>
                  You can continue with <span className="font-semibold text-slate-800">email, Google, or GitHub</span> from the auth pages. The dashboard opens only after login.
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="pill-success">✓ No credit card</span>
              <span className="pill-success">✓ AI-ready portfolio project</span>
              <span className="pill-success">✓ Recruiter-friendly outputs</span>
            </div>
          </div>

          <div className="card p-6 shadow-hard">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Quick AI preview</div>
                <div className="text-xs text-slate-500">Simulate the product experience</div>
              </div>
              <span className="badge-primary">Live UX</span>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Upload resume</label>
                <input id="home-file" type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="home-file" className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 transition hover:border-teal-400 hover:bg-teal-50">
                  {file ? `✓ ${file.name}` : "Click to upload a PDF resume"}
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Target job description</label>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Paste a role description to see AI matching and gap analysis..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-teal-600">84</div>
                  <div className="text-xs text-slate-500">ATS score</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-indigo-600">91%</div>
                  <div className="text-xs text-slate-500">Match rate</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-amber-600">6</div>
                  <div className="text-xs text-slate-500">AI actions</div>
                </div>
              </div>

              <button onClick={handlePreview} className="btn-primary w-full">Preview AI workflow</button>
              {previewNotice && <div className="alert-info">{previewNotice}</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-slate-900">More premium features, more portfolio value</h2>
          <p className="mt-2 text-lg text-slate-600">The product now feels fuller, smarter, and more ready to showcase.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => (
            <div key={feature.title} className="card-elevated p-5 space-y-3">
              <div className="text-3xl">{feature.icon}</div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card-elevated p-6">
          <div className="pill-secondary">🎯 Personalized recommendations</div>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Built for different candidate journeys</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.keys(personaPlaybooks).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPersona(item)}
                className={persona === item ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xl font-semibold text-slate-900">{activePersona.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{activePersona.copy}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {activePersona.points.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="pill-primary">🧠 AI / ML engine</div>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Why this project stands out technically</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {aiStack.map((item) => (
              <span key={item} className="pill-primary">{item}</span>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {workflow.map((item) => (
              <div key={item.step} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-teal-600">Step {item.step}</div>
                <div className="mt-1 font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-sm text-slate-600">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card-elevated bg-gradient-to-br from-slate-950 to-slate-800 p-8 text-white">
        <div className="grid gap-4 md:grid-cols-4 text-center">
          {[
            { value: "10K+", label: "Resumes analyzed" },
            { value: "3.2x", label: "Interview callbacks" },
            { value: "24/7", label: "AI guidance" },
            { value: "1", label: "All-in-one platform" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-4xl font-bold text-teal-400">{item.value}</div>
              <div className="mt-2 text-sm text-slate-300">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-elevated bg-gradient-to-r from-teal-600 to-indigo-600 p-8 text-center text-white md:p-12">
        <h2 className="text-4xl font-bold">Ready to ship a stronger project?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-teal-50">
          Use the upgraded dashboard, AI Studio, job matcher, and skill planner to make this project a real resume highlight.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/signup" className="btn-primary bg-white text-teal-700">Create account</a>
          <a href="/login" className="btn-secondary border-white text-white hover:bg-white/10">Sign in</a>
        </div>
      </section>
    </div>
  );
}
