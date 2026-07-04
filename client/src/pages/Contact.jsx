import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";

const channelCards = [
  {
    title: "General Contact",
    note: "Use this for support, collaborations, partnerships, or product questions.",
    tone: "from-sky-50 to-white border-sky-100",
  },
  {
    title: "Product Feedback",
    note: "Share ideas, UX issues, missing features, or product improvements.",
    tone: "from-emerald-50 to-white border-emerald-100",
  },
  {
    title: "Bug Report",
    note: "Report broken flows with page name, severity, and the exact behavior you saw.",
    tone: "from-rose-50 to-white border-rose-100",
  },
];

const resumeSupportIdeas = [
  "Resume rewrite review",
  "ATS optimization help",
  "Job-specific tailoring",
  "Project bullet improvement",
];

function StatusMessage({ text, tone = "text-emerald-700" }) {
  if (!text) return null;
  return <div className={`rounded-2xl border border-current/10 bg-[var(--app-surface)] px-4 py-3 text-sm ${tone}`}>{text}</div>;
}

function ThemedPanel({ children, accent = "rgba(14, 165, 233, 0.10)", border = "var(--app-border)" }) {
  return (
    <div
      className="card p-6"
      style={{
        background: `linear-gradient(180deg, ${accent}, var(--app-surface))`,
        borderColor: border,
      }}
    >
      {children}
    </div>
  );
}

