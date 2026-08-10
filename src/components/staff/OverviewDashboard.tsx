"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";
import { pickLocale } from "@/lib/i18n/guest";
import type { StaffIdentity } from "@/lib/staff/floor-types";
import type { PropertyOverview, OverviewVenue } from "@/lib/staff/overview";

/**
 * The Property Overview dashboard — the approved design, one layout
 * for every account. A restaurant-only owner sees exactly the same
 * screen as a hotel property: one card per venue, the property strip,
 * needs-attention, activity. Only the information varies.
 */

type Props = {
  identity: StaffIdentity;
  currentVenueId: string;
  overview: PropertyOverview;
  initialLocale: string;
};

const EDITION_ICON: Record<string, string> = {
  restaurant: "🍽️",
  bar: "🍸",
  hotel: "🏨",
};

function minutes(seconds: number | null): string {
  if (seconds === null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

function clock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function delta(today: number, yesterday: number): { text: string; up: boolean } | null {
  if (yesterday <= 0) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (!Number.isFinite(pct) || pct === 0) return null;
  return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, up: pct > 0 };
}

export function OverviewDashboard({
  identity,
  currentVenueId,
  overview,
  initialLocale,
}: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);
  const o = t.overview;

  const [switching, setSwitching] = useState<string | null>(null);

  // Auto-refresh: the dashboard is a wall screen too.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const openVenue = async (venueId: string) => {
    setSwitching(venueId);
    try {
      if (venueId !== currentVenueId) {
        const response = await fetch("/api/staff/venue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId }),
        });
        if (!response.ok) {
          // Expired session or refused switch — never open the WRONG
          // venue's floor. A reload resolves the state honestly.
          window.location.reload();
          return;
        }
      }
      window.location.href = "/staff/floor";
    } catch {
      setSwitching(null);
    }
  };

  const euro = (cents: number) =>
    new Intl.NumberFormat(locale === "no" ? "nb" : locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  const revenueDelta = delta(
    overview.revenueTodayCents,
    overview.revenueYesterdayCents
  );
  const guestsDelta = delta(overview.sessionsToday, overview.sessionsYesterday);
  const responseDelta =
    overview.avgResponseSeconds !== null &&
    overview.avgResponseYesterdaySeconds !== null &&
    overview.avgResponseYesterdaySeconds > 0
      ? delta(overview.avgResponseSeconds, overview.avgResponseYesterdaySeconds)
      : null;

  const cardStats = (venue: OverviewVenue): { value: string; label: string }[] => {
    if (venue.edition === "hotel") {
      return [
        { value: `${venue.occupied}/${venue.capacity}`, label: o.statRoomsOccupied },
        { value: String(venue.openRequests), label: o.statActiveRequests },
        { value: String(venue.openOrders), label: o.statRoomService },
      ];
    }
    if (venue.edition === "bar") {
      return [
        { value: String(venue.guestsSeated), label: o.statGuestsSeated },
        { value: String(venue.ordersInProgress), label: o.statOrdersInProgress },
        { value: String(venue.readyToServe), label: o.statReadyToServe },
      ];
    }
    return [
      { value: `${venue.occupied}/${venue.capacity}`, label: o.statTablesOccupied },
      { value: String(venue.openRequests), label: o.statOpenRequests },
      { value: minutes(venue.avgResponseSeconds), label: o.statAvgResponse },
    ];
  };

  const openLabel = (edition: string) =>
    edition === "hotel"
      ? o.openHotel
      : edition === "bar"
        ? o.openBar
        : edition === "restaurant"
          ? o.openRestaurant
          : o.openVenue;

  // Rendered after mount only: the viewer's clock, not the server's —
  // and no SSR/client hydration mismatch.
  const [when, setWhen] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const date = new Intl.DateTimeFormat(locale === "no" ? "nb" : locale, {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(now);
      setWhen(`${date} · ${clock(now.toISOString())}`);
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [locale]);

  return (
    <div className="mtv-ov">
      {/* ---------------------------------------------- sidebar */}
      <aside className="mtv-ov-side">
        <div className="mtv-ov-logo">
          <span className="mtv-ov-mk" aria-hidden="true">Ⓜ</span>
          my<em>table</em>view
        </div>

        <span className="mtv-ov-nav mtv-ov-nav-on">
          <i aria-hidden="true">🏠</i> {o.title}
        </span>

        <p className="mtv-ov-group">{o.yourVenues}</p>
        {overview.venues.map((venue) => (
          <button
            key={venue.venueId}
            type="button"
            className="mtv-ov-nav"
            onClick={() => void openVenue(venue.venueId)}
          >
            <span className="mtv-ov-dot" data-edition={venue.edition} />
            {venue.venueName}
          </button>
        ))}

        <p className="mtv-ov-group">{o.tools}</p>
        <Link href="/staff/insights" className="mtv-ov-nav">
          <i aria-hidden="true">📊</i> {t.shell.insights}
        </Link>
        <Link href="/staff/settings" className="mtv-ov-nav">
          <i aria-hidden="true">⚙️</i> {t.shell.settings}
        </Link>

        <div className="mtv-ov-foot">
          <b>{identity.venueName}</b>
          {identity.displayName}
        </div>
      </aside>

      {/* ---------------------------------------------- main */}
      <main className="mtv-ov-main">
        <header className="mtv-ov-top">
          <div>
            <h1>{o.welcome.replace("{name}", identity.displayName)}</h1>
            <p>{o.sub}</p>
          </div>
          <span className="mtv-ov-when">{when}</span>
        </header>

        <div
          className="mtv-ov-vgrid"
          data-count={Math.min(3, overview.venues.length)}
        >
          {overview.venues.map((venue) => (
            <article
              key={venue.venueId}
              className="mtv-ov-vcard"
              data-edition={venue.edition}
            >
              <div className="mtv-ov-vhead">
                <span className="mtv-ov-vic" aria-hidden="true">
                  {EDITION_ICON[venue.edition] ?? "🍽️"}
                </span>
                <span className="mtv-ov-vtx">
                  <b>{venue.venueName}</b>
                  <i>
                    {venue.edition === "hotel"
                      ? o.cardSubHotel
                      : venue.edition === "bar"
                        ? o.cardSubBar
                        : o.cardSubRestaurant}
                  </i>
                </span>
              </div>
              <div className="mtv-ov-vstats">
                {cardStats(venue).map((stat) => (
                  <div key={stat.label} className="mtv-ov-vs">
                    <b>{stat.value}</b>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mtv-ov-vbtn"
                disabled={switching !== null}
                onClick={() => void openVenue(venue.venueId)}
              >
                {openLabel(venue.edition)}
              </button>
            </article>
          ))}
        </div>

        <p className="mtv-ov-sect">{o.acrossToday}</p>
        <div className="mtv-ov-pgrid">
          <div className="mtv-ov-pcard">
            <span>{o.kpiActiveGuests}</span>
            <b>{overview.activeGuests}</b>
            {guestsDelta ? (
              <i data-up={guestsDelta.up ? "true" : "false"}>
                {guestsDelta.text} {o.vsYesterday}
              </i>
            ) : null}
          </div>
          <div className="mtv-ov-pcard">
            <span>{o.kpiUnresolved}</span>
            <b>{overview.unresolvedRequests}</b>
          </div>
          <div className="mtv-ov-pcard">
            <span>{o.kpiAvgResponse}</span>
            <b>{minutes(overview.avgResponseSeconds)}</b>
            {responseDelta ? (
              // For response time, DOWN is good.
              <i data-up={responseDelta.up ? "false" : "true"}>
                {responseDelta.text} {o.vsYesterday}
              </i>
            ) : null}
          </div>
          <div className="mtv-ov-pcard">
            <span>{o.kpiStaffActive}</span>
            <b>{overview.staffActive}</b>
            <i data-up="true">{o.kpiStaffActiveSub}</i>
          </div>
          <div className="mtv-ov-pcard">
            <span>{o.kpiRevenue}</span>
            <b>{euro(overview.revenueTodayCents)}</b>
            {revenueDelta ? (
              <i data-up={revenueDelta.up ? "true" : "false"}>
                {revenueDelta.text} {o.vsYesterday}
              </i>
            ) : null}
          </div>
        </div>

        <div className="mtv-ov-row2">
          <section className="mtv-ov-panel">
            <h3>{o.needsAttention}</h3>
            {overview.alerts.length === 0 ? (
              <p className="mtv-ov-empty">{o.allQuiet}</p>
            ) : (
              overview.alerts.map((alert, index) => (
                <div
                  key={index}
                  className="mtv-ov-alert"
                  data-kind={alert.kind}
                >
                  <span className="mtv-ov-warn" aria-hidden="true" />
                  <span className="mtv-ov-alert-tx">
                    <b>
                      {alert.kind === "waiting"
                        ? (alert.edition === "hotel"
                            ? o.alertWaitingRooms
                            : o.alertWaitingTables
                          )
                            .replace("{count}", String(alert.count))
                            .replace("{min}", String(alert.minutes))
                        : alert.kind === "pass"
                          ? o.alertPass.replace("{count}", String(alert.count))
                          : `${
                              alert.edition === "hotel"
                                ? t.floor.roomN.replace("{label}", alert.label)
                                : t.floor.tableN.replace("{label}", alert.label)
                            } — “${alert.note}”`}
                    </b>
                    <i>
                      {clock(alert.at)} ·{" "}
                      {alert.kind === "pass" ? o.alertPassSub : o.alertNoteSub}
                    </i>
                  </span>
                  <span className="mtv-ov-chip" data-edition={alert.edition}>
                    {alert.venueName}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="mtv-ov-panel">
            <h3>{o.recentActivity}</h3>
            {overview.activity.length === 0 ? (
              <p className="mtv-ov-empty">{o.noActivity}</p>
            ) : (
              overview.activity.map((item, index) => {
                const labelWord = (label: string) =>
                  item.edition === "hotel"
                    ? t.floor.roomN.replace("{label}", label)
                    : t.floor.tableN.replace("{label}", label);
                const text =
                  item.kind === "seated"
                    ? `${o.actSeated.replace("{label}", labelWord(item.label) || "—")}${
                        item.guestCount
                          ? ` · ${o.actGuests.replace("{n}", String(item.guestCount))}`
                          : ""
                      }`
                    : item.kind === "closed"
                      ? o.actClosed.replace("{label}", labelWord(item.label) || "—")
                      : item.kind === "request"
                        ? `${pickLocale(item.detail ?? {}, locale) || "—"} → ${labelWord(item.label)}`
                        : item.kind === "delivered"
                          ? o.actDelivered.replace("{label}", labelWord(item.label))
                          : o.actOrder
                              .replace("{total}", euro(item.totalCents ?? 0))
                              .replace("{label}", labelWord(item.label));
                return (
                  <div key={index} className="mtv-ov-act">
                    <span className="mtv-ov-act-tm">{clock(item.at)}</span>
                    <span className="mtv-ov-act-tx">{text}</span>
                    <span className="mtv-ov-chip" data-edition={item.edition}>
                      {item.venueName}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
