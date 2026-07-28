"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EscalationSettings } from "@/lib/staff/floor-types";

/**
 * Escalation thresholds, editable by the venue.
 *
 * These numbers are a service policy, not a technical constant. A
 * fine-dining room where a waiter is never more than a few steps away
 * has different tolerances from a beach bar at 22:00 with two staff and
 * a full terrace, and the owner is the one who knows which they are.
 *
 * Managers and owners only — a waiter cannot raise the threshold that
 * measures them.
 */

type Props = {
  current: EscalationSettings;
};

const GRACE_OPTIONS = [
  { label: "2 minutes", seconds: 120 },
  { label: "3 minutes", seconds: 180 },
  { label: "5 minutes", seconds: 300 },
  { label: "8 minutes", seconds: 480 },
  { label: "10 minutes", seconds: 600 },
];

const REPEAT_OPTIONS = [2, 3, 4];

export function EscalationSettingsForm({ current }: Props) {
  const router = useRouter();
  const [graceSeconds, setGraceSeconds] = useState(current.graceSeconds);
  const [repeatThreshold, setRepeatThreshold] = useState(
    current.repeatThreshold
  );
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
          action: "escalation",
          graceSeconds,
          repeatThreshold,
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
    graceSeconds !== current.graceSeconds ||
    repeatThreshold !== current.repeatThreshold;

  return (
    <section className="mtv-settings-card">
      <h2>When to raise a table</h2>
      <p className="mtv-settings-intro">
        A guest pressing the same button again is telling you nobody came.
        These settings decide when that becomes your problem rather than
        theirs — staff should not be flagged for a guest who is simply
        impatient.
      </p>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">Give staff at least</span>
        <select
          value={graceSeconds}
          onChange={(event) => setGraceSeconds(Number(event.target.value))}
        >
          {GRACE_OPTIONS.map((option) => (
            <option key={option.seconds} value={option.seconds}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">
          Repeat presses before this are recorded, but nothing turns red
          and nobody is alerted.
        </span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">Raise after</span>
        <select
          value={repeatThreshold}
          onChange={(event) => setRepeatThreshold(Number(event.target.value))}
        >
          {REPEAT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count} presses
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">
          How many times a guest asks for the same thing before the table
          is raised to a manager.
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
