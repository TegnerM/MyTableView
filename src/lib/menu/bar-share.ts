import { getServiceClient } from "@/lib/supabase/service";
import { venueBaseName } from "@/lib/staff/venue-groups";

/**
 * Bar menu sharing — "Also on the bar menu".
 *
 * A venue with a full menu (restaurant or hotel edition) can tick a
 * dish so it ALSO appears on the linked bar's guest menu. The link is
 * resolved by account: every venue on the same billing account whose
 * edition is 'bar'. When venues are named as a property group
 * ("<Property> — Restaurant" / "<Property> — Bar"), bars of the SAME
 * property win over unrelated bars on the account.
 *
 * Server-only (service client); callers gate authorization.
 */

type VenueRow = {
  id: string;
  name: string;
  edition: string | null;
  account_id: string | null;
};

async function accountVenues(venueId: string): Promise<{
  self: VenueRow;
  siblings: VenueRow[];
} | null> {
  const service = getServiceClient();

  const { data: self, error } = await service
    .from("venues")
    .select("id, name, edition, account_id")
    .eq("id", venueId)
    .maybeSingle<VenueRow>();

  if (error || !self) {
    if (error) console.error("bar-share: venue lookup failed", error.message);
    return null;
  }

  if (!self.account_id) {
    return { self, siblings: [] };
  }

  const { data: siblings, error: siblingsError } = await service
    .from("venues")
    .select("id, name, edition, account_id")
    .eq("account_id", self.account_id)
    .neq("id", venueId)
    .returns<VenueRow[]>();

  if (siblingsError) {
    console.error("bar-share: siblings lookup failed", siblingsError.message);
    return { self, siblings: [] };
  }

  return { self, siblings: siblings ?? [] };
}

/** Prefer venues of the same property group; fall back to the whole
 *  account when the group has no match. */
function preferSameProperty(self: VenueRow, candidates: VenueRow[]): VenueRow[] {
  const base = venueBaseName(self.name);
  const sameProperty = candidates.filter(
    (venue) => venueBaseName(venue.name) === base
  );
  return sameProperty.length > 0 ? sameProperty : candidates;
}

/**
 * For a full-menu venue: the bar its ticked dishes publish to, or null
 * when the account has no bar (the editor hides the tick then).
 */
export async function linkedBarVenue(
  venueId: string
): Promise<{ id: string; name: string } | null> {
  const resolved = await accountVenues(venueId);
  if (!resolved) return null;

  const { self, siblings } = resolved;

  // Bars don't share ONTO other bars — the tick lives on full menus.
  if ((self.edition ?? "restaurant") === "bar") {
    return null;
  }

  const bars = siblings.filter((venue) => venue.edition === "bar");
  if (bars.length === 0) return null;

  const preferred = preferSameProperty(self, bars);
  return { id: preferred[0].id, name: preferred[0].name };
}

/**
 * For a bar venue: the full-menu venues whose ticked dishes appear on
 * this bar's guest menu. Empty for non-bar venues.
 */
export async function barShareSourceVenueIds(
  barVenueId: string
): Promise<string[]> {
  const resolved = await accountVenues(barVenueId);
  if (!resolved) return [];

  const { self, siblings } = resolved;

  if ((self.edition ?? "restaurant") !== "bar") {
    return [];
  }

  const fullMenus = siblings.filter((venue) => venue.edition !== "bar");
  if (fullMenus.length === 0) return [];

  return preferSameProperty(self, fullMenus).map((venue) => venue.id);
}
