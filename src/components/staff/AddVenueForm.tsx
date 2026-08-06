"use client";

import { useEffect, useState } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * Add restaurant #2..N to the owner's account. On success the new
 * venue becomes the active one and the owner lands in the layout
 * editor to draw its floor — same first-run path as signup.
 */

export function AddVenueForm() {
  const [venueName, setVenueName] = useState("");
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
            ? t.venue.limitReached
            : t.venue.addFailed
        );
        return;
      }

      // Full navigation so every server component re-renders with the
      // fresh venue cookie.
      window.location.href = "/staff/layout";
    } catch {
      setError(t.venue.addFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mtv-signin-form" onSubmit={(e) => void submit(e)}>
      <label className="mtv-field">
        <span>{t.auth.restaurantName}</span>
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
        {busy ? t.venue.creating : t.venue.addRestaurant}
      </button>
    </form>
  );
}
