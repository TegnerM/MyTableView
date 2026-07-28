"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  isEscalated,
  formatElapsed,
  type EscalationSettings,
  type FloorTable,
} from "@/lib/staff/floor-types";

/**
 * Escalation alerts.
 *
 * A guest pressing the same button twice has decided nobody is coming.
 * That gets raised here, separately from the ordinary queue, because by
 * the time it shows up in a report the table has already been annoyed.
 *
 * On signalling:
 *
 *   Vibration works on Android and does nothing on iOS — Safari has
 *   never supported the API. A beep is worse than useless in the venues
 *   this product targets: a Spanish beach bar at 22:00 drowns anything
 *   discreet, and anything loud enough to hear would carry to the
 *   guests.
 *
 *   So the reliable channel is visual, on a screen someone is already
 *   watching — the tablet at the pass, or a handheld in the waiter's
 *   hand during service. Vibration is a bonus where the platform allows
 *   it, never the mechanism.
 *
 * One buzz per escalation, not per tap. A frustrated guest pressing five
 * times must not turn the handheld into an alarm the waiter mutes.
 */

type Props = {
  tables: FloorTable[];
  now: number;
  /** Managers get the alert. Waiters see the red table but no banner. */
  canSeeAlerts: boolean;
  settings: EscalationSettings;
  onSelectTable: (tableId: string) => void;
};

export function EscalationAlerts({
  tables,
  now,
  canSeeAlerts,
  settings,
  onSelectTable,
}: Props) {
  // Recomputed on the tick, because a table crosses the grace period on
  // the clock rather than on any event.
  const escalated = useMemo(
    () => tables.filter((table) => isEscalated(table, now, settings)),
    [tables, now, settings]
  );

  // Which tables have already buzzed, so a second, third and fourth tap
  // at the same table stay silent.
  const buzzed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canSeeAlerts) {
      return;
    }

    const current = new Set(escalated.map((table) => table.id));

    // Forget tables that have been dealt with, so a genuinely new
    // escalation later in the shift buzzes again.
    for (const id of buzzed.current) {
      if (!current.has(id)) {
        buzzed.current.delete(id);
      }
    }

    const fresh = escalated.filter((table) => !buzzed.current.has(table.id));

    if (fresh.length === 0) {
      return;
    }

    for (const table of fresh) {
      buzzed.current.add(table.id);
    }

    // Android only. Silently absent on iOS, which is why this is never
    // the primary signal.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch {
        // Blocked by the browser, or the device has no motor.
      }
    }
  }, [escalated, canSeeAlerts]);

  if (!canSeeAlerts || escalated.length === 0) {
    return null;
  }

  return (
    <section className="mtv-escalation" role="alert" aria-live="assertive">
      <div className="mtv-escalation-head">
        <span className="mtv-escalation-icon" aria-hidden="true">
          !
        </span>
        <span>
          {escalated.length === 1
            ? "1 table has asked twice"
            : `${escalated.length} tables have asked twice`}
        </span>
      </div>

      <ul className="mtv-escalation-list">
        {escalated.map((table) => {
          const worst = table.requests.reduce(
            (max, request) => Math.max(max, request.tapCount),
            0
          );
          const oldest = table.requests.reduce(
            (min, request) =>
              !min || request.createdAt < min ? request.createdAt : min,
            ""
          );

          return (
            <li key={table.id}>
              <button
                type="button"
                onClick={() => onSelectTable(table.id)}
                className="mtv-escalation-item"
              >
                <span className="mtv-escalation-table">
                  Table {table.label}
                </span>
                <span className="mtv-escalation-detail">
                  asked {worst}×
                </span>
                <span className="mtv-escalation-age">
                  {oldest ? formatElapsed(oldest, now) : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