export default function Contact() {
  const user = auth.getUser();
  const [contactForm, setContactForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    topic: "Resume review request",
    targetRole: "",
    timeline: "Within 2 weeks",
    subject: "",
    message: "",
  });
  const [feedbackForm, setFeedbackForm] = useState({
    email: user?.email || "",
    category: "Feature feedback",
    message: "",
  });
  const [bugForm, setBugForm] = useState({
    email: user?.email || "",
    page: "",
    severity: "Medium",
    details: "",
  });
  const [loading, setLoading] = useState({ contact: false, feedback: false, bug: false });
  const [status, setStatus] = useState({ contact: "", feedback: "", bug: "", error: "" });

  const socials = useMemo(
    () => [
      { label: "Email", href: "mailto:hello@example.com", detail: "Best for direct product or support conversations" },
      { label: "LinkedIn", href: "https://www.linkedin.com/", detail: "Best for professional outreach and collaboration" },
      { label: "GitHub", href: "https://github.com/", detail: "Best for code, issues, and technical review context" },
    ],
    []
  );

  const resetStatus = () => setStatus({ contact: "", feedback: "", bug: "", error: "" });

  const submitContact = async (e) => {
    e.preventDefault();
    resetStatus();
    try {
      setLoading((current) => ({ ...current, contact: true }));
      const res = await api.contact({ ...contactForm, type: "contact" });
      setStatus((current) => ({ ...current, contact: `Message received and saved. Ticket ${res.ticketId} created.` }));
      setContactForm((current) => ({ ...current, subject: "", message: "" }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message || "Failed to send message." }));
    } finally {
      setLoading((current) => ({ ...current, contact: false }));
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    resetStatus();
    try {
      setLoading((current) => ({ ...current, feedback: true }));
      const res = await api.contact({ ...feedbackForm, type: "feedback" });
      setStatus((current) => ({ ...current, feedback: `Feedback saved successfully. Ticket ${res.ticketId} created.` }));
      setFeedbackForm((current) => ({ ...current, message: "" }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message || "Failed to submit feedback." }));
    } finally {
      setLoading((current) => ({ ...current, feedback: false }));
    }
  };

  const submitBug = async (e) => {
    e.preventDefault();
    resetStatus();
    try {
      setLoading((current) => ({ ...current, bug: true }));
      const res = await api.bugReport(bugForm);
      setStatus((current) => ({ ...current, bug: `Bug report saved successfully. Ticket ${res.ticketId} created.` }));
      setBugForm((current) => ({ ...current, page: "", details: "" }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message || "Failed to submit bug report." }));
    } finally {
      setLoading((current) => ({ ...current, bug: false }));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="bg-hero relative overflow-hidden rounded-[32px] border border-slate-200 p-6 shadow-sm md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="pill bg-[var(--app-surface)] text-slate-800">Contact center</div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">Reach the team without the usual messy support page.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                Contact us for support, product ideas, collaboration, or bug reports. Every submission is now saved in the database with a real ticket ID so nothing gets lost.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {channelCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-3xl border p-4"
                  style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
                >
                  <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{card.note}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-[var(--app-surface)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Popular resume requests</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {resumeSupportIdeas.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full border px-3 py-2 text-sm font-medium text-slate-700"
                    style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
                    onClick={() =>
                      setContactForm((current) => ({
                        ...current,
                        topic: item,
                        subject: item,
                      }))
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-900/10 bg-slate-950 p-5 text-white shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Response guide</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Best for support</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">Use General Contact when you need help, project clarification, or want to discuss the platform.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Best for product ideas</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">Use Feedback for feature requests, UX pain points, or improvements that would make the app more useful.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Best for bugs</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">Include the page, severity, and what happened versus what you expected so it can be triaged faster.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StatusMessage text={status.error} tone="text-rose-700" />

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <ThemedPanel accent="rgba(14, 165, 233, 0.08)" border="rgba(14, 165, 233, 0.18)">
            <div className="text-lg font-semibold text-slate-900">General Contact</div>
            <div className="mt-1 text-sm text-slate-500">Support, resume review requests, hiring conversations, partnerships, or product questions.</div>
            <form className="mt-5 space-y-3" onSubmit={submitContact}>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="input" placeholder="Your name" value={contactForm.name} onChange={(e) => setContactForm((current) => ({ ...current, name: e.target.value }))} required />
                <input className="input" type="email" placeholder="Your email" value={contactForm.email} onChange={(e) => setContactForm((current) => ({ ...current, email: e.target.value }))} required />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select className="input" value={contactForm.topic} onChange={(e) => setContactForm((current) => ({ ...current, topic: e.target.value }))}>
                  <option>Resume review request</option>
                  <option>ATS optimization help</option>
                  <option>Job-specific tailoring</option>
                  <option>Career guidance</option>
                  <option>General support</option>
                </select>
                <input className="input" placeholder="Target role" value={contactForm.targetRole} onChange={(e) => setContactForm((current) => ({ ...current, targetRole: e.target.value }))} />
                <select className="input" value={contactForm.timeline} onChange={(e) => setContactForm((current) => ({ ...current, timeline: e.target.value }))}>
                  <option>Within 48 hours</option>
                  <option>Within 1 week</option>
                  <option>Within 2 weeks</option>
                  <option>This month</option>
                  <option>Flexible</option>
                </select>
              </div>
              <input className="input" placeholder="Subject" value={contactForm.subject} onChange={(e) => setContactForm((current) => ({ ...current, subject: e.target.value }))} required />
              <textarea className="input min-h-[180px]" rows={7} placeholder="Tell us what you need help with. For resume help, include your current role, target role, biggest weakness, and the kind of jobs you are applying for..." value={contactForm.message} onChange={(e) => setContactForm((current) => ({ ...current, message: e.target.value }))} required />
              <button className="btn-primary w-full" type="submit" disabled={loading.contact}>
                {loading.contact ? "Sending..." : "Send Message"}
              </button>
            </form>
            <div className="mt-3">
              <StatusMessage text={status.contact} />
            </div>
          </ThemedPanel>

          <ThemedPanel accent="rgba(244, 63, 94, 0.08)" border="rgba(244, 63, 94, 0.18)">
            <div className="text-lg font-semibold text-slate-900">Bug Report</div>
            <div className="mt-1 text-sm text-slate-500">Save reproducible bugs with enough context for quick triage.</div>
            <form className="mt-5 space-y-3" onSubmit={submitBug}>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="input" type="email" placeholder="Your email" value={bugForm.email} onChange={(e) => setBugForm((current) => ({ ...current, email: e.target.value }))} required />
                <select className="input" value={bugForm.severity} onChange={(e) => setBugForm((current) => ({ ...current, severity: e.target.value }))}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <input className="input" placeholder="Page or feature where this happened" value={bugForm.page} onChange={(e) => setBugForm((current) => ({ ...current, page: e.target.value }))} required />
              <textarea className="input min-h-[180px]" rows={7} placeholder="Describe the bug, expected behavior, and what actually happened..." value={bugForm.details} onChange={(e) => setBugForm((current) => ({ ...current, details: e.target.value }))} required />
              <button className="btn-primary w-full" type="submit" disabled={loading.bug}>
                {loading.bug ? "Submitting..." : "Submit Bug Report"}
              </button>
            </form>
            <div className="mt-3">
              <StatusMessage text={status.bug} />
            </div>
          </ThemedPanel>
        </div>

        <div className="space-y-4">
          <ThemedPanel accent="rgba(16, 185, 129, 0.08)" border="rgba(16, 185, 129, 0.18)">
            <div className="text-lg font-semibold text-slate-900">Product Feedback</div>
            <div className="mt-1 text-sm text-slate-500">Tell us what should improve, what feels weak, or what should exist next.</div>
            <form className="mt-5 space-y-3" onSubmit={submitFeedback}>
              <input className="input" type="email" placeholder="Your email" value={feedbackForm.email} onChange={(e) => setFeedbackForm((current) => ({ ...current, email: e.target.value }))} required />
              <select className="input" value={feedbackForm.category} onChange={(e) => setFeedbackForm((current) => ({ ...current, category: e.target.value }))}>
                <option>Feature feedback</option>
                <option>UI feedback</option>
                <option>Performance feedback</option>
                <option>General suggestion</option>
              </select>
              <textarea className="input min-h-[200px]" rows={8} placeholder="What would make this product meaningfully better for you?" value={feedbackForm.message} onChange={(e) => setFeedbackForm((current) => ({ ...current, message: e.target.value }))} required />
              <button className="btn-primary w-full" type="submit" disabled={loading.feedback}>
                {loading.feedback ? "Submitting..." : "Send Feedback"}
              </button>
            </form>
            <div className="mt-3">
              <StatusMessage text={status.feedback} />
            </div>
          </ThemedPanel>

          <ThemedPanel accent="rgba(245, 158, 11, 0.08)" border="rgba(245, 158, 11, 0.18)">
            <div className="text-lg font-semibold text-slate-900">Direct Channels</div>
            <div className="mt-1 text-sm text-slate-500">Use these if you want a more direct route outside the forms.</div>
            <div className="mt-5 space-y-3">
              {socials.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  className="block rounded-3xl border px-4 py-4 transition"
                  style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
                >
                  <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</div>
                </a>
              ))}
            </div>
          </ThemedPanel>

          <ThemedPanel accent="rgba(148, 163, 184, 0.08)" border="var(--app-border)">
            <div className="text-lg font-semibold text-slate-900">How To Get Better Resume Help</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border px-4 py-3 text-sm text-slate-700" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>Mention your target role, experience level, and industry.</div>
              <div className="rounded-2xl border px-4 py-3 text-sm text-slate-700" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>Tell us whether you need ATS help, bullet rewrites, project feedback, or job tailoring.</div>
              <div className="rounded-2xl border px-4 py-3 text-sm text-slate-700" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>Share your timeline so the support can focus on the highest-impact changes first.</div>
            </div>
          </ThemedPanel>
        </div>
      </section>
    </div>
  );
}
