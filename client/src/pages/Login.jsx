import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { auth } from "../auth";

const oauthMessages = {
  failed: "OAuth sign-in failed. Please try again.",
  server_unavailable: "The authentication server is not running. Start the server on port 5000, then try again.",
  google_unavailable: "Google sign-in is not fully configured on the server yet.",
  google_invalid_credentials: "Google sign-in is misconfigured on the server. The Google client secret is invalid, so please use email login for now or update the server OAuth credentials.",
  github_unavailable: "GitHub sign-in is not fully configured on the server yet.",
  github_invalid_credentials: "GitHub sign-in is misconfigured on the server. Please use email login for now or update the server OAuth credentials.",
};

const featureList = [
  "ATS score analysis with detailed feedback",
  "AI-powered resume optimization",
  "Smart job matching engine",
  "Skill gap analysis and learning paths",
];

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nextPath = searchParams.get("next") || "/dashboard";
  const currentUser = auth.getUser();
  const isAlreadyAuthed = auth.isAuthed();

  const oauthNotice = oauthMessages[searchParams.get("oauth")] || "";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.login({ email, password, rememberMe });
      auth.setSession(response.token, response.user, { rememberMe });
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider) => {
    setError("");
    if (provider === "google") {
      api.oauthGoogle();
      return;
    }
    api.oauthGithub();
  };

  const handleSwitchAccount = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout transport errors and clear the local session anyway.
    }
    auth.clear();
    setError("");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-hero px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] items-center">
        <div className="space-y-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800">
            ← Back to home
          </Link>
          <div className="pill-primary">🔐 Secure login</div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Continue to your dashboard</h1>
            <p className="mt-3 text-lg text-slate-600">
              Sign in with email, Google, or GitHub to access ATS analysis, job matching, and your AI career tools.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featureList.map((feature) => (
              <div key={feature} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-soft">
                ✓ {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 md:p-8 space-y-5">
          <div className="space-y-1 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-600">Login to continue building your resume-ready portfolio.</p>
          </div>

          {oauthNotice && <div className="alert-warning">{oauthNotice}</div>}
          {isAlreadyAuthed && (
            <div className="alert-info">
              You are already signed in as <span className="font-semibold">{currentUser?.email || currentUser?.name || "user"}</span>.
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => navigate("/dashboard")}>Open dashboard</button>
                <button type="button" className="btn-primary btn-sm" onClick={handleSwitchAccount}>Use different account</button>
              </div>
            </div>
          )}
          {error && <div className="alert-danger">{error}</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-secondary w-full" onClick={() => handleOAuth("google")}>
              <span>🔵</span>
              <span>Continue with Google</span>
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => handleOAuth("github")}>
              <span>⚫</span>
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-slate-500">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me on this device
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Login and continue"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-semibold text-teal-700 hover:text-teal-800">
              Continue to sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
