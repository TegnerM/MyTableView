"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { pickLocale, type LocaleMap, type UiStringsShape } from "@/lib/i18n/guest";
import { MenuOrder } from "@/components/guest/MenuOrder";
import type { VenueMenu } from "@/lib/menu/types";

/**
 * The Hotel edition guest experience — the approved light-navy flow:
 * Room service (the money button), Housekeeping, Maintenance (with a
 * note), Concierge, plus the live status chip for the guest's own
 * requests and room-service order.
 *
 * Ordering reuses MenuOrder (theme="hotel"); requests reuse the same
 * guest APIs as every edition. Status is polled — guests have no
 * authenticated realtime socket. Which buttons appear is venue data:
 * the hotel switches them in Settings → Guest buttons.
 */

type RequestTypeView = {
  id: string;
  code: string;
  label: LocaleMap;
  sublabel: LocaleMap;
  closesSession: boolean;
};

type Props = {
  tagId: string;
  locale: string;
  venueDefaultLocale: string;
  venueName: string;
  roomLabel: string;
  zoneName: string;
  serviceChargePct: number;
  menu: VenueMenu;
  orderingLive: boolean;
  requestTypes: RequestTypeView[];
  strings: UiStringsShape;
};

type Sheet = "home" | "housekeeping" | "maintenance" | "concierge" | "status" | "sent";

type ActiveOrder = {
  phase: "received" | "preparing" | "on_the_way" | "delivered";
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
};

type OpenRequest = {
  id: string;
  label: LocaleMap;
  state: "open" | "acknowledged";
  createdAt: string;
};

type SessionOrdersPayload = {
  ok?: boolean;
  activeOrder?: {
    phase: ActiveOrder["phase"];
    createdAt: string;
    tickets: {
      startedAt: string | null;
      readyAt: string | null;
      deliveredAt: string | null;
    }[];
  } | null;
  openRequests?: OpenRequest[];
};

