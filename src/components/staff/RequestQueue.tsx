"use client";

import { useMemo, useState } from "react";
import {
  formatElapsed,
  isRequestEscalated,
  type EscalationSettings,
  type FloorRequest,
  type FloorTable,
} from "@/lib/staff/floor-types";
import { pickLocale } from "@/lib/i18n/guest";

/**
 * The request queue, grouped by table.
 *
 * A guest can tap every button on the guest screen — nothing stops
 * them, and nothing should: the guest side is one tap with no gates.
 * The consequence is handled here instead. Five taps at table 1 produce
 * one row on the waiter's screen, not five, so a curious guest cannot
 * bury a genuinely waiting table further down the queue.
 *
 * Ordering is by the table's OLDEST outstanding request, so a table
 * that has been waiting twelve minutes stays at the top even if someone
 * there just tapped something new.
 */

export type TableGroup = {
  tableId: string;
  tableLabel: string;
  sessionId: string | null;
  requests: FloorRequest[];
  oldestCreatedAt: string;
  hasBillRequest: boolean;
  /** Highest press count across this table's outstanding requests. */
  worstTapCount: number;
  /** True once a repeat ask has also outlived the venue's grace period. */
  escalated: boolean;
};

type Props = {
  tables: FloorTable[];
  locale: string;
  now: number;
  busy: boolean;
  settings: EscalationSettings;
  onAct: (payload: Record<string, unknown>) => Promise<void>;
};

export function RequestQueue({
  tables,
  locale,
  now,
  busy,
  settings,
  onAct,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo<TableGroup[]>(() => {
    const result: TableGroup[] = [];

    for (const table of tables) {
      if (table.requests.length === 0) {
        continue;
      }

      const sorted = [...table.requests].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      result.push({
        tableId: table.id,
        tableLabel: table.label,
        sessionId: table.sessionId,
        requests: sorted,
        oldestCreatedAt: sorted[0].createdAt,
        hasBillRequest: sorted.some((r) => r.closesSession),
        worstTapCount: sorted.reduce(
          (max, r) => Math.max(max, r.tapCount),
          0
        ),
        escalated: sorted.some((r) => isRequestEscalated(r, now, settings)),
      });
    }

    return result.sort(
      (a, b) =>
        new Date(a.oldestCreatedAt).getTime() -
        new Date(b.oldestCreatedAt).getTime()
    );
  }, [tables, now, settings]);

  const totalRequests = groups.reduce(
    (sum, group) => sum + group.requests.length,
    0
  );

  const toggle = (tableId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <section className="mtv-requests-panel">
        <h2>Active requests</h2>
        <p className="mtv-empty">Nothing outstanding.</p>
      </section>
    );
  }

  return (
    <section className="mtv-requests-panel">
      <h2>
        Active requests ({groups.length}{" "}
        {groups.length === 1 ? "table" : "tables"}, {totalRequests})
      </h2>

      <ul className="mtv-queue">
        {groups.map((group) => {
          const isOpen = expanded.has(group.tableId);
          const ageSeconds =
            (now - new Date(group.oldestCreatedAt).getTime()) / 1000;
          const repeated = group.escalated;

          // Asking twice outranks the clock: a table that pressed again
          // after ninety seconds is more annoyed than one waiting
          // quietly for six minutes.
          const tone = repeated
            ? "overdue"
            : ageSeconds >= 600
              ? "overdue"
              : ageSeconds >= 300
                ? "waiting"
                : "good";

          const summary = group.requests
            .map((r) => pickLocale(r.requestLabel, locale))
            .join(" · ");

          return (
            <li
              key={group.tableId}
              className="mtv-queue-group"
              data-tone={tone}
              data-bill={group.hasBillRequest ? "true" : "false"}
              data-repeated={repeated ? "true" : "false"}
            >
              <button
                type="button"
                className="mtv-queue-head"
                onClick={() => toggle(group.tableId)}
                aria-expanded={isOpen}
              >
                <span className="mtv-queue-table">
                  Table {group.tableLabel}
                  {group.requests.length > 1 ? (
                    <span className="mtv-queue-count">
                      {group.requests.length}
                    </span>
                  ) : null}
                </span>

                <span className="mtv-queue-summary">
                  {repeated ? (
                    <span className="mtv-queue-repeat">
                      asked {group.worstTapCount}×
                    </span>
                  ) : null}
                  {summary}
                </span>

                <span className="mtv-queue-age">
                  {formatElapsed(group.oldestCreatedAt, now)}
                </span>

                <span className="mtv-queue-caret" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {/* One tap clears the whole table, which is what actually
                  happens: the waiter walks over once and deals with
                  everything. Individual control stays available when
                  expanded. */}
              <div className="mtv-queue-actions">
                <button
                  type="button"
                  className="mtv-btn mtv-btn-small mtv-btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void onAct({
                      action: "fulfil_table",
                      tableId: group.tableId,
                    })
                  }
                >
                  Done all
                </button>
              </div>

              {isOpen ? (
                <ul className="mtv-queue-items">
                  {group.requests.map((request) => (
                    <li key={request.id} data-state={request.state}>
                      <span className="mtv-queue-item-name">
                        {pickLocale(request.requestLabel, locale)}
                        {isRequestEscalated(request, now, settings) ? (
                          <span className="mtv-queue-repeat">
                            {request.tapCount}×
                          </span>
                        ) : null}
                      </span>
                      <span className="mtv-queue-item-age">
                        {formatElapsed(request.createdAt, now)}
                      </span>
                      <span className="mtv-queue-item-actions">
                        {request.state === "open" ? (
                          <button
                            type="button"
                            className="mtv-btn mtv-btn-small"
                            disabled={busy}
                            onClick={() =>
                              void onAct({
                                action: "acknowledge",
                                requestId: request.id,
                              })
                            }
                          >
                            Seen
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mtv-btn mtv-btn-small"
                          disabled={busy}
                          onClick={() =>
                            void onAct({
                              action: "fulfil",
                              requestId: request.id,
                            })
                          }
                        >
                          Done
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
