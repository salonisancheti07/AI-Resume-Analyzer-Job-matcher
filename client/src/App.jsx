import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { auth } from "./auth";
import { api } from "./api";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
const SharedResume = lazy(() => import("./pages/SharedResume"));

const ResumeAnalyzer = lazy(() => import("./pages/ResumeAnalyzer"));
const JobMatcher = lazy(() => import("./pages/JobMatcher"));
const ResumeFeedback = lazy(() => import("./pages/ResumeFeedback"));
const InterviewPrep = lazy(() => import("./pages/InterviewPrep"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AIChat = lazy(() => import("./pages/AIChat"));
const SkillGap = lazy(() => import("./pages/SkillGap"));
const ResumeComparison = lazy(() => import("./pages/ResumeComparison"));
const RecruiterDashboard = lazy(() => import("./pages/RecruiterDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const CareerCoach = lazy(() => import("./pages/CareerCoach"));
const AIStudio = lazy(() => import("./pages/AIStudio"));
const AIModeChat = lazy(() => import("./pages/AIModeChat"));
const ResumeTemplates = lazy(() => import("./pages/ResumeTemplates"));

const PAGE_METADATA = {
  "/": {
    title: "AI Resume Analyzer & Job Matcher",
    description:
      "Student-friendly AI resume toolkit for ATS scoring, job matching, skill gap analysis, and interview preparation.",
  },
  "/analyzer": {
    title: "Resume Analyzer | AI Resume Analyzer & Job Matcher",
    description: "Analyze your resume with ATS-safe recommendations, keyword insights, and resume improvement guidance.",
  },
  "/matcher": {
    title: "Job Matcher | AI Resume Analyzer & Job Matcher",
    description: "Match your resume with high-fit jobs and discover skill gaps for the next step in your career.",
  },
  "/dashboard": {
    title: "Dashboard | AI Resume Analyzer & Job Matcher",
    description: "Track your application progress, resume changes, and job search insights in one student-ready workspace.",
  },
  "/contact": {
    title: "Contact | AI Resume Analyzer & Job Matcher",
    description: "Get support for resume review, job matching, and career coaching with our AI-powered platform.",
  },
  "/templates": {
    title: "Resume Templates | AI Resume Analyzer & Job Matcher",
    description: "Browse student-focused resume templates and access a performance audit checklist for your portfolio project.",
  },
};

function usePageMeta() {
  const location = useLocation();

  useEffect(() => {
    const meta = PAGE_METADATA[location.pathname] || PAGE_METADATA["/"];
    document.title = meta.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", meta.description);
    } else {
      const tag = document.createElement("meta");
      tag.name = "description";
      tag.content = meta.description;
      document.head.appendChild(tag);
    }
  }, [location]);
}

const DASHBOARD_NOTIFICATIONS_KEY = "dashboard_notifications_hidden";
const DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY = "dashboard_activity_notifications";

function ProtectedRoute({ children, authReady, isAuthenticated }) {
  const location = useLocation();
  if (!authReady) {
    return <p className="text-sm text-slate-500">Checking your session...</p>;
  }
  return isAuthenticated
    ? children
    : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
}

function PublicAuthRoute({ children, authReady, isAuthenticated }) {
  if (!authReady) {
    return <p className="text-sm text-slate-500">Checking your session...</p>;
  }
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const userParam = params.get("user");
    if (!token || !userParam) {
      navigate("/login?oauth=failed", { replace: true });
      return;
    }
    try {
      auth.setSession(token, JSON.parse(userParam), { rememberMe: false });
      navigate("/dashboard", { replace: true });
    } catch {
      navigate("/login?oauth=failed", { replace: true });
    }
  }, [navigate, params]);

  return <p className="text-sm text-slate-500">Completing sign in...</p>;
}

const primaryNavItems = (isAuthed) =>
  isAuthed
    ? [
        { label: "Dashboard", href: "/dashboard", icon: "⌂" },
        { label: "Analyzer", href: "/analyzer", icon: "📄" },
        { label: "Jobs", href: "/matcher", icon: "💼" },
        { label: "Templates", href: "/templates", icon: "🧾" },
        { label: "AI Studio", href: "/ai-studio", icon: "✨" },
        { label: "Interview", href: "/interview", icon: "🎤" },
      ]
    : [
        { label: "Home", href: "/", icon: "⌂" },
        { label: "Analyzer", href: "/analyzer", icon: "📄" },
        { label: "Jobs", href: "/matcher", icon: "💼" },
        { label: "Templates", href: "/templates", icon: "🧾" },
        { label: "AI Studio", href: "/ai-studio", icon: "✨" },
      ];

const secondaryNavItems = (isAuthed) =>
  isAuthed
    ? [
        { label: "Feedback", href: "/feedback" },
        { label: "Notifications", href: "/notifications" },
        { label: "AI Chat", href: "/chat" },
        { label: "AI Mode", href: "/ai-mode" },
        { label: "Career Coach", href: "/coach" },
        { label: "Skill Gap", href: "/skill-gap" },
        { label: "Compare", href: "/compare" },
        { label: "Recruiter", href: "/recruiter" },
        { label: "Contact", href: "/contact" },
        { label: "Profile", href: "/profile" },
      ]
    : [
        { label: "Contact", href: "/contact" },
      ];

function Nav({ theme, onToggleTheme, currentUser, isAuthenticated }) {
  const user = isAuthenticated ? currentUser : null;
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = primaryNavItems(!!user);
  const secondaryItems = secondaryNavItems(!!user);

  const unreadCount = (() => {
    if (!user) {
      return 0;
    }
    try {
      const hidden = JSON.parse(localStorage.getItem(DASHBOARD_NOTIFICATIONS_KEY) || "[]");
      const activity = JSON.parse(localStorage.getItem(DASHBOARD_ACTIVITY_NOTIFICATIONS_KEY) || "[]");
      const hiddenCount = Array.isArray(hidden) ? hidden.length : 0;
      const activityCount = Array.isArray(activity) ? activity.length : 0;
      return Math.max(0, 3 + activityCount - hiddenCount);
    } catch {
      return 0;
    }
  })();

  const decoratedPrimaryItems = useMemo(
    () => primaryItems.map((item) => ({ ...item })),
    [primaryItems]
  );

  const decoratedSecondaryItems = useMemo(
    () =>
      secondaryItems.map((item) => ({
        ...item,
        badge: item.href === "/notifications" && unreadCount > 0 ? unreadCount : 0,
      })),
    [secondaryItems, unreadCount]
  );

  const isMoreActive = decoratedSecondaryItems.some((item) => item.href === location.pathname);

  return (
    <nav className="sticky top-2 z-40 px-2 sm:top-4 sm:px-3">
      <div 
        className="mx-auto max-w-7xl rounded-2xl px-3 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:rounded-[28px] sm:px-4"
        style={{
          backgroundColor: 'var(--navbar-bg)',
          borderColor: 'var(--navbar-border)',
          color: 'var(--navbar-text)',
          border: '1px solid var(--navbar-border)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavLink to="/" className="flex min-w-0 items-center gap-2 sm:gap-3" onClick={() => { setMobileOpen(false); setMoreOpen(false); }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-500 text-lg text-white shadow-lg shadow-cyan-900/40 sm:h-11 sm:w-11">
                ✦
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold sm:text-lg" style={{ color: 'var(--navbar-text)' }}>ResumeAI Pro</div>
                <div className="hidden text-xs lg:block" style={{ color: 'var(--navbar-text-muted)' }}>Premium AI career workspace</div>
              </div>
            </NavLink>
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 lg:inline-flex">
              ● AI Mode
            </span>
          </div>

          <div 
            className="hidden xl:flex items-center gap-2 rounded-2xl p-1.5"
            style={{
              backgroundColor: 'var(--navbar-hover)',
              borderColor: 'var(--navbar-border)',
              border: '1px solid var(--navbar-border)',
            }}
          >
            {decoratedPrimaryItems.map(({ label, href, icon }) => (
              <NavLink
                key={href}
                to={href}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-teal-500 to-indigo-500 text-white shadow-lg shadow-teal-950/30"
                      : "hover:text-teal-600"
                  }`
                }
                style={{ color: 'var(--navbar-text-light)' }}
              >
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  isMoreActive || moreOpen
                    ? "text-teal-600"
                    : ""
                }`}
                style={{
                  color: isMoreActive || moreOpen ? undefined : 'var(--navbar-text-light)',
                  backgroundColor: isMoreActive || moreOpen ? 'var(--navbar-hover)' : 'transparent',
                }}
              >
                <span>More</span>
                <span className={`transition ${moreOpen ? "rotate-180" : ""}`}>⌄</span>
                {unreadCount > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
              </button>

              {moreOpen && (
                <div 
                  className="absolute right-0 top-14 w-64 rounded-2xl p-2 shadow-[0_18px_40px_rgba(15,23,42,0.35)] backdrop-blur-xl"
                  style={{
                    backgroundColor: 'var(--navbar-backdrop)',
                    borderColor: 'var(--navbar-border)',
                    border: '1px solid var(--navbar-border)',
                  }}
                >
                <div className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Explore more</div>
                  <div className="grid gap-1">
                    {decoratedSecondaryItems.map(({ label, href, badge }) => (
                      <NavLink
                        key={href}
                        to={href}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                            isActive ? "bg-teal-500/15 text-teal-300" : ""
                          }`
                        }
                        style={{ color: 'var(--navbar-text-muted)' }}
                      >
                        <span>{label}</span>
                        {!!badge && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition sm:h-auto sm:px-3"
              style={{
                backgroundColor: 'var(--navbar-hover)',
                borderColor: 'var(--navbar-border)',
                border: '1px solid var(--navbar-border)',
                color: 'var(--navbar-text)',
              }}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
              <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>

            {user && (
              <NavLink
                to="/notifications"
                className="hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
                style={{
                  backgroundColor: 'var(--navbar-hover)',
                  borderColor: 'var(--navbar-border)',
                  border: '1px solid var(--navbar-border)',
                  color: 'var(--navbar-text)',
                }}
              >
                <span>🔔</span>
                <span>Alerts</span>
                {unreadCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
              </NavLink>
            )}

            {!user && (
              <div className="hidden md:flex gap-2">
                <NavLink 
                  to="/login" 
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold transition"
                  style={{
                    backgroundColor: 'var(--navbar-hover)',
                    borderColor: 'var(--navbar-border)',
                    border: '1px solid var(--navbar-border)',
                    color: 'var(--navbar-text)',
                  }}
                >
                  Login
                </NavLink>
                <NavLink to="/signup" className="rounded-xl bg-gradient-to-r from-teal-500 to-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-950/30">
                  Get Started
                </NavLink>
              </div>
            )}

            {user && (
              <NavLink to="/profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 text-sm font-semibold text-white ring-2 ring-white/10">
                {user.name?.charAt(0) || "U"}
              </NavLink>
            )}

            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition xl:hidden"
              style={{
                backgroundColor: 'var(--navbar-hover)',
                borderColor: 'var(--navbar-border)',
                border: '1px solid var(--navbar-border)',
                color: 'var(--navbar-text)',
                fontSize: '1.125rem',
              }}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div 
            className="mt-3 rounded-2xl p-3 xl:hidden"
            style={{
              backgroundColor: 'var(--navbar-backdrop)',
              borderColor: 'var(--navbar-border)',
              border: '1px solid var(--navbar-border)',
            }}
          >
            <div 
              className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'var(--navbar-text-muted)' }}
            >
              Navigation
            </div>
            <div className="grid max-h-[min(70vh,34rem)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {[...decoratedPrimaryItems, ...decoratedSecondaryItems].map(({ label, href, badge }) => (
                <NavLink
                  key={href}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive ? "bg-teal-500/15 text-teal-300" : ""
                    }`
                  }
                  style={{ color: 'var(--navbar-text-muted)' }}
                >
                  <span>{label}</span>
                  {!!badge && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-slate-50 py-6 px-4 text-sm text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-semibold text-slate-900">ResumeAI Pro</div>
          <div className="mt-1 text-slate-600">Student-ready AI resume workspace with ATS templates, job matching, and interview prep.</div>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/templates" className="text-teal-600 hover:underline">Resume Templates</a>
          <a href="/analyzer" className="text-teal-600 hover:underline">Resume Analyzer</a>
          <a href="/matcher" className="text-teal-600 hover:underline">Job Matcher</a>
        </div>
      </div>
    </footer>
  );
}

function Layout({ children, theme, onToggleTheme, currentUser, isAuthenticated }) {
  const location = useLocation();
  usePageMeta();
  const noNavRoutes = ["/login", "/signup", "/auth/callback"];
  const showNav = !noNavRoutes.includes(location.pathname);
  const isWorkspaceRoute = location.pathname === "/ai-mode";

  return (
    <>
      {showNav && <Nav theme={theme} onToggleTheme={onToggleTheme} currentUser={currentUser} isAuthenticated={isAuthenticated} />}
      <div className={isWorkspaceRoute ? "mx-auto max-w-[calc(100vw-1rem)] px-2 pb-4 pt-2 sm:max-w-[calc(100vw-2rem)] sm:px-4" : "mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6"}>
        {children}
      </div>
      {!isWorkspaceRoute && <Footer />}
    </>
  );
}

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <div className="card-elevated px-6 py-5 text-center">
        <div className="text-lg font-semibold text-slate-900">Loading workspace</div>
        <div className="mt-2 text-sm text-slate-600">Preparing your next tool and analysis view.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("resumeai_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("resumeai_theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    const verifyStoredSession = async () => {
      if (!auth.getToken()) {
        auth.clear();
        if (active) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setAuthReady(true);
        }
        return;
      }

      try {
        const response = await api.me();
        const token = auth.getToken();
        if (response?.user && token) {
          const rememberMe = localStorage.getItem("remember_me") === "true";
          auth.setSession(token, response.user, { rememberMe });
          if (active) {
            setIsAuthenticated(true);
            setCurrentUser(response.user);
          }
        } else {
          auth.clear();
          if (active) {
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        }
      } catch {
        auth.clear();
        if (active) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    };

    verifyStoredSession();

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card-elevated px-6 py-5 text-center">
          <div className="text-lg font-semibold text-slate-900">Checking login status</div>
          <div className="mt-2 text-sm text-slate-600">Protected pages will open only after a valid session is confirmed.</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout theme={theme} onToggleTheme={toggleTheme} currentUser={currentUser} isAuthenticated={isAuthenticated}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home authReady={authReady} isAuthenticated={isAuthenticated} currentUser={currentUser} />} />
            <Route path="/analyzer" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><ResumeAnalyzer /></ProtectedRoute>} />
            <Route path="/matcher" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><JobMatcher /></ProtectedRoute>} />
            <Route path="/ai-studio" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><AIStudio /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><ResumeFeedback /></ProtectedRoute>} />
            <Route path="/interview" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><InterviewPrep /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><Dashboard /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><Notifications /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><AIChat /></ProtectedRoute>} />
            <Route path="/ai-mode" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><AIModeChat /></ProtectedRoute>} />
            <Route path="/skill-gap" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><SkillGap /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><ResumeComparison /></ProtectedRoute>} />
            <Route path="/recruiter" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/templates" element={<ResumeTemplates />} />
            <Route path="/shared-resume/:shareId" element={<SharedResume />} />
            <Route path="/login" element={<PublicAuthRoute authReady={authReady} isAuthenticated={isAuthenticated}><Login /></PublicAuthRoute>} />
            <Route path="/signup" element={<PublicAuthRoute authReady={authReady} isAuthenticated={isAuthenticated}><Signup /></PublicAuthRoute>} />
            <Route path="/profile" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><Profile /></ProtectedRoute>} />
            <Route path="/coach" element={<ProtectedRoute authReady={authReady} isAuthenticated={isAuthenticated}><CareerCoach /></ProtectedRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
