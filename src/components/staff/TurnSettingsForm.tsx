"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes, type TurnSettings } from "@/lib/staff/floor-types";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

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
      <h2>{t.settings.turnTitle}</h2>
      <p className="mtv-settings-intro">{t.settings.turnIntro}</p>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">{t.settings.tableAllocated}</span>
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
        <span className="mtv-settings-help">{t.settings.standardHelp}</span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">{t.settings.largeAllocated}</span>
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
        <span className="mtv-settings-help">{t.settings.largeHelp}</span>
      </label>

      <label className="mtv-settings-field">
        <span className="mtv-settings-label">{t.settings.largeFrom}</span>
        <select
          value={largePartySize}
          onChange={(event) => setLargePartySize(Number(event.target.value))}
        >
          {SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {t.settings.guestsN.replace("{count}", String(size))}
            </option>
          ))}
        </select>
        <span className="mtv-settings-help">{t.settings.sizeHelp}</span>
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
