"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { StaffShell } from "@/components/staff/StaffShell";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";
import { pickLocale } from "@/lib/i18n/guest";
import { formatElapsed, type StaffIdentity } from "@/lib/staff/floor-types";
import type { BoardTicket, Station, TicketState } from "@/lib/menu/types";
import type { VenueStation } from "@/lib/stations";

/**
 * The Orders board — three separate views, one per job:
 *
 *   Kitchen — only kitchen tickets: New → In progress → Ready.
 *   Bar     — only bar tickets, same columns.
 *   Waiters — only what needs carrying: Ready tickets from BOTH
 *             stations (with the Delivered button) and the last hour
 *             of delivered ones. No kitchen noise, no bar noise.
 *
 * Each device picks its view ONCE (remembered per device, like the
 * floor's theme). Live like the floor: realtime on order_tickets plus
 * a steady poll, refresh on wake.
 */

const STATION_KEY = "mtv-orders-station";

type BoardView = Station | "waiter";

type Props = {
  identity: StaffIdentity;
  /** The venue's stations, in display order. */
  stations: VenueStation[];
  initialTickets: BoardTicket[];
  initialNow: number;
};

export function OrdersBoard({ identity, stations, initialTickets, initialNow }: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  // Station display names come from the venue (Bar edition renames
  // 'kitchen' to "Snack kitchen" without touching a single ticket).
  const stationLabel = useCallback(
    (slug: string): string => {
      const station = stations.find((entry) => entry.slug === slug);
      if (station) {
        const name = pickLocale(station.name, locale);
        if (name) return name;
      }
      return slug === "bar" ? t.board.bar : t.board.kitchen;
    },
    [stations, locale, t]
  );

  const [view, setView] = useState<BoardView>("waiter");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STATION_KEY);
      if (
        stored === "waiter" ||
        (stored && stations.some((station) => station.slug === stored))
      ) {
        setView(stored);
      }
      // Devices that stored the old "all" mode become waiter view.
    } catch {
      // Private browsing: waiter view.
    }
  }, [stations]);

  const pickView = useCallback((next: BoardView) => {
    setView(next);
    try {
      window.localStorage.setItem(STATION_KEY, next);
    } catch {
      // Best effort only.
    }
  }, []);

  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [busy, setBusy] = useState<string | null>(null);
  const [actError, setActError] = useState(false);

  // Same freshness machinery as the floor: coalesced refresh, realtime,
  // poll, wake.
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

  useEffect(() => {
    router.refresh();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) scheduleRefresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [scheduleRefresh]);

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

  useEffect(() => {
    const supabase = getBrowserClient();
    const venueId = identity.venueId;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`orders:${venueId}:order_tickets`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_tickets",
            filter: `venue_id=eq.${venueId}`,
          },
          () => scheduleRefresh()
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [identity.venueId, scheduleRefresh]);

  const act = useCallback(
    async (ticketId: string, action: "start" | "ready" | "delivered" | "cancel") => {
      setBusy(ticketId);
      try {
        const response = await fetch("/api/staff/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, action }),
        });
        // 409 = someone else got there first; the refresh shows theirs.
        setActError(!response.ok && response.status !== 409);
        router.refresh();
      } catch {
        setActError(true);
      } finally {
        setBusy(null);
      }
    },
    [router]
  );

  // Stations see ONLY their own tickets and never the delivered pile;
  // waiters see ONLY what's ready to carry (both stations) + the last
  // hour of delivered for "did table 3 get its food?" disputes.
  const columns: { key: TicketState; title: string; tickets: BoardTicket[] }[] =
    useMemo(() => {
      if (view === "waiter") {
        const ready = initialTickets.filter(
          (ticket) => ticket.state === "ready"
        );
        const delivered = initialTickets.filter(
          (ticket) => ticket.state === "delivered"
        );
        return [
          { key: "ready", title: t.board.colToDeliver, tickets: ready },
          { key: "delivered", title: t.board.colDelivered, tickets: delivered },
        ];
      }

      const mine = initialTickets.filter((ticket) => ticket.station === view);
      return [
        {
          key: "new",
          title: t.board.colNew,
          tickets: mine.filter((ticket) => ticket.state === "new"),
        },
        {
          key: "preparing",
          title: t.board.colPreparing,
          tickets: mine.filter((ticket) => ticket.state === "preparing"),
        },
        {
          key: "ready",
          title: t.board.colReady,
          tickets: mine.filter((ticket) => ticket.state === "ready"),
        },
      ];
    }, [initialTickets, view, t]);

  const openCount = columns.reduce(
    (sum, column) =>
      column.key === "delivered" ? sum : sum + column.tickets.length,
    0
  );

  return (
    <StaffShell
      active="orders"
      displayName={identity.displayName}
      role={identity.role}
      venueId={identity.venueId}
      venues={identity.venues}
    >
      <main className="mtv-board">
        <header className="mtv-board-head">
          <h1>{t.board.title}</h1>
          <div
            className="mtv-board-stations"
            role="tablist"
            aria-label={t.board.stationAria}
          >
            {[...stations.map((station) => station.slug), "waiter"].map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  data-active={view === option ? "true" : "false"}
                  onClick={() => pickView(option)}
                >
                  {option === "waiter" ? t.board.waiters : stationLabel(option)}
                </button>
              )
            )}
          </div>
        </header>

        {actError ? (
          <div className="mtv-act-error" role="alert">
            <span>{t.board.actionFailed}</span>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => setActError(false)}
            >
              ✕
            </button>
          </div>
        ) : null}

        {openCount === 0 ? (
          <p className="mtv-board-empty">{t.board.empty}</p>
        ) : null}

        <div className="mtv-board-cols" data-count={columns.length}>
          {columns.map((column) => (
            <section key={column.key} className="mtv-board-col" data-state={column.key}>
              <h2>
                <span className="mtv-board-count">{column.tickets.length}</span>
                {column.title}
              </h2>
              <div className="mtv-board-tickets">
                {column.tickets.map((ticket) => (
                  <Ticket
                    key={ticket.id}
                    t={t}
                    locale={locale}
                    ticket={ticket}
                    stationLabel={stationLabel(ticket.station)}
                    now={now}
                    busy={busy === ticket.id}
                    view={view}
                    onAct={act}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </StaffShell>
  );
}

function Ticket({
  t,
  locale,
  ticket,
  stationLabel,
  now,
  busy,
  view,
  onAct,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  locale: string;
  ticket: BoardTicket;
  stationLabel: string;
  now: number;
  busy: boolean;
  view: BoardView;
  onAct: (ticketId: string, action: "start" | "ready" | "delivered" | "cancel") => Promise<void>;
}) {
  // The clock a station cares about: how long since the ORDER was
  // placed (new/preparing), or how long it has sat ready.
  const ageFrom =
    ticket.state === "ready" && ticket.readyAt
      ? ticket.readyAt
      : ticket.state === "delivered" && ticket.deliveredAt
        ? ticket.deliveredAt
        : ticket.createdAt;

  const ageSeconds = (now - new Date(ageFrom).getTime()) / 1000;
  const warn =
    (ticket.state === "new" || ticket.state === "preparing") && ageSeconds >= 12 * 60;

  return (
    <article
      className="mtv-ticket"
      data-state={ticket.state}
      data-station={ticket.station}
    >
      <header className="mtv-ticket-head">
        <span className="mtv-ticket-table">
          {t.board.tableN.replace("{label}", ticket.tableLabel)}
        </span>
        <span className="mtv-ticket-zone">
          {pickLocale(ticket.areaName ?? {}, locale)}
        </span>
        <span className="mtv-ticket-station" data-station={ticket.station}>
          {stationLabel}
        </span>
        <span className="mtv-ticket-age" data-warn={warn ? "true" : "false"}>
          {formatElapsed(ageFrom, now)}
        </span>
      </header>

      <ul className="mtv-ticket-items">
        {ticket.items.map((item) => (
          <li key={item.id}>
            <b>{item.quantity}×</b>
            <span>
              {pickLocale(item.name, locale)}
              {item.options.length > 0 ? (
                <em>
                  {item.options
                    .map((option) => pickLocale(option.name, locale))
                    .filter(Boolean)
                    .join(" · ")}
                </em>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {ticket.note ? <p className="mtv-ticket-note">✎ {ticket.note}</p> : null}

      {ticket.state === "new" ? (
        <div className="mtv-ticket-actions">
          <button
            type="button"
            className="mtv-ticket-btn mtv-ticket-btn-start"
            disabled={busy}
            onClick={() => void onAct(ticket.id, "start")}
          >
            {t.board.start}
          </button>
          <button
            type="button"
            className="mtv-ticket-cancel"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t.board.confirmCancel)) {
                void onAct(ticket.id, "cancel");
              }
            }}
          >
            {t.board.cancelTicket}
          </button>
        </div>
      ) : null}

      {ticket.state === "preparing" ? (
        <div className="mtv-ticket-actions">
          <button
            type="button"
            className="mtv-ticket-btn mtv-ticket-btn-ready"
            disabled={busy}
            onClick={() => void onAct(ticket.id, "ready")}
          >
            {t.board.ready}
          </button>
        </div>
      ) : null}

      {ticket.state === "ready" ? (
        <div className="mtv-ticket-actions">
          {view === "waiter" ? (
            <button
              type="button"
              className="mtv-ticket-btn mtv-ticket-btn-delivered"
              disabled={busy}
              onClick={() => void onAct(ticket.id, "delivered")}
            >
              {t.board.markDelivered}
            </button>
          ) : (
            <>
              <p className="mtv-ticket-waiting">{t.board.waitingPickup}</p>
              <p className="mtv-ticket-hint">{t.board.pickupHint}</p>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
