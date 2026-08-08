"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickLocale, type LocaleMap, type UiStringsShape } from "@/lib/i18n/guest";
import { MenuOrder } from "@/components/guest/MenuOrder";
import { formatCents, type VenueMenu } from "@/lib/menu/types";

/**
 * The Bar edition guest experience — the approved dark flow: five
 * actions, live status chip, order-status timeline (facts, never
 * estimates), Another Round, and the Call Staff / Ask for Bill sheets.
 *
 * Ordering itself reuses MenuOrder (theme="bar"); requests reuse the
 * same guest APIs as the restaurant surface. Status is polled — guests
 * have no authenticated realtime socket.
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
  tableLabel: string;
  zoneName: string;
  serviceChargePct: number;
  menu: VenueMenu;
  orderingLive: boolean;
  requestTypes: RequestTypeView[];
  strings: UiStringsShape;
};

type Sheet = "home" | "round" | "callstaff" | "bill" | "status" | "sent";

type ActiveOrder = {
  phase: "received" | "preparing" | "on_the_way" | "delivered";
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
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
  lastOrderLines?: { menuItemId: string; quantity: number }[];
  favorites?: { menuItemId: string; name: LocaleMap; quantity: number }[];
};

function clock(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function BarGuest({
  tagId,
  locale,
  venueDefaultLocale,
  venueName,
  tableLabel,
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

  const [active, setActive] = useState<ActiveOrder | null>(null);
  const [lastLines, setLastLines] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [favorites, setFavorites] = useState<
    { menuItemId: string; name: LocaleMap; quantity: number }[]
  >([]);
  const [round, setRound] = useState<Record<string, number>>({});

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
        setActive({
          phase: payload.activeOrder.phase,
          createdAt: payload.activeOrder.createdAt,
          startedAt: first(tickets.map((ticket) => ticket.startedAt)),
          readyAt: first(tickets.map((ticket) => ticket.readyAt)),
          deliveredAt: first(tickets.map((ticket) => ticket.deliveredAt)),
        });
      } else {
        setActive(null);
      }
      setLastLines(payload.lastOrderLines ?? []);
      setFavorites(payload.favorites ?? []);
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
    async (requestTypeId: string) => {
      setBusy(true);
      setFailed(false);
      try {
        const response = await fetch("/api/guest/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId, requestTypeId }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          reason?: string;
        } | null;
        // "duplicate" = it's already on the staff screen — success for
        // the guest either way.
        if (payload?.ok || payload?.reason === "duplicate") {
          setSheet("sent");
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [tagId]
  );

  const roundCount = Object.values(round).reduce((sum, qty) => sum + qty, 0);

  const sendRound = useCallback(
    async (lines: { menuItemId: string; quantity: number }[]) => {
      if (lines.length === 0) return;
      setBusy(true);
      setFailed(false);
      try {
        const response = await fetch("/api/guest/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagId,
            lines: lines.map((line) => ({
              itemId: line.menuItemId,
              quantity: Math.min(9, line.quantity),
              optionIds: [],
            })),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
        } | null;
        if (payload?.ok) {
          setRound({});
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

  /* Favourites resolve against the live menu so sold-out or removed
     drinks never enter a round. Items WITH options are excluded too:
     a quick-add can't carry the guest's option choices (the order
     history stores name snapshots, not option IDs), and silently
     sending the base drink would be the wrong drink. Those go through
     the full menu, where options are asked properly. */
  const simpleItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of menu.categories) {
      for (const item of category.items) {
        if (item.available && item.priceCents > 0 && item.options.length === 0) {
          ids.add(item.id);
        }
      }
    }
    return ids;
  }, [menu]);

  const orderableFavorites = favorites.filter((favorite) =>
    simpleItemIds.has(favorite.menuItemId)
  );
  // Repeat is all-or-nothing: a partial "last round" would look like
  // the bar forgot half the order.
  const repeatable =
    lastLines.length > 0 &&
    lastLines.every((line) => simpleItemIds.has(line.menuItemId))
      ? lastLines
      : [];

  const priceOf = useCallback(
    (menuItemId: string): number => {
      for (const category of menu.categories) {
        for (const item of category.items) {
          if (item.id === menuItemId) return item.priceCents;
        }
      }
      return 0;
    },
    [menu]
  );

  const roundTotal = Object.entries(round).reduce(
    (sum, [id, qty]) => sum + priceOf(id) * qty,
    0
  );

  const phaseLabel: Record<ActiveOrder["phase"], string> = {
    received: t.statusReceived,
    preparing: t.statusPreparing,
    on_the_way: t.statusOnTheWay,
    delivered: t.statusDelivered,
  };

  const callStaffTypes = requestTypes.filter((type) => !type.closesSession);
  const billTypes = requestTypes.filter((type) => type.closesSession);

  /* ---------------------------------------------- render */

  return (
    <div className="bar-guest">
      <header className="bar-hero">
        <div className="bar-brand">
          Ⓜ my<em>table</em>view <span>Bar</span>
        </div>
        <div className="bar-venue">{venueName}</div>
        <div className="bar-table">
          <b>{tableLabel}</b>
          {zoneName ? <span>{zoneName}</span> : null}
        </div>
      </header>

      <main className="bar-sheet">
        {orderingLive && menu.categories.length > 0 ? (
          <>
            <button
              type="button"
              className="bar-action bar-action-feature"
              onClick={() => setMenuOpen(true)}
            >
              <span className="bar-ic" aria-hidden="true">🍸</span>
              <span className="bar-tx">
                <span className="bar-lb">{t.barOrderDrinks}</span>
                <span className="bar-sb">{t.barOrderDrinksSub}</span>
              </span>
              <span className="bar-ch" aria-hidden="true">›</span>
            </button>

            <button
              type="button"
              className="bar-action"
              onClick={() => {
                setFailed(false);
                setRound({});
                setSheet("round");
              }}
            >
              <span className="bar-ic" aria-hidden="true">🔁</span>
              <span className="bar-tx">
                <span className="bar-lb">{t.barAnotherRound}</span>
                <span className="bar-sb">{t.barAnotherRoundSub}</span>
              </span>
              <span className="bar-ch" aria-hidden="true">›</span>
            </button>

            <div className="bar-grid2">
              <button
                type="button"
                className="bar-action"
                onClick={() => setMenuOpen(true)}
              >
                <span className="bar-ic" aria-hidden="true">🍟</span>
                <span className="bar-tx">
                  <span className="bar-lb">{t.barSnacks}</span>
                  <span className="bar-sb">{t.barSnacksSub}</span>
                </span>
              </button>
              <button
                type="button"
                className="bar-action"
                onClick={() => {
                  setFailed(false);
                  setSheet("callstaff");
                }}
              >
                <span className="bar-ic" aria-hidden="true">🙋</span>
                <span className="bar-tx">
                  <span className="bar-lb">{t.barCallStaff}</span>
                  <span className="bar-sb">{t.barCallStaffSub}</span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="bar-action"
            onClick={() => {
              setFailed(false);
              setSheet("callstaff");
            }}
          >
            <span className="bar-ic" aria-hidden="true">🙋</span>
            <span className="bar-tx">
              <span className="bar-lb">{t.barCallStaff}</span>
              <span className="bar-sb">{t.barCallStaffSub}</span>
            </span>
            <span className="bar-ch" aria-hidden="true">›</span>
          </button>
        )}

        {billTypes.length > 0 ? (
          <button
            type="button"
            className="bar-action"
            onClick={() => {
              setFailed(false);
              setSheet("bill");
            }}
          >
            <span className="bar-ic" aria-hidden="true">🧾</span>
            <span className="bar-tx">
              <span className="bar-lb">{t.barAskBill}</span>
              <span className="bar-sb">{t.barAskBillSub}</span>
            </span>
            <span className="bar-ch" aria-hidden="true">›</span>
          </button>
        ) : null}

        {active ? (
          <button
            type="button"
            className="bar-statuschip"
            onClick={() => setSheet("status")}
          >
            <span className="bar-dot" aria-hidden="true" />
            <span>
              {t.barStatusChip} <b>{phaseLabel[active.phase]}</b>
            </span>
            <span className="bar-ch" aria-hidden="true">›</span>
          </button>
        ) : null}
      </main>

      {/* The full ordering flow, dark-skinned. */}
      <MenuOrder
        tagId={tagId}
        locale={locale}
        venueDefaultLocale={venueDefaultLocale}
        tableLabel={tableLabel}
        serviceChargePct={serviceChargePct}
        menu={menu}
        strings={strings}
        theme="bar"
        entry="none"
        externalOpen={menuOpen}
        onExternalOpenHandled={() => setMenuOpen(false)}
      />

      {sheet !== "home" ? (
        <div className="bar-overlay" role="dialog" aria-modal="true">
          <div className="bar-overlay-head">
            <button
              type="button"
              className="bar-back"
              aria-label={t.menuBack}
              onClick={() => setSheet("home")}
            >
              ‹
            </button>
            <div className="bar-overlay-title">
              <b>
                {sheet === "round"
                  ? t.barAnotherRound
                  : sheet === "callstaff"
                    ? t.barCallStaff
                    : sheet === "bill"
                      ? t.barAskBill
                      : sheet === "status"
                        ? t.statusOrderTitle
                        : t.barRequestSentTitle}
              </b>
              <span>
                {sheet === "round"
                  ? t.barQuickAdd
                  : sheet === "callstaff"
                    ? t.barCallStaffPrompt
                    : sheet === "bill"
                      ? t.barAskBillPrompt
                      : `${tableLabel}${zoneName ? ` · ${zoneName}` : ""}`}
              </span>
            </div>
            <span className="bar-overlay-spacer" aria-hidden="true" />
          </div>

          <div className="bar-overlay-body">
            {sheet === "round" ? (
              <>
                {orderableFavorites.map((favorite) => (
                  <button
                    key={favorite.menuItemId}
                    type="button"
                    className="bar-fav"
                    onClick={() =>
                      setRound((prev) => ({
                        ...prev,
                        [favorite.menuItemId]: Math.min(
                          9,
                          (prev[favorite.menuItemId] ?? 0) + 1
                        ),
                      }))
                    }
                  >
                    <span className="bar-fav-name">{pick(favorite.name)}</span>
                    <span className="bar-fav-price">
                      {formatCents(priceOf(favorite.menuItemId), locale)}
                    </span>
                    <span className="bar-fav-add" aria-hidden="true">
                      {round[favorite.menuItemId]
                        ? `${round[favorite.menuItemId]}×`
                        : "+"}
                    </span>
                  </button>
                ))}

                {roundCount > 0 ? (
                  <button
                    type="button"
                    className="bar-cta"
                    disabled={busy}
                    onClick={() =>
                      void sendRound(
                        Object.entries(round).map(([menuItemId, quantity]) => ({
                          menuItemId,
                          quantity,
                        }))
                      )
                    }
                  >
                    {t.barSendRound} · {formatCents(roundTotal, locale)}
                  </button>
                ) : repeatable.length > 0 ? (
                  <button
                    type="button"
                    className="bar-cta"
                    disabled={busy}
                    onClick={() => void sendRound(repeatable)}
                  >
                    {t.barRepeatLast}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="bar-ghost"
                  onClick={() => {
                    setSheet("home");
                    setMenuOpen(true);
                  }}
                >
                  {t.barViewFullMenu}
                </button>
              </>
            ) : null}

            {sheet === "callstaff"
              ? callStaffTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className="bar-opt"
                    disabled={busy}
                    onClick={() => void sendRequest(type.id)}
                  >
                    <span className="bar-opt-name">{pick(type.label)}</span>
                    {pick(type.sublabel) ? (
                      <span className="bar-opt-sub">{pick(type.sublabel)}</span>
                    ) : null}
                  </button>
                ))
              : null}

            {sheet === "bill"
              ? billTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className="bar-opt"
                    disabled={busy}
                    onClick={() => void sendRequest(type.id)}
                  >
                    <span className="bar-opt-name">{pick(type.label)}</span>
                    {pick(type.sublabel) ? (
                      <span className="bar-opt-sub">{pick(type.sublabel)}</span>
                    ) : null}
                  </button>
                ))
              : null}

            {sheet === "status" ? (
              active ? (
                <div className="bar-status">
                  <span className="bar-status-ring" aria-hidden="true">🍸</span>
                  <span className="bar-status-lead">{t.barYourOrderIs}</span>
                  <span className="bar-status-phase">
                    {phaseLabel[active.phase]}
                  </span>
                  <div className="bar-steps">
                    <StatusStep
                      label={t.statusReceived}
                      time={clock(active.createdAt)}
                      state="done"
                    />
                    <StatusStep
                      label={t.statusPreparing}
                      time={clock(active.startedAt)}
                      state={
                        active.phase === "received"
                          ? "wait"
                          : active.phase === "preparing"
                            ? "now"
                            : "done"
                      }
                    />
                    <StatusStep
                      label={t.statusOnTheWay}
                      time={clock(active.readyAt)}
                      state={
                        active.phase === "on_the_way"
                          ? "now"
                          : active.phase === "delivered"
                            ? "done"
                            : "wait"
                      }
                    />
                    <StatusStep
                      label={t.statusDelivered}
                      time={clock(active.deliveredAt)}
                      state={active.phase === "delivered" ? "done" : "wait"}
                      last
                    />
                  </div>
                </div>
              ) : (
                <p className="bar-empty">{t.menuOrderSentBody.replace("{table}", tableLabel)}</p>
              )
            ) : null}

            {sheet === "sent" ? (
              <div className="bar-sent">
                <span className="bar-sent-ok" aria-hidden="true">✓</span>
                <h3>{t.barRequestSentTitle}</h3>
                <p>{t.barRequestSentBody}</p>
                <button
                  type="button"
                  className="bar-cta"
                  onClick={() => setSheet("home")}
                >
                  {t.barBackToHome}
                </button>
              </div>
            ) : null}

            {failed ? <p className="bar-error">{t.menuOrderFailed}</p> : null}

            {sheet === "callstaff" || sheet === "bill" || sheet === "round" ? (
              <button
                type="button"
                className="bar-ghost"
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
    <div className="bar-step" data-state={state}>
      <span className="bar-step-rail">
        <span className="bar-step-dot">{state === "done" ? "✓" : ""}</span>
        {!last ? <span className="bar-step-bar" /> : null}
      </span>
      <span className="bar-step-text">
        <span className="bar-step-label">{label}</span>
        {time ? <span className="bar-step-time">{time}</span> : null}
      </span>
    </div>
  );
}
