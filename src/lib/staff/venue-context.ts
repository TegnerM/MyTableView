import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";

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
};

type StaffRow = {
  id: string;
  venue_id: string;
  display_name: string;
  role: "owner" | "manager" | "waiter";
  venues: { name: string } | null;
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

  const { data, error } = await supabase
    .from("staff")
    .select("id, venue_id, display_name, role, venues:venue_id ( name )")
    .eq("user_id", user.id)
    .eq("active", true)
    .returns<StaffRow[]>();

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

  return { current, memberships };
}
