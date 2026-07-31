"use client";

import { useState } from "react";

/**
 * Add restaurant #2..N to the owner's account. On success the new
 * venue becomes the active one and the owner lands in the layout
 * editor to draw its floor — same first-run path as signup.
 */

export function AddVenueForm() {
  const [venueName, setVenueName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Europe/Madrid";

      const response = await fetch("/api/venues/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueName: venueName.trim(), timezone }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          reason?: string;
        } | null;

        setError(
          payload?.reason === "venue_limit_reached"
            ? "You've reached your limit — 3 restaurants on trial, or your tier's size. Subscribe or upgrade in Settings → Billing to add more."
            : "Could not add the restaurant. Please try again."
        );
        return;
      }

      // Full navigation so every server component re-renders with the
      // fresh venue cookie.
      window.location.href = "/staff/layout";
    } catch {
      setError("Could not add the restaurant. Please try again.");
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

      {error ? <p className="mtv-signin-error">{error}</p> : null}

      <button type="submit" className="mtv-signin-button" disabled={busy}>
        {busy ? "Creating…" : "Add restaurant"}
      </button>
    </form>
  );
}
