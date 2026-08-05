"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Self-serve signup: restaurant + owner account in one form.
 *
 * Two steps under the hood — supabase.auth.signUp creates the user and
 * writes the session cookie, then /api/signup creates the venue with
 * the owner staff row. On success the owner lands straight in the
 * layout editor to draw their floor (the trial clock started at the
 * venue insert).
 *
 * If email confirmation is ON in Supabase, signUp returns no session;
 * the form explains the confirm-first path instead of failing.
 */

type Props = {
  /**
   * True when the visitor already holds a session (confirmed their
   * email, or an interrupted signup). The account step is skipped —
   * calling signUp again for an existing user would fail — and the
   * form only asks for what's still missing: the restaurant.
   */
  alreadySignedIn?: boolean;
  /** Personal invite token from ?invite= — attributes the signup and
   *  may carry a custom trial length. */
  inviteToken?: string | null;
};

export function SignUpForm({
  alreadySignedIn = false,
  inviteToken = null,
}: Props) {
  const [venueName, setVenueName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (!alreadySignedIn) {
        const supabase = getBrowserClient();

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (!data.session) {
          // Email confirmation is enabled in Supabase Auth settings.
          // The confirmation email links to /auth/confirm, which signs
          // them in and sends them back here to finish this form.
          setNotice(
            "Check your inbox to confirm your email — the link brings you straight back here to finish setting up your restaurant."
          );
          return;
        }
      }

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Europe/Madrid";

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueName: venueName.trim(),
          displayName: displayName.trim(),
          timezone,
          ...(inviteToken ? { inviteToken } : {}),
          ...(referralCode.trim()
            ? { referralCode: referralCode.trim().toLowerCase() }
            : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          reason?: string;
          detail?: string;
        } | null;

        setError(
          payload?.reason === "already_staff"
            ? "This account already belongs to a restaurant — just sign in."
            : payload?.detail
              ? `Could not create your restaurant: ${payload.detail}`
              : "Could not create your restaurant. Please try again."
        );
        return;
      }

      // Full navigation (not router.replace) so every server component
      // re-renders with the fresh session AND the fresh venue cookie.
      window.location.href = "/staff/layout";
    } catch {
      setError("Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submit(e)}>
      <label className="mtv-field">
        <span>Restaurant name</span>
        <input
          type="text"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          autoComplete="organization"
          minLength={2}
          maxLength={80}
          required
        />
      </label>

      <label className="mtv-field">
        <span>Your name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          maxLength={80}
          required
        />
      </label>

      {alreadySignedIn ? null : (
        <>
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

          <label className="mtv-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </>
      )}

      <label className="mtv-field">
        <span>Referral code (optional)</span>
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toLowerCase())}
          placeholder="Did someone recommend us?"
          maxLength={32}
        />
      </label>

      {error ? <p className="mtv-signin-error">{error}</p> : null}
      {notice ? <p className="mtv-signin-notice">{notice}</p> : null}

      <button type="submit" className="mtv-signin-button" disabled={busy}>
        {busy
          ? "Setting up…"
          : alreadySignedIn
            ? "Create your restaurant"
            : "Start your 14-day free trial"}
      </button>
    </form>
  );
}
