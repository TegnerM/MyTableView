"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Forgot password — request the reset email.
 *
 * Always answers "check your inbox" whether or not the address exists:
 * confirming which emails have accounts would let anyone probe the
 * customer list. The only error surfaced is Supabase's rate limit,
 * which leaks nothing.
 *
 * The email links to /auth/confirm?type=recovery (scanner-proof button
 * page), which verifies the token and lands on /staff/reset-password.
 */

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = getBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim()
      );

      if (resetError && /rate limit/i.test(resetError.message)) {
        setError(
          "Too many requests — please wait a minute before trying again."
        );
        return;
      }

      // Success AND "no such user" both land here, deliberately.
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p className="mtv-signin-notice">
        If an account exists for <strong>{email.trim()}</strong>, a reset
        link is on its way. Check your inbox (and spam folder) — the link
        is valid for a limited time.
      </p>
    );
  }

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submit(e)}>
      <label className="mtv-field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      {error ? <p className="mtv-signin-error">{error}</p> : null}

      <button type="submit" className="mtv-signin-button" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
