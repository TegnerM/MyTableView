"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import {
  deriveTableStatus,
  formatElapsed,
  formatMinutes,
  turnAllowanceMinutes,
  type FloorState,
  type FloorTable,
  type TableStatus,
  type TurnSettings,
} from "@/lib/staff/floor-types";
import { RequestQueue } from "@/components/staff/RequestQueue";
import { EscalationAlerts } from "@/components/staff/EscalationAlerts";
import { FloorPlan } from "@/components/staff/FloorPlan";
import { StaffShell } from "@/components/staff/StaffShell";
import { pickLocale } from "@/lib/i18n/guest";
import {
  getStaffStrings,
  readStaffLocale,
  type StaffStrings,
} from "@/lib/i18n/staff";
import { readStoredZone, storeZone } from "@/lib/staff/zone-memory";

/**
 * The live floor — the screen a waiter lives on during service.
 *
 * Light theme on CSS variables (a dark "night service" variant can be
 * added later by swapping the variable block). Dark sidebar carries
 * only destinations that exist; it grows as modules ship.
 *
 * Two things keep this current:
 *
 *   - A Supabase realtime subscription on requests and sessions. RLS
 *     filters the stream, so a waiter only receives their own venue's
 *     events. Any change triggers a server refresh rather than patching
 *     local state, because a partial patch is how floor views drift out
 *     of sync with reality.
 *
 *   - A one-second tick, so waiting timers advance without any event
 *     at all. A table crossing ten minutes has to turn red on its own.
 */

/** Per-device Floor/List choice, like the theme key below it. */
const VIEW_KEY = "mtv-floor-view";

type Props = {
  initialState: FloorState;
  locale: string;
  /** Server-stamped clock: keeps SSR text and hydration identical. */
  initialNow: number;
};

