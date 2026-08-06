"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * Reset password — the final step. The user arrives here with a session
 * already established by /auth/confirm (type=recovery), so updateUser
 * is all that's needed. Same 8-character minimum as sign-up.
 */

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    if (password !== confirm) {
      setError(t.auth.passwordsNoMatch);
      return;
    }

    setBusy(true);
    try {
      const supabase = getBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        // "New password should be different" and similar are worth
        // showing verbatim; session-expired gets a clearer path out.
        if (/session/i.test(updateError.message)) {
          router.replace("/staff/forgot-password?error=expired");
          return;
        }
        setError(updateError.message);
        return;
      }

      router.replace("/staff/floor");
      router.refresh();
    } catch {
      setError(t.auth.updatePasswordFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submit(e)}>
      <label className="mtv-field">
        <span>{t.auth.newPassword}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <label className="mtv-field">
        <span>{t.auth.repeatNewPassword}</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      {error ? <p className="mtv-signin-error">{error}</p> : null}

      <button type="submit" className="mtv-signin-button" disabled={busy}>
        {busy ? t.auth.saving : t.auth.saveNewPassword}
      </button>
    </form>
  );
}
