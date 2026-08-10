import { getServiceClient } from "@/lib/supabase/service";
import type { LocaleMap } from "@/lib/menu/types";

/**
 * Property Overview — the numbers behind the login dashboard.
 *
 * One load for the whole account: per-venue live stats, the property
 * strip, "needs attention" alerts and the recent-activity feed. Every
 * figure is real service data; nothing is estimated. Service client —
 * the page gates on owner/manager membership first.
 */

export type OverviewVenue = {
  venueId: string;
  venueName: string;
  edition: string;
  /** Open sessions vs active tables (occupied rooms for hotels). */
  occupied: number;
  capacity: number;
  /** Guests currently seated (sum of session head-counts). */
  guestsSeated: number;
  /** Open + acknowledged non-order requests. */
  openRequests: number;
  /** Orders whose tickets are still new/preparing. */
  ordersInProgress: number;
  /** Tickets sitting ready on the pass. */
  readyToServe: number;
  /** Open room-service / food orders. */
  openOrders: number;
  /** Average request response (created → acknowledged) today, seconds. */
  avgResponseSeconds: number | null;
};

export type OverviewAlert = {
  venueId: string;
  venueName: string;
  edition: string;
  kind: "waiting" | "pass" | "note";
  /** waiting: how many requests are past the escalation grace. */
  count: number;
  /** waiting: the venue's grace threshold in minutes. */
  minutes: number;
  /** note: the request's label + guest note. */
  label: string;
  note: string;
  at: string;
};

export type OverviewActivity = {
  venueId: string;
  venueName: string;
  edition: string;
  at: string;
  kind: "seated" | "request" | "order" | "delivered" | "closed";
  /** Table/room label. */
  label: string;
  /** request: localized request-type label. order: formatted total. */
  detail: LocaleMap | null;
  totalCents: number | null;
  guestCount: number | null;
};

export type PropertyOverview = {
  venues: OverviewVenue[];
  activeGuests: number;
  sessionsToday: number;
  sessionsYesterday: number;
  unresolvedRequests: number;
  avgResponseSeconds: number | null;
  avgResponseYesterdaySeconds: number | null;
  staffActive: number;
  revenueTodayCents: number;
  revenueYesterdayCents: number;
  alerts: OverviewAlert[];
  activity: OverviewActivity[];
};

const ACTIVE_STAFF_WINDOW_MS = 30 * 60 * 1000;
const PASS_WARN_MS = 4 * 60 * 1000;
const DEFAULT_GRACE_SECONDS = 8 * 60;

