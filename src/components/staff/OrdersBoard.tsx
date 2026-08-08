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

/**
 * The Orders board — the kitchen's and the bar's screen.
 *
 * Each device picks its station ONCE (remembered per device, like the
 * floor's theme) and then only sees its own tickets: the kitchen iPad
 * never shows a round of drinks, the bar never shows a steak.
 *
 * Live the same way the floor is live: realtime on order_tickets plus
 * a steady poll, refresh on wake. Columns: New → In progress → Ready.
 * Ready rings the WAITERS' devices (the floor bell); this screen just
 * moves the ticket across and waits for the pickup.
 */

const STATION_KEY = "mtv-orders-station";

type StationFilter = Station | "all";

type Props = {
  identity: StaffIdentity;
  initialTickets: BoardTicket[];
  initialNow: number;
};

export function OrdersBoard({ identity, initialTickets, initialNow }: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const [station, setStation] = useState<StationFilter>("all");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STATION_KEY);
      if (stored === "kitchen" || stored === "bar" || stored === "all") {
        setStation(stored);
      }
    } catch {
      // Private browsing: show all.
    }
  }, []);

  const pickStation = useCallback((next: StationFilter) => {
    setStation(next);
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

  const visible = useMemo(
    () =>
      initialTickets.filter(
        (ticket) => station === "all" || ticket.station === station
      ),
    [initialTickets, station]
  );

  const columns: { key: TicketState; title: string; tickets: BoardTicket[] }[] =
    useMemo(
      () => [
        {
          key: "new",
          title: t.board.colNew,
          tickets: visible.filter((ticket) => ticket.state === "new"),
        },
        {
          key: "preparing",
          title: t.board.colPreparing,
          tickets: visible.filter((ticket) => ticket.state === "preparing"),
        },
        {
          key: "ready",
          title: t.board.colReady,
          tickets: visible.filter((ticket) => ticket.state === "ready"),
        },
        {
          key: "delivered",
          title: t.board.colDelivered,
          tickets: visible.filter((ticket) => ticket.state === "delivered"),
        },
      ],
      [visible, t]
    );

  const openCount = visible.filter((ticket) => ticket.state !== "delivered").length;

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
            {(["kitchen", "bar", "all"] as StationFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={station === option}
                data-active={station === option ? "true" : "false"}
                onClick={() => pickStation(option)}
              >
                {option === "kitchen"
                  ? t.board.kitchen
                  : option === "bar"
                    ? t.board.bar
                    : t.board.all}
              </button>
            ))}
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

        <div className="mtv-board-cols">
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
                    now={now}
                    busy={busy === ticket.id}
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
  now,
  busy,
  onAct,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  locale: string;
  ticket: BoardTicket;
  now: number;
  busy: boolean;
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
          {ticket.station === "bar" ? t.board.bar : t.board.kitchen}
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
          <p className="mtv-ticket-waiting">{t.board.waitingPickup}</p>
          <button
            type="button"
            className="mtv-ticket-btn mtv-ticket-btn-delivered"
            disabled={busy}
            onClick={() => void onAct(ticket.id, "delivered")}
          >
            {t.board.markDelivered}
          </button>
          <p className="mtv-ticket-hint">{t.board.pickupHint}</p>
        </div>
      ) : null}
    </article>
  );
}
