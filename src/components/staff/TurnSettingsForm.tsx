"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes, type TurnSettings } from "@/lib/staff/floor-types";

/**
 * Table-time allowances, editable by the venue.
 *
 * A service policy like the escalation thresholds: most rooms turn a
 * table in 1.5–2 hours, and a large party is expected to stay 3–4.
 * The floor uses these to flag tables running over their time.
 */

type Props = {
  current: TurnSettings;
};

const STANDARD_OPTIONS = [75, 90, 105, 120, 150];
const LARGE_OPTIONS = [150, 180, 210, 240, 300];
const SIZE_OPTIONS = [4, 5, 6, 8, 10];

export function TurnSettingsForm({ current }: Props) {
  const router = useRouter();
  const [standardMinutes, setStandardMinutes] = useState(
    current.standardMinutes
  );
  const [largeMinutes, setLargeMinutes] = useState(current.largeMinutes);
  const [largePartySize, setLargePartySize] = useState(current.largePartySize);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle"
  );

  const save = async () => {
    setStatus("saving");

    try {
      const response = await fetch("/api/staff/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "turns",
          standardMinutes,
          largeMinutes,
          largePartySize,
        }),
      });

      const payload = (await response.json()) as { ok: boolean };
      setStatus(payload.ok ? "saved" : "failed");

      if (payload.ok) {
        router.refresh();
        window.setTimeout(() => setStatus("idle"), 2500);
      }
    } catch {
      setStatus("failed");
    }
  };

  const dirty =
    standardMinutes !== current.standardMinutes ||
    largeMinutes !== current.largeMinutes ||
    largePartySize !== current.largePartySize;

  return (
    <section className="mtv-settings-card">
      <h2>Table time</h2>
      <p className="mtv-settings-intro">
        How long a table belongs to one party. The floor flags tables that
        run over, so whoever plans the next seating sees it coming — it
        never rushes a guest on its own.
      </p>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">A table is allocated</span>
        <select
          value={standardMinutes}
          onChange={(event) => setStandardMinutes(Number(event.target.value))}
        >
          {STANDARD_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatMinutes(minutes)}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">
          The normal allowance for a party, from the moment they are
          seated.
        </span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">A large party is allocated</span>
        <select
          value={largeMinutes}
          onChange={(event) => setLargeMinutes(Number(event.target.value))}
        >
          {LARGE_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatMinutes(minutes)}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">
          Big groups order in rounds and stay longer — usually three to
          four hours.
        </span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">A party counts as large from</span>
        <select
          value={largePartySize}
          onChange={(event) => setLargePartySize(Number(event.target.value))}
        >
          {SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} guests
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">
          Uses the guest count the waiter enters on the table — without a
          count, the normal allowance applies.
        </span>
      </label>

      <div className="mtv-settings-actions">
        <button
          type="button"
          className="mtv-btn mtv-btn-primary"
          onClick={() => void save()}
          disabled={!dirty || status === "saving"}
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>

        {status === "saved" ? (
          <span className="mtv-settings-status">Saved</span>
        ) : null}
        {status === "failed" ? (
          <span className="mtv-settings-status mtv-settings-status-error">
            Could not save
          </span>
        ) : null}
      </div>
    </section>
  );
}
