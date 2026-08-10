import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * Multi-venue resolution — the single choke point that decides which
 * venue a signed-in staff member is working as right now.
 *
 * The data model has been many-to-many from day one (staff rows link
 * users to venues), so an account with one venue and an account with
 * three hundred work identically: RLS policies, SECURITY DEFINER
 * functions and realtime filters all scope by venue through the staff
 * link. What this module adds is the CHOICE: a device cookie holds the
 * venue the user is currently working as, validated on every request
 * against their real memberships — a stale or forged cookie silently
 * falls back to their first venue, never into someone else's.
 *
 * Every staff surface and every staff action resolves through here.
 * A split brain — floor showing venue A while an action hits venue B —
 * must be impossible by construction.
 */

export const VENUE_COOKIE = "mtv-venue";

export type StaffMembership = {
  staffId: string;
  venueId: string;
  venueName: string;
  displayName: string;
  role: "owner" | "manager" | "waiter";
  /** The venue's edition — drives Rooms/Tables wording. */
  edition: string;
  /** Last time a screen signed in as this staff row talked to us. */
  lastSeenAt: string | null;
};

type StaffRow = {
  id: string;
  venue_id: string;
  display_name: string;
  role: "owner" | "manager" | "waiter";
  last_seen_at: string | null;
  venues: { name: string; edition: string | null } | null;
};

/** All active memberships for the signed-in user, name order. */
export async function listMemberships(): Promise<StaffMembership[]> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  let { data, error } = await supabase
    .from("staff")
    .select("id, venue_id, display_name, role, last_seen_at, venues:venue_id ( name, edition )")
    .eq("user_id", user.id)
    .eq("active", true)
    .returns<StaffRow[]>();

  // Deploy-order safety: if the presence column hasn't been migrated
  // yet, retry without it. A missing dashboard stat must NEVER lock
  // the whole staff app.
  if (error && /last_seen_at/.test(error.message)) {
    const retry = await supabase
      .from("staff")
      .select("id, venue_id, display_name, role, venues:venue_id ( name, edition )")
      .eq("user_id", user.id)
      .eq("active", true)
      .returns<StaffRow[]>();
    data = (retry.data ?? []).map((row) => ({ ...row, last_seen_at: null }));
    error = retry.error;
  }

  if (error || !data) {
    if (error) {
      console.error("listMemberships: failed", error.message);
    }
    return [];
  }

  return data
    .map((row) => ({
      staffId: row.id,
      venueId: row.venue_id,
      venueName: row.venues?.name ?? "",
      displayName: row.display_name,
      role: row.role,
      edition: row.venues?.edition ?? "restaurant",
      lastSeenAt: row.last_seen_at ?? null,
    }))
    .sort((a, b) => a.venueName.localeCompare(b.venueName));
}

export type ResolvedStaff = {
  current: StaffMembership;
  memberships: StaffMembership[];
};

/**
 * The membership this device is working as: the cookie's venue when it
 * matches a real membership, otherwise the first venue. Null when the
 * user is signed out or staff nowhere.
 */
export async function resolveStaff(): Promise<ResolvedStaff | null> {
  const memberships = await listMemberships();

  if (memberships.length === 0) {
    return null;
  }

  const store = await cookies();
  const wanted = store.get(VENUE_COOKIE)?.value;

  const current =
    memberships.find((m) => m.venueId === wanted) ?? memberships[0];

  // Presence heartbeat: every staff request passes through here, so a
  // throttled stamp makes "who's on their screens right now" free.
  // Best-effort — presence must never slow or fail a real request.
  const STALE_MS = 5 * 60 * 1000;
  const seen = current.lastSeenAt ? Date.parse(current.lastSeenAt) : 0;
  if (!Number.isFinite(seen) || Date.now() - seen > STALE_MS) {
    try {
      const service = getServiceClient();
      await service
        .from("staff")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", current.staffId);
    } catch {
      // Column not migrated yet, or a blip — presence just lags.
    }
  }

  return { current, memberships };
}
