/**
 * Forgot password: send reset email via Firebase.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../lib/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const setError = useAuthStore((s) => s.setError);
  const clearError = useAuthStore((s) => s.clearError);
  const error = useAuthStore((s) => s.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    setSent(false);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Reset password</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2">
              {error}
            </div>
          )}
          {sent && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-3 py-2">
              Check your email for the reset link.
            </div>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={sent}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={loading || sent}
            className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending…" : sent ? "Email sent" : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="text-[var(--accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