export function LiveFloor({ initialState, locale, initialNow }: Props) {
  const router = useRouter();

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [staffLocale, setStaffLocale] = useState("en");
  useEffect(() => {
    setStaffLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(staffLocale);

  // The floor renders straight from props — a state snapshot here would
  // freeze the mount-time data and discard every refresh.
  const state = initialState;

  const [now, setNow] = useState(initialNow);
  const [selected, setSelected] = useState<string | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combinePicks, setCombinePicks] = useState<string[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(
    () => initialState.areas[0]?.id ?? null
  );

  // Floor ⇄ List. Remembered per device like the theme: a waiter's
  // phone that picked List opens in List every shift; the wall tablet
  // stays on the plan. SSR always says plan; hydration restores.
  const [view, setView] = useState<"plan" | "list">("plan");
  // List-only zone filter; null = all zones in one scroll — the thing
  // the plan can't do.
  const [listZoneId, setListZoneId] = useState<string | null>(null);
  const [showFree, setShowFree] = useState(false);
  const [busy, setBusy] = useState(false);

  // Connection watchdog. A floor that has lost its connection looks
  // exactly like a calm floor unless it says so — the most dangerous
  // failure mode this screen has. Data is never lost during an outage
  // (requests land in the cloud with server timestamps); only this
  // screen's view goes stale, so the job is: detect, show, catch up.
  const [connection, setConnection] = useState<"online" | "offline">("online");
  const [lastSyncAt, setLastSyncAt] = useState<number>(() => Date.now());
  const [actError, setActError] = useState(false);
  const connectionRef = useRef<"online" | "offline">("online");

  // Every fresh server payload counts as a sync — this is the time the
  // offline banner shows as "floor as of ...".
  useEffect(() => {
    setLastSyncAt(Date.now());
  }, [initialState]);

  // Timers must advance with no server event.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // A freshly-mounted floor reconciles against the server once,
  // unconditionally. Arriving via the browser's back button (or a
  // restored tab) serves a payload from the client router cache that
  // predates whatever was just done in the layout editor — this is the
  // "tables missing until I hit refresh" path. One background refresh
  // on mount closes it for every way of arriving here.
  useEffect(() => {
    router.refresh();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The layout editor remembers the same zone (per venue, per device),
  // so jumping between the two never lands on a different room.
  useEffect(() => {
    const stored = readStoredZone(initialState.identity.venueId);
    if (stored && initialState.areas.some((zone) => zone.id === stored)) {
      setActiveZoneId(stored);
    }
    // Mount only — after that the user's taps own the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "list") {
        setView("list");
      }
    } catch {
      // Private browsing: live with the plan.
    }
  }, []);

  const switchView = useCallback((next: "plan" | "list") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Best effort only.
    }
  }, []);

  // Coalesce bursts: a party of four tapping at once should cause one
  // refresh, not four.
  const refreshTimer = useRef<number | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) {
      return;
    }
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 250);
  }, [router]);

  // The guarantee: a steady 15-second poll whenever the tab is
  // visible. Realtime makes updates feel instant when everything is
  // healthy; this makes sure the floor is never more than 15 seconds
  // stale when anything isn't. Belt, then braces.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) scheduleRefresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [scheduleRefresh]);

  const markOnline = useCallback(() => {
    // Coming back from an outage means the screen is stale by however
    // long the outage lasted — reconcile immediately.
    if (connectionRef.current === "offline") {
      scheduleRefresh();
    }
    connectionRef.current = "online";
    setConnection("online");
  }, [scheduleRefresh]);

  const markOffline = useCallback(() => {
    connectionRef.current = "offline";
    setConnection("offline");
  }, []);

  // Three independent detectors, because each one misses something:
  // the browser's own online/offline events (instant but only sees the
  // local link), the realtime channel status (sees the socket die), and
  // a heartbeat fetch (catches a dead route the other two can't see —
  // wifi up, internet down).
  useEffect(() => {
    const onOnline = () => markOnline();
    const onOffline = () => markOffline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const beat = window.setInterval(() => {
      void fetch("/api/staff/ping", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      })
        .then((response) => (response.ok ? markOnline() : markOffline()))
        .catch(() => markOffline());
    }, 25_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(beat);
    };
  }, [markOnline, markOffline]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const venueId = initialState.identity.venueId;

    let channels: ReturnType<typeof supabase.channel>[] = [];
    let cancelled = false;

    // ONE CHANNEL PER TABLE, deliberately. Several filtered
    // postgres_changes listeners multiplexed onto a single channel is
    // the documented-fragile pattern in the Supabase client — binding
    // mismatches drop events without any error. Separate channels keep
    // each subscription's filter unambiguous.
    //
    // session_tables carries no venue column, so it subscribes
    // unfiltered; RLS still scopes what the socket may deliver.
    const specs: { table: string; filter?: string }[] = [
      { table: "requests", filter: `venue_id=eq.${venueId}` },
      { table: "sessions", filter: `venue_id=eq.${venueId}` },
      { table: "session_tables" },
      // The floor follows layout and zone edits too.
      { table: "tables", filter: `venue_id=eq.${venueId}` },
      { table: "areas", filter: `venue_id=eq.${venueId}` },
    ];

    const setup = async () => {
      // THE FIX for events silently never arriving: postgres_changes
      // filters every event through RLS using the claims the socket
      // presented when the channel JOINED. This project revokes anon —
      // so a channel that joins before the staff session has loaded
      // subscribes cleanly and then receives nothing, forever, with no
      // error. Hand the staff token to the socket first, then join.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await supabase.realtime.setAuth(session.access_token);
      } else {
        console.debug("floor realtime: no auth session before subscribe");
      }

      if (cancelled) return;

      channels = specs.map(({ table, filter }) =>
        supabase
          .channel(`floor:${venueId}:${table}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              ...(filter ? { filter } : {}),
            },
            (payload) => {
              // Cheap breadcrumb: when "the floor doesn't update", the
              // console shows whether events arrive at all.
              console.debug(`floor realtime: ${table}`, payload.eventType);
              scheduleRefresh();
            }
          )
          .subscribe((status, err) => {
            console.debug(
              `floor realtime: ${table} channel ${status}`,
              err ?? ""
            );
            // The socket's own verdict on the connection. CLOSED also
            // fires on unmount, where the setState is a harmless no-op.
            if (status === "SUBSCRIBED") {
              markOnline();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              markOffline();
            }
          })
      );
    };

    void setup();

    return () => {
      cancelled = true;
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [initialState.identity.venueId, scheduleRefresh, markOnline, markOffline]);

  // The same protection when the floor regains focus after time in
  // another tab or on a sleeping tablet: realtime sockets can have died
  // quietly in the background.
  useEffect(() => {
    const onWake = () => {
      if (!document.hidden) scheduleRefresh();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [scheduleRefresh]);

  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const response = await fetch("/api/staff/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          // The server answered but refused — not a connectivity
          // problem, but the tap still didn't land. Say so.
          setActError(true);
          return;
        }

        setActError(false);
        router.refresh();
      } catch {
        // No answer at all: the action was lost in transit, and the
        // connection is evidently down.
        setActError(true);
        markOffline();
      } finally {
        setBusy(false);
      }
    },
    [router, markOffline]
  );

  const statuses = useMemo(() => {
    const map = new Map<string, TableStatus>();
    for (const table of state.tables) {
      map.set(table.id, deriveTableStatus(table, now, state.escalation));
    }
    return map;
  }, [state.tables, now, state.escalation]);

  const counts = useMemo(() => {
    let good = 0;
    let waiting = 0;
    let overdue = 0;
    let occupied = 0;

    for (const table of state.tables) {
      const status = statuses.get(table.id) ?? "clear";
      if (status !== "clear") occupied += 1;
      if (status === "good") good += 1;
      if (status === "waiting") waiting += 1;
      if (status === "overdue") overdue += 1;
    }

    return { good, waiting, overdue, occupied, total: state.tables.length };
  }, [state.tables, statuses]);

  const activeZone = useMemo(
    () =>
      state.areas.find((zone) => zone.id === activeZoneId) ??
      state.areas[0] ??
      null,
    [state.areas, activeZoneId]
  );

  // Tables with no zone still have to appear somewhere, so they fall
  // into the first zone rather than vanishing from the floor.
  const zoneTables = useMemo(() => {
    if (!activeZone) {
      return [];
    }
    const isFirst = state.areas[0]?.id === activeZone.id;
    return state.tables.filter(
      (table) =>
        table.areaId === activeZone.id || (isFirst && table.areaId === null)
    );
  }, [state.tables, state.areas, activeZone]);

  // Table-centric list: worst first. Within overdue/waiting the
  // longest-waiting request wins; within good the longest-seated party
  // sits on top (closest to needing something). Free tables collapse
  // into one expandable row so service stays the focus.
  const listTables = useMemo(() => {
    const oldestRequestAt = (table: FloorTable): number => {
      let oldest = Number.POSITIVE_INFINITY;
      for (const request of table.requests) {
        const t = new Date(request.createdAt).getTime();
        if (t < oldest) oldest = t;
      }
      return oldest;
    };

    const inZone = (table: FloorTable) => {
      if (listZoneId === null) return true;
      const isFirst = state.areas[0]?.id === listZoneId;
      return table.areaId === listZoneId || (isFirst && table.areaId === null);
    };

    const rank: Record<TableStatus, number> = {
      overdue: 0,
      waiting: 1,
      good: 2,
      clear: 3,
    };

    const rows = state.tables
      .filter(inZone)
      .map((table) => ({ table, status: statuses.get(table.id) ?? "clear" }));

    const occupied = rows
      .filter((row) => row.status !== "clear")
      .sort((a, b) => {
        const byRank = rank[a.status] - rank[b.status];
        if (byRank !== 0) return byRank;
        if (a.status === "good") {
          return (a.table.sessionOpenedAt ?? "").localeCompare(
            b.table.sessionOpenedAt ?? ""
          );
        }
        return oldestRequestAt(a.table) - oldestRequestAt(b.table);
      });

    const free = rows
      .filter((row) => row.status === "clear")
      .sort((a, b) =>
        a.table.label.localeCompare(b.table.label, undefined, { numeric: true })
      );

    return { occupied, free };
  }, [state.tables, state.areas, statuses, listZoneId]);

  const selectedTable = selected
    ? (state.tables.find((t) => t.id === selected) ?? null)
    : null;

  const toggleCombinePick = (tableId: string) => {
    setCombinePicks((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId]
    );
  };

  const confirmCombine = async () => {
    if (combinePicks.length < 2) return;
    const anchor = combinePicks[0];
    await act({ action: "combine", tableIds: combinePicks });
    setCombineMode(false);
    setCombinePicks([]);
    // Straight into the party: the next thing a waiter does after
    // pushing tables together is enter how many guests sat down. The
    // detail panel opens on the combined table so that takes one tap,
    // not a hunt.
    setSelected(anchor);
  };

  const isManager =
    state.identity.role === "owner" || state.identity.role === "manager";

  return (
    <StaffShell
      active="overview"
      displayName={state.identity.displayName}
      role={state.identity.role}
      venueId={state.identity.venueId}
      venues={state.identity.venues}
      badge={
        <span className="mtv-live-badge" data-state={connection}>
          {connection === "online" ? t.floor.live : t.floor.offline}
        </span>
      }
    >
        <header className="mtv-greeting-row">
          <h1 className="mtv-greeting">{state.identity.venueName}</h1>
        </header>

        {connection === "offline" ? (
          <div className="mtv-offline-banner" role="alert">
            <strong>{t.floor.offlineTitle}</strong>{" "}
            {t.floor.offlineBody.replace(
              "{time}",
              new Date(lastSyncAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            )}
          </div>
        ) : null}

        {actError ? (
          <div className="mtv-act-error" role="alert">
            <span>{t.floor.actError}</span>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => setActError(false)}
            >
              {t.floor.dismiss}
            </button>
          </div>
        ) : null}

        <EscalationAlerts
          tables={state.tables}
          now={now}
          canSeeAlerts={isManager}
          settings={state.escalation}
          onSelectTable={setSelected}
        />

        <div className="mtv-stat-row">
          <Stat
            icon={<TablesIcon />}
            label={t.floor.statOccupied}
            value={`${counts.occupied}/${counts.total}`}
          />
          <Stat
            icon={<CheckIcon />}
            label={t.floor.statGood}
            value={counts.good}
            tone="good"
          />
          <Stat
            icon={<WaitIcon />}
            label={t.floor.statWaiting}
            value={counts.waiting}
            tone="waiting"
          />
          <Stat
            icon={<AlertIcon />}
            label={t.floor.statOverdue}
            value={counts.overdue}
            tone="overdue"
          />
        </div>

        <div className="mtv-floor-body">
          <section className="mtv-floor-plan-panel">
            <div className="mtv-panel-head">
              <h2>{view === "plan" ? t.floor.floorPlan : t.floor.tableListTitle}</h2>
              <div className="mtv-view-toggle" role="tablist" aria-label={t.floor.floorViewAria}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "plan"}
                  data-active={view === "plan" ? "true" : "false"}
                  onClick={() => switchView("plan")}
                >
                  {t.floor.floorTab}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "list"}
                  data-active={view === "list" ? "true" : "false"}
                  onClick={() => switchView("list")}
                >
                  {t.floor.listTab}
                </button>
              </div>
              {view === "list" ? null : combineMode ? (
                <div className="mtv-combine-controls">
                  <span>
                    {t.floor.selectedCount.replace(
                      "{count}",
                      String(combinePicks.length)
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void confirmCombine()}
                    disabled={combinePicks.length < 2 || busy}
                    className="mtv-btn mtv-btn-primary"
                  >
                    {t.floor.combine}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCombineMode(false);
                      setCombinePicks([]);
                    }}
                    className="mtv-btn"
                  >
                    {t.floor.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCombineMode(true)}
                  className="mtv-btn"
                >
                  {t.floor.combineTables}
                </button>
              )}
            </div>

            {state.areas.length > 1 ? (
              view === "plan" ? (
                <div className="mtv-zone-tabs" role="tablist">
                  {state.areas.map((zone, index) => (
                    <button
                      key={zone.id}
                      type="button"
                      role="tab"
                      aria-selected={activeZoneId === zone.id}
                      className="mtv-zone-tab"
                      data-active={activeZoneId === zone.id ? "true" : "false"}
                      onClick={() => {
                        setActiveZoneId(zone.id);
                        storeZone(state.identity.venueId, zone.id);
                      }}
                    >
                      {pickLocale(zone.name, locale) ||
                        t.floor.zoneFallback.replace("{n}", String(index + 1))}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mtv-zone-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listZoneId === null}
                    className="mtv-zone-tab"
                    data-active={listZoneId === null ? "true" : "false"}
                    onClick={() => setListZoneId(null)}
                  >
                    {t.floor.allZones}
                  </button>
                  {state.areas.map((zone, index) => (
                    <button
                      key={zone.id}
                      type="button"
                      role="tab"
                      aria-selected={listZoneId === zone.id}
                      className="mtv-zone-tab"
                      data-active={listZoneId === zone.id ? "true" : "false"}
                      onClick={() => setListZoneId(zone.id)}
                    >
                      {pickLocale(zone.name, locale) ||
                        t.floor.zoneFallback.replace("{n}", String(index + 1))}
                    </button>
                  ))}
                </div>
              )
            ) : null}

            {view === "list" ? (
              <TableList
                rows={listTables.occupied}
                freeRows={listTables.free}
                showFree={showFree}
                onToggleFree={() => setShowFree((value) => !value)}
                locale={locale}
                t={t}
                now={now}
                selectedId={selected}
                onSelect={(tableId) =>
                  setSelected(tableId === selected ? null : tableId)
                }
              />
            ) : activeZone ? (
              <FloorPlan
                zone={{
                  id: activeZone.id,
                  widthM: activeZone.widthM,
                  depthM: activeZone.depthM,
                }}
                tables={zoneTables}
                now={now}
                settings={state.escalation}
                turns={state.turns}
                markers
                selectedTableId={selected}
                pickedTableIds={combinePicks}
                onSelectTable={(tableId) =>
                  combineMode
                    ? toggleCombinePick(tableId)
                    : setSelected(tableId === selected ? null : tableId)
                }
              />
            ) : (
              <p className="mtv-empty">{t.floor.noZones}</p>
            )}

            <Legend t={t} />
          </section>

          <aside className="mtv-side-panel">
            <RequestQueue
              tables={state.tables}
              locale={locale}
              now={now}
              busy={busy}
              settings={state.escalation}
              onAct={act}
            />

            {selectedTable ? (
              <TableDetail
                key={selectedTable.id}
                table={selectedTable}
                now={now}
                busy={busy}
                t={t}
                turns={state.turns}
                onAct={act}
                onClose={() => setSelected(null)}
              />
            ) : null}
          </aside>
        </div>
    </StaffShell>
  );
}

function TableList({
  rows,
  freeRows,
  showFree,
  onToggleFree,
  locale,
  t,
  now,
  selectedId,
  onSelect,
}: {
  rows: { table: FloorTable; status: TableStatus }[];
  freeRows: { table: FloorTable; status: TableStatus }[];
  showFree: boolean;
  onToggleFree: () => void;
  locale: string;
  t: StaffStrings;
  now: number;
  selectedId: string | null;
  onSelect: (tableId: string) => void;
}) {
  return (
    <div className="mtv-table-list">
      {rows.length === 0 ? (
        <p className="mtv-empty">{t.floor.noTablesSeated}</p>
      ) : null}

      {rows.map(({ table, status }) => {
        const oldest =
          table.requests.length > 0
            ? table.requests.reduce(
                (min, request) =>
                  request.createdAt < min ? request.createdAt : min,
                table.requests[0].createdAt
              )
            : null;
        const what =
          table.requests.length > 0
            ? table.requests
                .map(
                  (request) =>
                    pickLocale(request.requestLabel, locale) ||
                    request.requestCode
                )
                .join(" · ")
            : t.floor.noOpenRequests;
        const askedAgain = table.requests.some(
          (request) => request.tapCount >= 2
        );

        return (
          <button
            key={table.id}
            type="button"
            className="mtv-list-row"
            data-status={status}
            data-selected={table.id === selectedId ? "true" : "false"}
            onClick={() => onSelect(table.id)}
          >
            <span className="mtv-list-no">{table.label}</span>
            <span className="mtv-list-meta">
              <span className="mtv-list-zone">
                {pickLocale(table.areaName ?? {}, locale)}
                {askedAgain ? (
                  <span className="mtv-list-again">{t.floor.askedAgain}</span>
                ) : null}
              </span>
              <span className="mtv-list-what">{what}</span>
            </span>
            <span className="mtv-list-time">
              {oldest ? (
                <>
                  <b>{formatElapsed(oldest, now)}</b>
                  <span>{t.floor.waiting}</span>
                </>
              ) : table.sessionOpenedAt ? (
                <>
                  <b>{formatElapsed(table.sessionOpenedAt, now)}</b>
                  <span>{t.floor.atTable}</span>
                </>
              ) : null}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        className="mtv-list-free"
        onClick={onToggleFree}
        aria-expanded={showFree}
      >
        <span>
          {t.floor.freeTables.replace("{count}", String(freeRows.length))}
        </span>
        <span
          className="mtv-list-free-chevron"
          data-open={showFree ? "true" : "false"}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {showFree
        ? freeRows.map(({ table }) => (
            <button
              key={table.id}
              type="button"
              className="mtv-list-row"
              data-status="clear"
              data-selected={table.id === selectedId ? "true" : "false"}
              onClick={() => onSelect(table.id)}
            >
              <span className="mtv-list-no">{table.label}</span>
              <span className="mtv-list-meta">
                <span className="mtv-list-zone">
                  {pickLocale(table.areaName ?? {}, locale)}
                </span>
                <span className="mtv-list-what">
                  {t.floor.freeSeats.replace("{seats}", String(table.seats))}
                </span>
              </span>
            </button>
          ))
        : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "good" | "waiting" | "overdue";
}) {
  return (
    <div className="mtv-stat" data-tone={tone ?? "neutral"}>
      <span className="mtv-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mtv-stat-value">{value}</span>
      <span className="mtv-stat-label">{label}</span>
    </div>
  );
}

function Legend({ t }: { t: StaffStrings }) {
  return (
    <ul className="mtv-legend">
      <li data-status="good">{t.floor.legendGood}</li>
      <li data-status="waiting">{t.floor.legendWaiting}</li>
      <li data-status="overdue">{t.floor.legendOverdue}</li>
      <li data-status="clear">{t.floor.legendFree}</li>
    </ul>
  );
}

function TableDetail({
  table,
  now,
  busy,
  t,
  turns,
  onAct,
  onClose,
}: {
  table: FloorTable;
  now: number;
  busy: boolean;
  t: StaffStrings;
  turns: TurnSettings;
  onAct: (payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [guestCount, setGuestCount] = useState<string>(
    table.guestCount !== null ? String(table.guestCount) : ""
  );

  const allowance = turnAllowanceMinutes(table.guestCount, turns);
  const elapsedMinutes = table.sessionOpenedAt
    ? Math.floor((now - new Date(table.sessionOpenedAt).getTime()) / 60000)
    : 0;
  // Whole minutes, matching the "Time at table" row above so the two
  // figures always add up (allowance + over = elapsed).
  const overBy = elapsedMinutes - allowance;

  return (
    <section className="mtv-detail-panel">
      <div className="mtv-panel-head">
        <h2>{t.floor.tableN.replace("{label}", table.label)}</h2>
        <button type="button" className="mtv-btn mtv-btn-small" onClick={onClose}>
          {t.floor.close}
        </button>
      </div>

      <dl className="mtv-detail-list">
        <div>
          <dt>{t.floor.seats}</dt>
          <dd>{table.seats}</dd>
        </div>
        {table.sessionOpenedAt ? (
          <>
            <div>
              <dt>{t.floor.timeAtTable}</dt>
              <dd>{formatElapsed(table.sessionOpenedAt, now)}</dd>
            </div>
            <div>
              <dt>{t.floor.tableTime}</dt>
              <dd data-over={overBy > 0 ? "true" : "false"}>
                {formatMinutes(allowance)}
                {overBy > 0
                  ? ` · ${t.floor.minutesOver.replace("{time}", formatMinutes(overBy))}`
                  : ` · ${t.floor.minutesLeft.replace("{time}", formatMinutes(Math.max(1, allowance - elapsedMinutes)))}`}
              </dd>
            </div>
          </>
        ) : null}
        {table.combinedWith.length > 0 ? (
          <div>
            <dt>{t.floor.combinedLabel}</dt>
            <dd>
              {t.floor.combinedWithMore.replace(
                "{count}",
                String(table.combinedWith.length)
              )}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t.floor.openRequests}</dt>
          <dd>{table.requests.length}</dd>
        </div>
      </dl>

      {table.sessionId ? (
        <div className="mtv-detail-actions">
          <label className="mtv-guest-count">
            <span>{t.floor.guests}</span>
            <input
              type="number"
              min={0}
              max={500}
              value={guestCount}
              onChange={(event) => setGuestCount(event.target.value)}
              onBlur={() =>
                void onAct({
                  action: "set_guest_count",
                  sessionId: table.sessionId,
                  guestCount:
                    guestCount.trim() === "" ? null : Number(guestCount),
                })
              }
            />
          </label>

          {table.combinedWith.length > 0 ? (
            <button
              type="button"
              className="mtv-btn"
              disabled={busy}
              onClick={() =>
                void onAct({
                  action: "uncombine",
                  sessionId: table.sessionId,
                })
              }
            >
              {t.floor.uncombine}
            </button>
          ) : null}

          <button
            type="button"
            className="mtv-btn mtv-btn-danger"
            disabled={busy}
            onClick={() =>
              void onAct({
                action: "close_session",
                sessionId: table.sessionId,
              })
            }
          >
            {t.floor.clearTable}
          </button>
        </div>
      ) : (
        <div className="mtv-detail-actions">
          <p className="mtv-empty">{t.floor.tableFree}</p>
          {/* Walk-ins who sit down without tapping: the waiter opens the
              visit by hand. Same session machinery as a guest tap. */}
          <button
            type="button"
            className="mtv-btn mtv-btn-primary"
            disabled={busy}
            onClick={() =>
              void onAct({ action: "seat_table", tableId: table.id })
            }
          >
            {t.floor.seatGuests}
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- icons */








function TablesIcon() {
  return (
    <svg viewBox="0 0 22 22" className="mtv-stat-svg" aria-hidden="true">
      <circle cx="11" cy="11" r="4.2" />
      <path d="M11 2.5v3M11 16.5v3M2.5 11h3M16.5 11h3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 22 22" className="mtv-stat-svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M7.5 11.2l2.4 2.4 4.6-4.8" />
    </svg>
  );
}

function WaitIcon() {
  return (
    <svg viewBox="0 0 22 22" className="mtv-stat-svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M11 6.5V11l3 2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 22 22" className="mtv-stat-svg" aria-hidden="true">
      <path d="M11 3 2.8 18h16.4L11 3Z" />
      <path d="M11 9v4M11 15.6v.4" />
    </svg>
  );
}
