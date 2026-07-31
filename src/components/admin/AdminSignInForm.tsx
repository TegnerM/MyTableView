"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Admin sign-in. Deliberately terse on failure: whether the password
 * was wrong, the user doesn't exist, or the user isn't an admin, the
 * message is the same — this form confirms nothing to outsiders.
 * After password sign-in the server decides where the session stands
 * (enrollment, TOTP challenge, or in), via a full navigation to /admin.
 */

export function AdminSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = getBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Sign-in failed.");
        return;
      }

      window.location.href = "/admin";
    } catch {
      setError("Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error ? <p className="mtv-adminauth-error">{error}</p> : null}

      <button type="submit" className="mtv-adminauth-button" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