type Membership = { venueId: string; venueName: string; edition: string };

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function loadPropertyOverview(
  memberships: Membership[]
): Promise<PropertyOverview> {
  const service = getServiceClient();
  const venueIds = memberships.map((m) => m.venueId);
  const byId = new Map(memberships.map((m) => [m.venueId, m]));

  const now = Date.now();
  const todayStart = startOfToday();
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const yesterdaySameTime = new Date(now - 86_400_000);

  const [
    tablesResult,
    openSessionsResult,
    sessionsResult,
    requestsResult,
    ordersResult,
    ticketsResult,
    staffResult,
    graceResult,
  ] = await Promise.all([
    service
      .from("tables")
      .select("id, venue_id")
      .in("venue_id", venueIds)
      .eq("active", true)
      .returns<{ id: string; venue_id: string }[]>(),
    service
      .from("sessions")
      .select("id, venue_id, state, opened_at, closed_at, guest_count")
      .in("venue_id", venueIds)
      .neq("state", "closed")
      .returns<
        {
          id: string;
          venue_id: string;
          state: string;
          opened_at: string;
          closed_at: string | null;
          guest_count: number | null;
        }[]
      >(),
    service
      .from("sessions")
      .select("id, venue_id, state, opened_at, closed_at, guest_count")
      .in("venue_id", venueIds)
      .gte("opened_at", yesterdayStart.toISOString())
      .order("opened_at", { ascending: false })
      .limit(500)
      .returns<
        {
          id: string;
          venue_id: string;
          state: string;
          opened_at: string;
          closed_at: string | null;
          guest_count: number | null;
        }[]
      >(),
    service
      .from("requests")
      .select(
        `
          id, venue_id, state, created_at, acknowledged_at, note,
          tables:table_id ( label ),
          request_types:request_type_id ( kind, code, label )
        `
      )
      .in("venue_id", venueIds)
      .gte("created_at", yesterdayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(600)
      .returns<
        {
          id: string;
          venue_id: string;
          state: string;
          created_at: string;
          acknowledged_at: string | null;
          note: string | null;
          tables: { label: string } | null;
          request_types: { kind: string; code: string; label: LocaleMap | null } | null;
        }[]
      >(),
    service
      .from("orders")
      .select("id, venue_id, state, total_cents, created_at, tables:table_id ( label )")
      .in("venue_id", venueIds)
      .gte("created_at", yesterdayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(400)
      .returns<
        {
          id: string;
          venue_id: string;
          state: string;
          total_cents: number;
          created_at: string;
          tables: { label: string } | null;
        }[]
      >(),
    service
      .from("order_tickets")
      .select("id, venue_id, order_id, state, ready_at")
      .in("venue_id", venueIds)
      .in("state", ["new", "preparing", "ready"])
      .returns<
        {
          id: string;
          venue_id: string;
          order_id: string;
          state: string;
          ready_at: string | null;
        }[]
      >(),
    service
      .from("staff")
      .select("id, user_id, venue_id, last_seen_at")
      .in("venue_id", venueIds)
      .eq("active", true)
      .returns<{ id: string; user_id: string | null; venue_id: string; last_seen_at: string | null }[]>(),
    service
      .from("venues")
      .select("id, escalation_grace_seconds")
      .in("id", venueIds)
      .returns<{ id: string; escalation_grace_seconds: number | null }[]>(),
  ]);

  const tables = tablesResult.data ?? [];
  // Current state (occupancy, guests seated): NO date filter — a hotel
  // stay opened last week is still occupied today.
  const openSessions = openSessionsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const tickets = ticketsResult.data ?? [];
  const staff = staffResult.data ?? [];
  const graceByVenue = new Map(
    (graceResult.data ?? []).map((row) => [
      row.id,
      row.escalation_grace_seconds ?? DEFAULT_GRACE_SECONDS,
    ])
  );

  for (const result of [
    tablesResult, openSessionsResult, sessionsResult, requestsResult,
    ordersResult, ticketsResult, staffResult, graceResult,
  ]) {
    if (result.error) {
      console.error("loadPropertyOverview:", result.error.message);
    }
  }

  // Table/room labels for the activity feed — scoped to OUR sessions.
  const labelBySession = new Map<string, string>();
  const sessionIds = [
    ...new Set([
      ...openSessions.map((session) => session.id),
      ...sessions.slice(0, 200).map((session) => session.id),
    ]),
  ].slice(0, 400);
  if (sessionIds.length > 0) {
    const { data: links, error: linkError } = await service
      .from("session_tables")
      .select("session_id, tables:table_id ( label )")
      .in("session_id", sessionIds)
      .returns<{ session_id: string; tables: { label: string } | null }[]>();
    if (linkError) {
      console.error("loadPropertyOverview: labels failed", linkError.message);
    }
    for (const row of links ?? []) {
      if (row.tables?.label && !labelBySession.has(row.session_id)) {
        labelBySession.set(row.session_id, row.tables.label);
      }
    }
  }

  const isServiceRequest = (row: (typeof requests)[number]) =>
    row.request_types?.kind !== "order";
  const openStates = new Set(["open", "acknowledged"]);

  /* ---------------------------------------------- per venue */

  const venues: OverviewVenue[] = memberships.map((membership) => {
    const id = membership.venueId;
    const mySessions = openSessions.filter((s) => s.venue_id === id);
    const myRequests = requests.filter((r) => r.venue_id === id);
    const myTickets = tickets.filter((t) => t.venue_id === id);
    const myOrders = orders.filter((o) => o.venue_id === id);

    const responded = myRequests.filter(
      (r) =>
        isServiceRequest(r) &&
        r.acknowledged_at &&
        Date.parse(r.created_at) >= todayStart.getTime()
    );

    const inProgressOrders = new Set(
      myTickets
        .filter((t) => t.state === "new" || t.state === "preparing")
        .map((t) => t.order_id)
    );

    return {
      venueId: id,
      venueName: membership.venueName,
      edition: membership.edition,
      occupied: mySessions.length,
      capacity: tables.filter((t) => t.venue_id === id).length,
      guestsSeated: mySessions.reduce(
        (sum, s) => sum + Math.max(1, s.guest_count ?? 1),
        0
      ),
      openRequests: myRequests.filter(
        (r) => isServiceRequest(r) && openStates.has(r.state)
      ).length,
      ordersInProgress: inProgressOrders.size,
      readyToServe: myTickets.filter((t) => t.state === "ready").length,
      openOrders: myOrders.filter((o) => o.state === "open").length,
      avgResponseSeconds: avg(
        responded.map(
          (r) =>
            (Date.parse(r.acknowledged_at as string) - Date.parse(r.created_at)) /
            1000
        )
      ),
    };
  });

  /* ---------------------------------------------- property strip */

  const respondedToday = requests.filter(
    (r) =>
      isServiceRequest(r) &&
      r.acknowledged_at &&
      Date.parse(r.created_at) >= todayStart.getTime()
  );
  const respondedYesterday = requests.filter(
    (r) =>
      isServiceRequest(r) &&
      r.acknowledged_at &&
      Date.parse(r.created_at) < todayStart.getTime()
  );

  // If a query hit its row cap, yesterday's slice is what got cut —
  // a delta computed from it would flatter today. Suppress instead.
  const requestsTruncated = requests.length >= 600;
  const ordersTruncated = orders.length >= 400;
  const sessionsTruncated = sessions.length >= 500;

  const revenue = (from: number, to: number) =>
    orders
      .filter(
        (o) =>
          o.state !== "cancelled" &&
          Date.parse(o.created_at) >= from &&
          Date.parse(o.created_at) < to
      )
      .reduce((sum, o) => sum + o.total_cents, 0);

  /* ---------------------------------------------- alerts */

  const alerts: OverviewAlert[] = [];
  for (const membership of memberships) {
    const id = membership.venueId;
    const grace = graceByVenue.get(id) ?? DEFAULT_GRACE_SECONDS;

    const waiting = requests.filter(
      (r) =>
        r.venue_id === id &&
        isServiceRequest(r) &&
        r.state === "open" &&
        now - Date.parse(r.created_at) > grace * 1000
    );
    if (waiting.length > 0) {
      alerts.push({
        venueId: id,
        venueName: membership.venueName,
        edition: membership.edition,
        kind: "waiting",
        count: waiting.length,
        minutes: Math.round(grace / 60),
        label: "",
        note: "",
        at: waiting[waiting.length - 1].created_at,
      });
    }

    const onPass = tickets.filter(
      (t) =>
        t.venue_id === id &&
        t.state === "ready" &&
        t.ready_at &&
        now - Date.parse(t.ready_at) > PASS_WARN_MS
    );
    if (onPass.length > 0) {
      alerts.push({
        venueId: id,
        venueName: membership.venueName,
        edition: membership.edition,
        kind: "pass",
        count: onPass.length,
        minutes: Math.round(PASS_WARN_MS / 60_000),
        label: "",
        note: "",
        at: onPass[0].ready_at as string,
      });
    }

    // Unacknowledged requests that carry a guest note (maintenance and
    // friends) — surfaced individually, the note is the alert.
    const noted = requests.filter(
      (r) =>
        r.venue_id === id &&
        isServiceRequest(r) &&
        r.state === "open" &&
        r.note &&
        r.note.trim()
    );
    for (const request of noted.slice(0, 2)) {
      alerts.push({
        venueId: id,
        venueName: membership.venueName,
        edition: membership.edition,
        kind: "note",
        count: 1,
        minutes: 0,
        label: request.tables?.label ?? "",
        note: request.note as string,
        at: request.created_at,
      });
    }
  }
  alerts.sort((a, b) => a.at.localeCompare(b.at));

  /* ---------------------------------------------- activity feed */

  const activity: OverviewActivity[] = [];
  const push = (item: OverviewActivity) => activity.push(item);

  for (const session of sessions.slice(0, 200)) {
    const membership = byId.get(session.venue_id);
    if (!membership) continue;
    if (Date.parse(session.opened_at) >= todayStart.getTime()) {
      push({
        venueId: session.venue_id,
        venueName: membership.venueName,
        edition: membership.edition,
        at: session.opened_at,
        kind: "seated",
        label: labelBySession.get(session.id) ?? "",
        detail: null,
        totalCents: null,
        guestCount: session.guest_count,
      });
    }
    if (session.closed_at && Date.parse(session.closed_at) >= todayStart.getTime()) {
      push({
        venueId: session.venue_id,
        venueName: membership.venueName,
        edition: membership.edition,
        at: session.closed_at,
        kind: "closed",
        label: labelBySession.get(session.id) ?? "",
        detail: null,
        totalCents: null,
        guestCount: null,
      });
    }
  }

  for (const request of requests) {
    if (!isServiceRequest(request)) continue;
    if (Date.parse(request.created_at) < todayStart.getTime()) continue;
    const membership = byId.get(request.venue_id);
    if (!membership) continue;
    push({
      venueId: request.venue_id,
      venueName: membership.venueName,
      edition: membership.edition,
      at: request.created_at,
      kind: "request",
      label: request.tables?.label ?? "",
      detail: request.request_types?.label ?? null,
      totalCents: null,
      guestCount: null,
    });
  }

  for (const order of orders) {
    if (Date.parse(order.created_at) < todayStart.getTime()) continue;
    const membership = byId.get(order.venue_id);
    if (!membership) continue;
    push({
      venueId: order.venue_id,
      venueName: membership.venueName,
      edition: membership.edition,
      at: order.created_at,
      kind: order.state === "delivered" ? "delivered" : "order",
      label: order.tables?.label ?? "",
      detail: null,
      totalCents: order.total_cents,
      guestCount: null,
    });
  }

  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    venues,
    activeGuests: openSessions.reduce(
      (sum, s) => sum + Math.max(1, s.guest_count ?? 1),
      0
    ),
    sessionsToday: sessions.filter(
      (s) => Date.parse(s.opened_at) >= todayStart.getTime()
    ).length,
    sessionsYesterday: sessionsTruncated
      ? 0
      : sessions.filter(
          (s) =>
            Date.parse(s.opened_at) < todayStart.getTime() &&
            Date.parse(s.opened_at) <= yesterdaySameTime.getTime()
        ).length,
    unresolvedRequests: requests.filter(
      (r) => isServiceRequest(r) && openStates.has(r.state)
    ).length,
    avgResponseSeconds: avg(
      respondedToday.map(
        (r) =>
          (Date.parse(r.acknowledged_at as string) - Date.parse(r.created_at)) /
          1000
      )
    ),
    avgResponseYesterdaySeconds: requestsTruncated
      ? null
      : avg(
          respondedYesterday.map(
            (r) =>
              (Date.parse(r.acknowledged_at as string) -
                Date.parse(r.created_at)) /
              1000
          )
        ),
    staffActive: new Set(
      staff
        .filter(
          (member) =>
            member.last_seen_at &&
            now - Date.parse(member.last_seen_at) < ACTIVE_STAFF_WINDOW_MS
        )
        .map((member) => member.user_id ?? member.id)
    ).size,
    revenueTodayCents: revenue(todayStart.getTime(), now + 1),
    revenueYesterdayCents: ordersTruncated
      ? 0
      : revenue(yesterdayStart.getTime(), yesterdaySameTime.getTime()),
    alerts: alerts.slice(0, 5),
    activity: activity.slice(0, 8),
  };
}
