import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

const TEMPLATE_LOOK = {
  classic: {
    accent: "text-teal-700",
    border: "border-teal-100",
    bg: "from-teal-50 to-white",
    chip: "border-teal-100 bg-white text-slate-700",
  },
  executive: {
    accent: "text-blue-700",
    border: "border-blue-100",
    bg: "from-blue-50 to-white",
    chip: "border-blue-100 bg-white text-slate-700",
  },
  minimal: {
    accent: "text-slate-700",
    border: "border-slate-200",
    bg: "from-slate-50 to-white",
    chip: "border-slate-200 bg-white text-slate-700",
  },
  technical: {
    accent: "text-slate-900",
    border: "border-slate-300",
    bg: "from-slate-100 to-white",
    chip: "border-slate-300 bg-white text-slate-800",
  },
  graduate: {
    accent: "text-violet-700",
    border: "border-violet-100",
    bg: "from-violet-50 to-white",
    chip: "border-violet-100 bg-white text-slate-700",
  },
  operations: {
    accent: "text-amber-700",
    border: "border-amber-100",
    bg: "from-amber-50 to-white",
    chip: "border-amber-100 bg-white text-slate-700",
  },
  consulting: {
    accent: "text-emerald-700",
    border: "border-emerald-100",
    bg: "from-emerald-50 to-white",
    chip: "border-emerald-100 bg-white text-slate-700",
  },
};

export default function SharedResume() {
  const { shareId } = useParams();
  const [resume, setResume] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadSharedResume = async () => {
      try {
        const payload = await api.getSharedResume(shareId);
        if (active) setResume(payload);
      } catch (err) {
        if (active) setError(err.message || "Failed to load shared resume.");
      }
    };

    loadSharedResume();

    return () => {
      active = false;
    };
  }, [shareId]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card-elevated p-6">
          <h1 className="text-2xl font-bold text-slate-900">Shared Resume</h1>
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card-elevated p-6 text-sm text-slate-500">Loading shared resume...</div>
      </div>
    );
  }

  const look = TEMPLATE_LOOK[resume.template] || TEMPLATE_LOOK.classic;
  const templateLabel = resume.template
    ? resume.template.charAt(0).toUpperCase() + resume.template.slice(1)
    : "Classic";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className={`card-elevated border ${look.border} bg-gradient-to-br ${look.bg} p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${look.accent}`}>Shared Resume</div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{resume.headline || "Resume Draft"}</h1>
            <div className="mt-2 text-sm text-slate-500">{resume.versionLabel || "Resume version"} • {templateLabel} template</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : "Shared"}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${look.accent}`}>Professional Summary</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{resume.summary || "No summary provided."}</p>
          </section>

          <section>
            <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${look.accent}`}>Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(String(resume.skills || "").split(",").map((item) => item.trim()).filter(Boolean)).map((skill) => (
                <span key={skill} className={`rounded-full border px-3 py-1 text-sm ${look.chip}`}>{skill}</span>
              ))}
            </div>
          </section>

          <section>
            <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${look.accent}`}>Experience Highlights</h2>
            <div className="mt-3 space-y-3">
              {(resume.bullets || []).map((bullet, index) => (
                <div key={`${bullet}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  {bullet}
                </div>
              ))}
            </div>
          </section>

          {!!resume.keywords?.length && (
            <section>
              <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${look.accent}`}>Target Keywords</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {resume.keywords.map((item) => (
                  <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800">{item}</span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