function clock(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function HotelGuest({
  tagId,
  locale,
  venueDefaultLocale,
  venueName,
  roomLabel,
  zoneName,
  serviceChargePct,
  menu,
  orderingLive,
  requestTypes,
  strings,
}: Props) {
  const t = strings;
  const pick = useCallback(
    (map: LocaleMap) => pickLocale(map, locale, venueDefaultLocale),
    [locale, venueDefaultLocale]
  );

  const [sheet, setSheet] = useState<Sheet>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [maintenanceNote, setMaintenanceNote] = useState("");

  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);

  /* ---------------------------------------------- status polling */

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/guest/session-orders?tag=${encodeURIComponent(tagId)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => null)) as
        | SessionOrdersPayload
        | null;
      if (!payload?.ok) return;

      if (payload.activeOrder) {
        const tickets = payload.activeOrder.tickets ?? [];
        const first = (values: (string | null)[]) =>
          values.filter(Boolean).sort()[0] ?? null;
        setActiveOrder({
          phase: payload.activeOrder.phase,
          createdAt: payload.activeOrder.createdAt,
          startedAt: first(tickets.map((ticket) => ticket.startedAt)),
          readyAt: first(tickets.map((ticket) => ticket.readyAt)),
          deliveredAt: first(tickets.map((ticket) => ticket.deliveredAt)),
        });
      } else {
        setActiveOrder(null);
      }
      setOpenRequests(payload.openRequests ?? []);
    } catch {
      // Poll again next tick; the chip just goes quiet.
    }
  }, [tagId]);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshStatus();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  /* ---------------------------------------------- actions */

  const sendRequest = useCallback(
    async (requestTypeId: string, note?: string) => {
      setBusy(true);
      setFailed(false);
      try {
        const response = await fetch("/api/guest/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagId,
            requestTypeId,
            ...(note && note.trim() ? { note: note.trim() } : {}),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          reason?: string;
        } | null;
        // "duplicate" = it's already on the staff screen — success for
        // the guest either way.
        if (payload?.ok || payload?.reason === "duplicate") {
          setMaintenanceNote("");
          setSheet("sent");
          void refreshStatus();
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [tagId, refreshStatus]
  );

  /* Grouping is by code convention: hotel_hk_* → the Housekeeping
     sheet, hotel_maintenance → Maintenance, every other non-closing
     signal → Concierge. Bill-style types don't exist on the hotel
     home (a stay has no "ask for the bill"). */
  const housekeepingTypes = useMemo(
    () => requestTypes.filter((type) => type.code.startsWith("hotel_hk_")),
    [requestTypes]
  );
  const maintenanceType = useMemo(
    () => requestTypes.find((type) => type.code === "hotel_maintenance") ?? null,
    [requestTypes]
  );
  const conciergeTypes = useMemo(
    () =>
      requestTypes.filter(
        (type) =>
          !type.code.startsWith("hotel_hk_") &&
          type.code !== "hotel_maintenance" &&
          !type.closesSession
      ),
    [requestTypes]
  );

  const menuLive = orderingLive && menu.categories.length > 0;

  const chipRequest = openRequests[0] ?? null;
  const chipLabel = activeOrder
    ? `${t.barStatusChip} ${
        activeOrder.phase === "received"
          ? t.statusReceived
          : activeOrder.phase === "preparing"
            ? t.statusPreparing
            : activeOrder.phase === "on_the_way"
              ? t.statusOnTheWay
              : t.statusDelivered
      }`
    : chipRequest
      ? `${t.hotelStatusChip} ${
          chipRequest.state === "acknowledged" ? t.statusInProgress : t.statusReceived
        }`
      : null;

  /* ---------------------------------------------- render */

  return (
    <div className="hotel-guest">
      <header className="hotel-hero">
        <div className="hotel-brand">
          Ⓜ my<em>table</em>view <span>Hotel</span>
        </div>
        <div className="hotel-venue">{venueName}</div>
        <div className="hotel-room">
          <b>{roomLabel}</b>
          {zoneName ? <span>· {zoneName}</span> : null}
        </div>
      </header>

      <main className="hotel-sheet">
        {menuLive ? (
          <button
            type="button"
            className="hotel-action hotel-action-feature"
            onClick={() => setMenuOpen(true)}
          >
            <span className="hotel-ic" aria-hidden="true">🍽️</span>
            <span className="hotel-tx">
              <span className="hotel-lb">{t.hotelRoomService}</span>
              <span className="hotel-sb">{t.hotelRoomServiceSub}</span>
            </span>
            <span className="hotel-ch" aria-hidden="true">›</span>
          </button>
        ) : null}

        {housekeepingTypes.length > 0 ? (
          <button
            type="button"
            className="hotel-action"
            onClick={() => {
              setFailed(false);
              setSheet("housekeeping");
            }}
          >
            <span className="hotel-ic" aria-hidden="true">🛏️</span>
            <span className="hotel-tx">
              <span className="hotel-lb">{t.hotelHousekeeping}</span>
              <span className="hotel-sb">{t.hotelHousekeepingSub}</span>
            </span>
            <span className="hotel-ch" aria-hidden="true">›</span>
          </button>
        ) : null}

        {maintenanceType || conciergeTypes.length > 0 ? (
          <div className="hotel-grid2" data-single={!maintenanceType || conciergeTypes.length === 0 ? "true" : "false"}>
            {maintenanceType ? (
              <button
                type="button"
                className="hotel-action"
                onClick={() => {
                  setFailed(false);
                  setSheet("maintenance");
                }}
              >
                <span className="hotel-ic" aria-hidden="true">🔧</span>
                <span className="hotel-tx">
                  <span className="hotel-lb">{t.hotelMaintenance}</span>
                  <span className="hotel-sb">{t.hotelMaintenanceSub}</span>
                </span>
              </button>
            ) : null}
            {conciergeTypes.length > 0 ? (
              <button
                type="button"
                className="hotel-action"
                onClick={() => {
                  setFailed(false);
                  setSheet("concierge");
                }}
              >
                <span className="hotel-ic" aria-hidden="true">🛎️</span>
                <span className="hotel-tx">
                  <span className="hotel-lb">{t.hotelConcierge}</span>
                  <span className="hotel-sb">{t.hotelConciergeSub}</span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {chipLabel ? (
          <button
            type="button"
            className="hotel-statuschip"
            onClick={() => setSheet("status")}
          >
            <span className="hotel-dot" aria-hidden="true" />
            <span>{chipLabel}</span>
            <span className="hotel-ch" aria-hidden="true">›</span>
          </button>
        ) : null}
      </main>

      {/* Room service — the full ordering flow, hotel-skinned. */}
      <MenuOrder
        tagId={tagId}
        locale={locale}
        venueDefaultLocale={venueDefaultLocale}
        tableLabel={roomLabel}
        serviceChargePct={serviceChargePct}
        menu={menu}
        strings={strings}
        theme="hotel"
        entry="none"
        externalOpen={menuOpen}
        onExternalOpenHandled={() => setMenuOpen(false)}
      />

      {sheet !== "home" ? (
        <div className="hotel-overlay" role="dialog" aria-modal="true">
          <div className="hotel-overlay-head">
            <button
              type="button"
              className="hotel-back"
              aria-label={t.menuBack}
              onClick={() => setSheet("home")}
            >
              ‹
            </button>
            <div className="hotel-overlay-title">
              <b>
                {sheet === "housekeeping"
                  ? t.hotelHousekeeping
                  : sheet === "maintenance"
                    ? t.hotelMaintenance
                    : sheet === "concierge"
                      ? t.hotelConcierge
                      : sheet === "status"
                        ? t.statusOrderTitle
                        : t.barRequestSentTitle}
              </b>
              <span>
                {sheet === "housekeeping"
                  ? t.hotelHousekeepingPrompt
                  : sheet === "maintenance"
                    ? t.hotelMaintenancePrompt
                    : sheet === "concierge"
                      ? t.howCanWeHelp
                      : `${roomLabel}${zoneName ? ` · ${zoneName}` : ""}`}
              </span>
            </div>
            <span className="hotel-overlay-spacer" aria-hidden="true" />
          </div>

          <div className="hotel-overlay-body">
            {sheet === "housekeeping"
              ? housekeepingTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className="hotel-opt"
                    disabled={busy}
                    onClick={() => void sendRequest(type.id)}
                  >
                    <span className="hotel-opt-name">{pick(type.label)}</span>
                    {pick(type.sublabel) ? (
                      <span className="hotel-opt-sub">{pick(type.sublabel)}</span>
                    ) : null}
                  </button>
                ))
              : null}

            {sheet === "maintenance" && maintenanceType ? (
              <>
                <textarea
                  className="hotel-note"
                  rows={4}
                  maxLength={280}
                  placeholder={t.hotelMaintenanceNote}
                  value={maintenanceNote}
                  onChange={(event) => setMaintenanceNote(event.target.value)}
                />
                <button
                  type="button"
                  className="hotel-cta"
                  disabled={busy}
                  onClick={() =>
                    void sendRequest(maintenanceType.id, maintenanceNote)
                  }
                >
                  {t.hotelMaintenanceSend}
                </button>
              </>
            ) : null}

            {sheet === "concierge"
              ? conciergeTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className="hotel-opt"
                    disabled={busy}
                    onClick={() => void sendRequest(type.id)}
                  >
                    <span className="hotel-opt-name">{pick(type.label)}</span>
                    {pick(type.sublabel) ? (
                      <span className="hotel-opt-sub">{pick(type.sublabel)}</span>
                    ) : null}
                  </button>
                ))
              : null}

            {sheet === "status" ? (
              <>
                {activeOrder ? (
                  <div className="hotel-status">
                    <span className="hotel-status-ring" aria-hidden="true">🍽️</span>
                    <span className="hotel-status-lead">{t.barYourOrderIs}</span>
                    <span className="hotel-status-phase">
                      {activeOrder.phase === "received"
                        ? t.statusReceived
                        : activeOrder.phase === "preparing"
                          ? t.statusPreparing
                          : activeOrder.phase === "on_the_way"
                            ? t.statusOnTheWay
                            : t.statusDelivered}
                    </span>
                    <div className="hotel-steps">
                      <StatusStep
                        label={t.statusReceived}
                        time={clock(activeOrder.createdAt)}
                        state="done"
                      />
                      <StatusStep
                        label={t.statusPreparing}
                        time={clock(activeOrder.startedAt)}
                        state={
                          activeOrder.phase === "received"
                            ? "wait"
                            : activeOrder.phase === "preparing"
                              ? "now"
                              : "done"
                        }
                      />
                      <StatusStep
                        label={t.statusOnTheWay}
                        time={clock(activeOrder.readyAt)}
                        state={
                          activeOrder.phase === "on_the_way"
                            ? "now"
                            : activeOrder.phase === "delivered"
                              ? "done"
                              : "wait"
                        }
                      />
                      <StatusStep
                        label={t.statusDelivered}
                        time={clock(activeOrder.deliveredAt)}
                        state={activeOrder.phase === "delivered" ? "done" : "wait"}
                        last
                      />
                    </div>
                  </div>
                ) : null}

                {openRequests.length > 0 ? (
                  <div className="hotel-reqs">
                    {openRequests.map((request) => (
                      <div key={request.id} className="hotel-req">
                        <span className="hotel-req-name">
                          {pick(request.label)}
                        </span>
                        <span
                          className="hotel-req-state"
                          data-state={request.state}
                        >
                          {request.state === "acknowledged"
                            ? t.statusInProgress
                            : t.statusReceived}
                        </span>
                        <span className="hotel-req-time">
                          {clock(request.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!activeOrder && openRequests.length === 0 ? (
                  <p className="hotel-empty">
                    {t.menuOrderSentBody.replace("{table}", roomLabel)}
                  </p>
                ) : null}
              </>
            ) : null}

            {sheet === "sent" ? (
              <div className="hotel-sent">
                <span className="hotel-sent-ok" aria-hidden="true">✓</span>
                <h3>{t.barRequestSentTitle}</h3>
                <p>{t.barRequestSentBody}</p>
                <button
                  type="button"
                  className="hotel-cta"
                  onClick={() => setSheet("home")}
                >
                  {t.barBackToHome}
                </button>
              </div>
            ) : null}

            {failed ? <p className="hotel-error">{t.menuOrderFailed}</p> : null}

            {sheet === "housekeeping" ||
            sheet === "maintenance" ||
            sheet === "concierge" ? (
              <button
                type="button"
                className="hotel-ghost"
                onClick={() => setSheet("home")}
              >
                {t.menuBack}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusStep({
  label,
  time,
  state,
  last = false,
}: {
  label: string;
  time: string;
  state: "done" | "now" | "wait";
  last?: boolean;
}) {
  return (
    <div className="hotel-step" data-state={state}>
      <span className="hotel-step-rail">
        <span className="hotel-step-dot">{state === "done" ? "✓" : ""}</span>
        {!last ? <span className="hotel-step-bar" /> : null}
      </span>
      <span className="hotel-step-text">
        <span className="hotel-step-label">{label}</span>
        {time ? <span className="hotel-step-time">{time}</span> : null}
      </span>
    </div>
  );
}
