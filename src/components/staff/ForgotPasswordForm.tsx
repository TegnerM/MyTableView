"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

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

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

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
        setError(t.auth.tooManyRequests);
        return;
      }

      // Success AND "no such user" both land here, deliberately.
      setSent(true);
    } catch {
      setError(t.auth.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p className="mtv-signin-notice">
        {t.auth.resetSentBefore} <strong>{email.trim()}</strong>
        {t.auth.resetSentAfter}
      </p>
    );
  }

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submit(e)}>
      <label className="mtv-field">
        <span>{t.auth.email}</span>
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
        {busy ? t.auth.sending : t.auth.sendResetLink}
      </button>
    </form>
  );
}
