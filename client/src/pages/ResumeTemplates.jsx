import { Link, useNavigate } from "react-router-dom";

const TEMPLATES = [
  {
    id: "academic",
    presetKey: "graduate",
    name: "Academic Starter",
    icon: "🎓",
    description: "Designed for students and freshers to showcase projects, coursework, and internships with strong ATS signals.",
    layout: "Single column",
    focus: "Projects + Education",
    level: "Entry",
    atsScore: 92,
  },
  {
    id: "technical",
    presetKey: "technical",
    name: "Technical Portfolio",
    icon: "🧪",
    description: "Balances skills, technologies, and internship experience in a clean, recruiter-friendly layout.",
    layout: "Two section",
    focus: "Skills + Experience",
    level: "Mid",
    atsScore: 91,
  },
  {
    id: "leadership",
    presetKey: "executive",
    name: "Leadership Impact",
    icon: "🚀",
    description: "Highlights leadership, team contributions, and quantifiable achievements for competitive student roles.",
    layout: "Minimal",
    focus: "Impact + Metrics",
    level: "Early Career",
    atsScore: 90,
  },
  {
    id: "product",
    presetKey: "minimal",
    name: "Product & Design",
    icon: "✨",
    description: "Showcases internships, product launches, and research skills with strong narrative flow.",
    layout: "Balanced",
    focus: "Projects + Outcomes",
    level: "Entry",
    atsScore: 89,
  },
  {
    id: "career-switch",
    presetKey: "consulting",
    name: "Switch Strategy",
    icon: "🔄",
    description: "Builds a compelling story for students transitioning into tech, analytics, or product roles.",
    layout: "Clean",
    focus: "Narrative + Transferable Skills",
    level: "Career Switcher",
    atsScore: 90,
  },
];

const CHECKLIST_ITEMS = [
  {
    title: "Resume Quality",
    items: [
      "Use ATS-friendly headings: Experience, Education, Skills, Projects.",
      "Keep a single-column layout with no tables or graphics.",
      "Use strong action verbs and measurable outcomes in bullets.",
      "Match keywords to the job description and student role.",
      "Keep contact info visible at the top.",
    ],
  },
  {
    title: "App SEO & Performance",
    items: [
      "Update page title and meta description for each route.",
      "Keep the homepage lightweight and responsive.",
      "Use lazy loading for non-critical routes and UI assets.",
      "Validate accessibility and color contrast.",
      "Test production build performance with Lighthouse.",
    ],
  },
];

const PREVIEW_TEMPLATES = [
  {
    id: "preview-academic",
    presetKey: "graduate",
    name: "Academic Starter",
    top: "Education + Projects",
    lines: ["• Research project on data systems", "• GPA: 3.8/4.0", "• Internship with 2 cross-functional teams"],
  },
  {
    id: "preview-technical",
    presetKey: "technical",
    name: "Technical Portfolio",
    top: "Skills + Experience",
    lines: ["• Built ML model with Python", "• Deployed API using Docker", "• Led campus hackathon team"],
  },
  {
    id: "preview-switch",
    presetKey: "consulting",
    name: "Switch Strategy",
    top: "Story + Transferable Skills",
    lines: ["• Product-backed analytics experience", "• Collaboration with product and design", "• Completed certificate in cloud computing"],
  },
];

export default function ResumeTemplates() {
  const navigate = useNavigate();

  const handleUseTemplate = (templateId) => {
    navigate(`/analyzer?template=${templateId}`);
  };

  return (
    <div className="space-y-10 pb-10">
      <section className="card-elevated p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="pill-primary">Student Resume Templates</span>
            <h1 className="mt-4 text-4xl font-bold text-slate-900">ATS-ready templates built for students and early-career talent</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Choose a template optimized for projects, internships, and first professional experiences. Use the performance audit checklist to keep your resume and the app itself polished for submission.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/analyzer" className="btn-primary btn-lg">Start resume review</Link>
            <Link to="/ai-studio" className="btn-secondary btn-lg">Open AI Studio</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <div key={template.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="text-3xl">{template.icon}</div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${template.atsScore >= 91 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                ATS {template.atsScore}
              </div>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">{template.name}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{template.description}</p>
            <div className="mt-5 space-y-2 text-sm text-slate-700">
              <div><span className="font-semibold">Layout:</span> {template.layout}</div>
              <div><span className="font-semibold">Focus:</span> {template.focus}</div>
              <div><span className="font-semibold">Best for:</span> {template.level}</div>
            </div>
            <button type="button" onClick={() => handleUseTemplate(template.presetKey || template.id)} className="btn-primary btn-sm mt-5 w-full">Use {template.name}</button>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Resume + SEO Performance Audit</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              This checklist helps students keep resume quality high while also tracking app readiness for a portfolio submission.
            </p>
          </div>
          <Link to="/dashboard" className="btn-primary btn-lg">Open your career dashboard</Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {CHECKLIST_ITEMS.map((group) => (
            <div key={group.title} className="rounded-3xl bg-slate-900 p-5">
              <h3 className="text-xl font-semibold text-white">{group.title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-teal-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-3xl font-bold text-slate-900">Resume style previews</h2>
        <p className="mt-3 text-sm text-slate-600">
          Preview how each student template balances sections, keywords, and impact statements in a clean layout.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {PREVIEW_TEMPLATES.map((preview) => (
            <div key={preview.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{preview.name}</h3>
                  <p className="text-sm text-slate-500">{preview.top}</p>
                </div>
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">Preview</span>
              </div>
              <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-inner">
                <div className="mb-3 h-2.5 w-24 rounded-full bg-slate-200" />
                <div className="mb-3 h-2.5 w-16 rounded-full bg-slate-200" />
                <div className="space-y-2">
                  {preview.lines.map((line) => (
                    <div key={line} className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-400" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUseTemplate(preview.presetKey || preview.id.replace("preview-", ""))}
                className="btn-secondary btn-sm mt-4 w-full"
              >
                Use {preview.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-3xl font-bold text-slate-900">How to use these templates</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900">For students</h3>
            <p className="mt-2 text-sm text-slate-600">Use the Academic Starter or Product & Design templates when applying for internships and entry-level roles. Keep your skills, projects, and education concise but specific.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900">For career switchers</h3>
            <p className="mt-2 text-sm text-slate-600">Choose the Switch Strategy template to highlight transferable skills and relevant coursework. Align the summary with your new target role.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
