import { getServiceClient } from "@/lib/supabase/service";
import { TAG_ID_PATTERN } from "@/lib/guest/resolve-tag";

/**
 * Saves the two-question satisfaction rating a guest gives at the
 * bill. Same trust model as guest requests: the client sends a tag ID
 * and two numbers, everything else is derived server-side, and the
 * write goes through the service client because guests never touch
 * Postgres.
 *
 * The rating attaches to the table's most recent visit — the open
 * session if there is one, otherwise a session closed within the last
 * two hours (asking for the bill often closes the visit before the
 * guest finishes tapping faces). One row per session, first answer
 * wins: the unique constraint absorbs duplicates quietly.
 */

export type RatingFailure =
  | "invalid_input"
  | "unknown_tag"
  | "tag_not_assigned"
  | "venue_unavailable"
  | "no_session"
  | "error";

export type RatingResult = { ok: true } | { ok: false; reason: RatingFailure };

const RECENTLY_CLOSED_MS = 2 * 60 * 60 * 1000;

type SessionLinkRow = {
  session_id: string;
  sessions: {
    id: string;
    state: string;
    venue_id: string;
    opened_at: string;
    closed_at: string | null;
  } | null;
};

export async function saveSessionRating(
  rawTagId: string,
  food: number,
  service: number
): Promise<RatingResult> {
  const tagId = rawTagId?.trim().toLowerCase() ?? "";

  if (!TAG_ID_PATTERN.test(tagId)) {
    return { ok: false, reason: "invalid_input" };
  }

  if (!isRating(food) || !isRating(service)) {
    return { ok: false, reason: "invalid_input" };
  }

  const supabase = getServiceClient();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("id, venue_id, table_id, venues:venue_id ( id, status )")
    .eq("id", tagId)
    .maybeSingle<{
      id: string;
      venue_id: string | null;
      table_id: string | null;
      venues: { id: string; status: string } | null;
    }>();

  if (tagError) {
    console.error("saveSessionRating: tag lookup failed", tagError.message);
    return { ok: false, reason: "error" };
  }

  if (!tag) {
    return { ok: false, reason: "unknown_tag" };
  }

  if (!tag.venue_id || !tag.table_id || !tag.venues) {
    return { ok: false, reason: "tag_not_assigned" };
  }

  if (tag.venues.status !== "active") {
    return { ok: false, reason: "venue_unavailable" };
  }

  // Same query shape as the guest request path (findOpenSessionId in
  // create-request.ts), which is proven in production: plain embed with
  // an explicit relationship hint, no server-side filters on the
  // embedded table, selection done in code.
  const { data: linkRows, error: linkError } = await supabase
    .from("session_tables")
    .select(
      "session_id, sessions:session_id ( id, state, venue_id, opened_at, closed_at )"
    )
    .eq("table_id", tag.table_id)
    .returns<SessionLinkRow[]>();

  if (linkError) {
    console.error("saveSessionRating: session lookup failed", linkError.message);
    return { ok: false, reason: "error" };
  }

  const forVenue = (linkRows ?? [])
    .map((row) => row.sessions)
    .filter(
      (session): session is NonNullable<SessionLinkRow["sessions"]> =>
        session !== null && session.venue_id === tag.venue_id
    );

  // The running visit wins; otherwise the visit that just ended — the
  // bill often closes the session before the guest finishes tapping.
  const cutoff = new Date(Date.now() - RECENTLY_CLOSED_MS).toISOString();

  const open = forVenue
    .filter((session) => session.state !== "closed")
    .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];

  const recentlyClosed = forVenue
    .filter(
      (session) =>
        session.state === "closed" &&
        session.closed_at !== null &&
        session.closed_at >= cutoff
    )
    .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))[0];

  const sessionId = open?.id ?? recentlyClosed?.id ?? null;

  if (!sessionId) {
    // Loud on purpose: a lost rating must never be silent again.
    console.error(
      "saveSessionRating: no session found for table",
      tag.table_id,
      "links:",
      (linkRows ?? []).length
    );
    return { ok: false, reason: "no_session" };
  }

  // First answer wins; a second submit for the same visit is silently
  // absorbed rather than overwriting or erroring at the guest.
  const { error: insertError } = await supabase
    .from("session_ratings")
    .upsert(
      {
        venue_id: tag.venue_id,
        session_id: sessionId,
        food_rating: food,
        service_rating: service,
      },
      { onConflict: "session_id", ignoreDuplicates: true }
    );

  if (insertError) {
    console.error("saveSessionRating: insert failed", insertError.message);
    return { ok: false, reason: "error" };
  }

  return { ok: true };
}

function isRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
