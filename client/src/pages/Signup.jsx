/**
 * Signup: email/password + Google. Redirects to onboarding after first login.
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpWithEmail, signInWithGoogle } from "../lib/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.authLoading);
  const isProfileComplete = useAuthStore((s) => s.isProfileComplete);
  const setError = useAuthStore((s) => s.setError);
  const clearError = useAuthStore((s) => s.clearError);
  const error = useAuthStore((s) => s.error);

  useEffect(() => {
    if (authLoading || !user) return;
    if (isProfileComplete()) navigate("/", { replace: true });
  }, [authLoading, user, isProfileComplete, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, password, name);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use"
        ? "This email is already registered. Try signing in."
        : err.message || "Sign up failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearError();
    setLoading(true);
    try {
      await signInWithGoogle();
      // Sign up flow: always go to onboarding to complete profile (Onboarding will redirect to chat if already complete)
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Create account</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Join AstroxAI</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs text-[var(--text-muted)]">
            <span className="bg-[var(--bg-primary)] px-2">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border)] text-white transition-colors disabled:opacity-50"
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link to="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
