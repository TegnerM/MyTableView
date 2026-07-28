import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getServerClient } from "@/lib/supabase/server";
import {
  InsightsView,
  type InsightsData,
  type WeeklyPoint,
} from "@/components/staff/InsightsView";
import { StaffShell } from "@/components/staff/StaffShell";
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
      <InsightsView data={data} />
    </StaffShell>
  );
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
