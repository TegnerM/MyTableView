"use client";

import { useEffect, useMemo, useState } from "react";
import { getUiStrings, pickLocale, type LocaleMap } from "@/lib/i18n/guest";
import { formatElapsed } from "@/lib/staff/floor-types";

/**
 * The session summary strip under the request grid. Every value here
 * is REAL: the table and zone from the tag, the time since the visit
 * opened, ticking live. A guest page must never show invented numbers
 * — a guest who sat down five minutes ago and reads "1h 25m" writes
 * the whole product off as fake.
 */

type Props = {
  tableLabel: string;
  areaName: LocaleMap | null;
  openedAt: string;
  guestCount: number | null;
  locale: string;
  venueDefaultLocale: string;
};

export function SessionStatusBar({
  tableLabel,
  areaName,
  openedAt,
  guestCount,
  locale,
  venueDefaultLocale,
}: Props) {
  const strings = useMemo(() => getUiStrings(locale), [locale]);

  // Tick every 30s; render dashes until mounted so server HTML and
  // hydration agree.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const zone = areaName ? pickLocale(areaName, locale, venueDefaultLocale) : "";

  return (
    <div className="mtv-status-bar">
      <div className="mtv-status-item">
        <svg
          className="mtv-status-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="8" width="18" height="4" rx="1"></rect>
          <path d="M5 12v7"></path>
          <path d="M19 12v7"></path>
        </svg>
        <div className="mtv-status-text">
          {guestCount !== null ? (
            <>
              <span className="mtv-status-value">
                {guestCount} {strings.guests}
              </span>
              <span className="mtv-status-label">
                {strings.table} {tableLabel}
              </span>
            </>
          ) : (
            <>
              <span className="mtv-status-value">
                {strings.table} {tableLabel}
              </span>
              {zone ? <span className="mtv-status-label">{zone}</span> : null}
            </>
          )}
        </div>
      </div>

      <div className="mtv-status-item">
        <svg
          className="mtv-status-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <div className="mtv-status-text">
          <span className="mtv-status-value">
            {now === null ? "—" : formatElapsed(openedAt, now)}
          </span>
          <span className="mtv-status-label">{strings.timeAtTable}</span>
        </div>
      </div>

      <div className="mtv-status-item">
        <svg
          className="mtv-status-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <div className="mtv-status-text">
          <span className="mtv-status-value">{strings.thankYou}!</span>
          <span className="mtv-status-label">{strings.appreciateYou}</span>
        </div>
      </div>
    </div>
  );
}
