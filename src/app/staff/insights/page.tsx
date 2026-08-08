import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getServerClient } from "@/lib/supabase/server";
import {
  InsightsView,
  type InsightsData,
  type WeeklyPoint,
} from "@/components/staff/InsightsView";
import {
  OrderingInsights,
  type OrderingHourPoint,
  type OrderingInsightsData,
} from "@/components/staff/OrderingInsights";
import { StaffShell } from "@/components/staff/StaffShell";
import { getServiceClient } from "@/lib/supabase/service";
import { resolveStaffLocale, STAFF_LANG_COOKIE } from "@/lib/i18n/staff";
import "../floor/floor.css";
import "./insights.css";

/**
 * Guest satisfaction results. Managers and owners only — same gate as
 * Settings. Ratings are read through RLS: the policy on
 * session_ratings scopes rows to the caller's venue.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_DAYS = 90;
const TREND_WEEKS = 6;

type RatingRow = {
  food_rating: number;
  service_rating: number;
  created_at: string;
};

export default async function StaffInsightsPage() {
  const store = await cookies();
  const headerList = await headers();
  const locale = resolveStaffLocale(
    store.get(STAFF_LANG_COOKIE)?.value,
    headerList.get("accept-language")
  );

  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  if (identity.role !== "owner" && identity.role !== "manager") {
    redirect("/staff/floor");
  }

  const supabase = await getServerClient();
  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("session_ratings")
    .select("food_rating, service_rating, created_at")
    .eq("venue_id", identity.venueId)
    .gte("created_at", since)
    .returns<RatingRow[]>();

  if (error) {
    console.error("insights: ratings query failed", error.message);
  }

  const ratings = rows ?? [];

  const ordering = await loadOrderingInsights(identity.venueId);

  const data: InsightsData = {
    venueName: identity.venueName,
    responses: ratings.length,
    avgFood: average(ratings.map((row) => row.food_rating)),
    avgService: average(ratings.map((row) => row.service_rating)),
    weeks: weeklyTrend(ratings),
  };

  return (
    <StaffShell
      active="insights"
      displayName={identity.displayName}
      role={identity.role}
      venueId={identity.venueId}
      venues={identity.venues}
    >
      <InsightsView data={data} locale={locale} />
      <OrderingInsights data={ordering} locale={locale} />
    </StaffShell>
  );
}

/* ------------------------------------------------- ordering clock */

type TicketTimingRow = {
  order_id: string;
  station: string;
  state: string;
  created_at: string;
  ready_at: string | null;
  delivered_at: string | null;
};

/**
 * The service clock, last 24 hours. Preparation = placed → ready per
 * station; pickup = ready → delivered. Cancelled tickets don't count —
 * they measure a mistake, not the service.
 */
async function loadOrderingInsights(
  venueId: string
): Promise<OrderingInsightsData> {
  const service = getServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await service
    .from("order_tickets")
    .select("order_id, station, state, created_at, ready_at, delivered_at")
    .eq("venue_id", venueId)
    .gte("created_at", since)
    .neq("state", "cancelled")
    .returns<TicketTimingRow[]>();

  if (error) {
    console.error("insights: ordering query failed", error.message);
  }

  const tickets = data ?? [];
  const orders = new Set(tickets.map((ticket) => ticket.order_id)).size;

  const prepSeconds = (ticket: TicketTimingRow): number | null =>
    ticket.ready_at
      ? (new Date(ticket.ready_at).getTime() -
          new Date(ticket.created_at).getTime()) /
        1000
      : null;

  const pickupSeconds = (ticket: TicketTimingRow): number | null =>
    ticket.ready_at && ticket.delivered_at
      ? (new Date(ticket.delivered_at).getTime() -
          new Date(ticket.ready_at).getTime()) /
        1000
      : null;

  const kitchenPreps = tickets
    .filter((ticket) => ticket.station === "kitchen")
    .map(prepSeconds)
    .filter((value): value is number => value !== null && value >= 0);
  const barPreps = tickets
    .filter((ticket) => ticket.station === "bar")
    .map(prepSeconds)
    .filter((value): value is number => value !== null && value >= 0);
  const pickups = tickets
    .map(pickupSeconds)
    .filter((value): value is number => value !== null && value >= 0);

  const avg = (values: number[]): number | null =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;

  // Hour buckets keyed by the hour-start EPOCH, oldest → newest. The
  // 24h window spans two calendar days, so keying by "HH:00" alone
  // would merge yesterday-15:xx with today-15:xx into one bar.
  const buckets = new Map<number, { prep: number[]; pickup: number[]; count: number; label: string }>();
  for (const ticket of tickets) {
    const at = new Date(ticket.created_at);
    const hourStart = new Date(at);
    hourStart.setMinutes(0, 0, 0);
    const key = hourStart.getTime();
    const bucket =
      buckets.get(key) ?? {
        prep: [],
        pickup: [],
        count: 0,
        label: `${String(at.getHours()).padStart(2, "0")}:00`,
      };
    bucket.count += 1;
    const prep = prepSeconds(ticket);
    if (prep !== null && prep >= 0) bucket.prep.push(prep);
    const pickup = pickupSeconds(ticket);
    if (pickup !== null && pickup >= 0) bucket.pickup.push(pickup);
    buckets.set(key, bucket);
  }

  const hours: OrderingHourPoint[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => ({
      label: bucket.label,
      count: bucket.count,
      avgPrepSeconds: avg(bucket.prep),
      avgPickupSeconds: avg(bucket.pickup),
    }));

  return {
    orders,
    avgKitchenSeconds: avg(kitchenPreps),
    avgBarSeconds: avg(barPreps),
    avgPickupSeconds: avg(pickups),
    hours,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/** The last TREND_WEEKS calendar weeks, oldest first. */
function weeklyTrend(ratings: RatingRow[]): WeeklyPoint[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const weeks: WeeklyPoint[] = [];

  for (let i = TREND_WEEKS - 1; i >= 0; i -= 1) {
    const end = now - i * weekMs;
    const start = end - weekMs;

    const inWeek = ratings.filter((row) => {
      const at = new Date(row.created_at).getTime();
      return at > start && at <= end;
    });

    const endDate = new Date(end);
    weeks.push({
      label: `${endDate.getDate()}/${endDate.getMonth() + 1}`,
      food: average(inWeek.map((row) => row.food_rating)),
      service: average(inWeek.map((row) => row.service_rating)),
      count: inWeek.length,
    });
  }

  return weeks;
}
