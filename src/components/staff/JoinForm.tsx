"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * Accept a staff invite.
 *
 * New people choose a name and password; the server creates the
 * account (email pre-confirmed by the click) and this form signs them
 * straight in — a waiter should go from email to live floor in one
 * screen. If the email already has an account, the form flips to a
 * sign-in step and retries the accept with the proven session.
 */

type Props = {
  token: string;
  email: string;
  suggestedName: string;
  alreadySignedInMatch: boolean;
};

export function JoinForm({
  token,
  email,
  suggestedName,
  alreadySignedInMatch,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(suggestedName);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"join" | "signin">("join");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const acceptViaSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
          reason?: string;
        } | null;
        setError(
          payload?.reason === "invite_invalid"
            ? t.join.inviteInvalid
            : (payload?.detail ?? t.join.joinFailed)
        );
        return;
      }
      router.replace("/staff/floor");
      router.refresh();
    } catch {
      setError(t.join.joinFailed);
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, displayName, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
          reason?: string;
        } | null;

        if (payload?.reason === "account_exists") {
          setMode("signin");
          setPassword("");
          return;
        }
        setError(
          payload?.reason === "invite_invalid"
            ? t.join.inviteInvalid
            : (payload?.detail ?? t.join.joinFailed)
        );
        return;
      }

      // Account created server-side; sign in with the chosen password.
      const supabase = getBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Account exists and staff row is written; the normal sign-in
        // page will finish the job.
        router.replace("/staff/sign-in");
        return;
      }

      router.replace("/staff/floor");
      router.refresh();
    } catch {
      setError(t.join.joinFailed);
    } finally {
      setBusy(false);
    }
  };

  const submitSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = getBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      // Session proven — accept the invite with it.
      await acceptViaSession();
    } catch {
      setError(t.auth.signInFailed);
    } finally {
      setBusy(false);
    }
  };

  if (alreadySignedInMatch) {
    return (
      <div className="mtv-signin-form">
        {error ? <p className="mtv-signin-error">{error}</p> : null}
        <button
          type="button"
          className="mtv-signin-button"
          disabled={busy}
          onClick={() => void acceptViaSession()}
        >
          {busy ? t.join.joining : t.join.joinTeam}
        </button>
      </div>
    );
  }

  if (mode === "signin") {
    return (
      <form className="mtv-signin-form" onSubmit={(e) => void submitSignIn(e)}>
        <p className="mtv-signin-notice">
          <strong>{email}</strong>
          {t.join.accountExistsAfter}
        </p>
        <label className="mtv-field">
          <span>{t.auth.password}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="mtv-signin-error">{error}</p> : null}
        <button type="submit" className="mtv-signin-button" disabled={busy}>
          {busy ? t.auth.signingIn : t.join.signInAndJoin}
        </button>
      </form>
    );
  }

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submitJoin(e)}>
      <label className="mtv-field">
        <span>{t.join.yourNameTeam}</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          minLength={2}
          maxLength={60}
          required
        />
      </label>

      <label className="mtv-field">
        <span>{t.join.choosePassword}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      {error ? <p className="mtv-signin-error">{error}</p> : null}

      <button type="submit" className="mtv-signin-button" disabled={busy}>
        {busy ? t.join.joining : t.join.joinTeam}
      </button>
    </form>
  );
}
