import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { auth } from "../auth";

const benefits = [
  "Unlimited resume analyses",
  "AI-powered optimization tools",
  "Job matching engine",
  "Skill gap analysis",
  "Interview preparation",
];

export default function Signup() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const nextPath = searchParams.get("next") || "/dashboard";
  const currentUser = auth.getUser();
  const isAlreadyAuthed = auth.isAuthed();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions");
      return;
    }

    setLoading(true);
    try {
      const response = await api.signup({ name, email, password, rememberMe });
      auth.setSession(response.token, response.user, { rememberMe });
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message || "Signup failed");
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
    navigate("/signup", { replace: true });
  };

  return (
    <div className="min-h-screen bg-hero px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1fr] items-center">
        <div className="space-y-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800">
            ← Back to home
          </Link>
          <div className="pill-primary">✨ Create your account</div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Continue to sign up</h1>
            <p className="mt-3 text-lg text-slate-600">
              Start with email, Google, or GitHub and unlock the full AI resume and job-matching workflow.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-soft">
                ✓ {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 md:p-8 space-y-5">
          <div className="space-y-1 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Create account</h2>
            <p className="text-slate-600">Use email or continue with a social provider.</p>
          </div>

          {isAlreadyAuthed && (
            <div className="alert-info">
              You are already signed in as <span className="font-semibold">{currentUser?.email || currentUser?.name || "user"}</span>.
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => navigate("/dashboard")}>Open dashboard</button>
                <button type="button" className="btn-primary btn-sm" onClick={handleSwitchAccount}>Create / use another account</button>
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

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>I agree to the Terms of Service and Privacy Policy.</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Keep me signed in on this device
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account..." : "Create account and continue"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">
              Continue to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
