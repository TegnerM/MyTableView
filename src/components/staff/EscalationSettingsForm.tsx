"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EscalationSettings } from "@/lib/staff/floor-types";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

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

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

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
      <h2>{t.settings.escalationTitle}</h2>
      <p className="mtv-settings-intro">{t.settings.escalationIntro}</p>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">{t.settings.giveStaffAtLeast}</span>
        <select
          value={graceSeconds}
          onChange={(event) => setGraceSeconds(Number(event.target.value))}
        >
          {GRACE_OPTIONS.map((option) => (
            <option key={option.seconds} value={option.seconds}>
              {t.settings.minutesN.replace(
                "{count}",
                String(Math.round(option.seconds / 60))
              )}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">{t.settings.graceHelp}</span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">{t.settings.raiseAfter}</span>
        <select
          value={repeatThreshold}
          onChange={(event) => setRepeatThreshold(Number(event.target.value))}
        >
          {REPEAT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {t.settings.pressesN.replace("{count}", String(count))}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">{t.settings.raiseHelp}</span>
      </label>

      <div className="mtv-settings-actions">
        <button
          type="button"
          className="mtv-btn mtv-btn-primary"
          onClick={() => void save()}
          disabled={!dirty || status === "saving"}
        >
          {status === "saving" ? t.settings.saving : t.settings.save}
        </button>

        {status === "saved" ? (
          <span className="mtv-settings-status">{t.settings.saved}</span>
        ) : null}
        {status === "failed" ? (
          <span className="mtv-settings-status mtv-settings-status-error">
            {t.settings.couldNotSave}
          </span>
        ) : null}
      </div>
    </section>
  );
}
