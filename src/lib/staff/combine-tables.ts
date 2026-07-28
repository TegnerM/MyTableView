import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";

/**
 * Combining and uncombining tables.
 *
 * A waiter pushes three tables together for a party of ten. All three
 * tags stay live — guests at any of them can tap — but the requests
 * arrive as one thread and the visit reports as one party, not three.
 *
 * The floor plan itself is never edited. Combining is temporary state
 * over a permanent layout, so uncombining restores the original
 * arrangement with nothing to rebuild.
 */

export type CombineFailure =
  | "not_staff"
  | "invalid_input"
  | "not_found"
  | "different_venue"
  | "error";

export type CombineResult =
  | { ok: true; sessionId: string; tableIds: string[] }
  | { ok: false; reason: CombineFailure };

export type UncombineResult =
  | { ok: true; sessionIds: string[] }
  | { ok: false; reason: CombineFailure };

async function requireStaffVenue(): Promise<{
  staffId: string;
  venueId: string;
} | null> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const resolved = await resolveStaff();

  return resolved
    ? {
        staffId: resolved.current.staffId,
        venueId: resolved.current.venueId,
      }
    : null;
}

/**
 * Combines tables into a single visit.
 *
 * Delegates to a Postgres function: merging sessions means moving
 * requests, moving table links and closing the absorbed sessions, and
 * a half-finished merge would leave requests orphaned on a closed
 * visit.
 */
export async function combineTables(
  tableIds: string[]
): Promise<CombineResult> {
  const staff = await requireStaffVenue();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const unique = Array.from(new Set(tableIds.filter(isUuid)));

  if (unique.length !== tableIds.length || unique.length < 2) {
    return { ok: false, reason: "invalid_input" };
  }

  const supabase = await getServerClient();

  // o_ prefix per migration 017: the OUT parameter is renamed so it
  // cannot shadow the session_id columns inside the function.
  const { data, error } = await supabase
    .rpc("staff_combine_tables", {
      p_venue_id: staff.venueId,
      p_table_ids: unique,
    })
    .maybeSingle<{ o_session_id: string }>();

  if (error) {
    console.error("combineTables: rpc failed", error);
    if (error.code === "42501" || error.message.includes("does not belong")) {
      return { ok: false, reason: "different_venue" };
    }
    return { ok: false, reason: "error" };
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, sessionId: data.o_session_id, tableIds: unique };
}

/**
 * Splits a combined visit back into individual tables.
 *
 * The party has left, so the combined session closes and each table
 * returns to its original position with no session. Nothing is
 * re-seated automatically — the next guest tap opens a fresh visit.
 */
export async function uncombineTables(
  sessionId: string
): Promise<UncombineResult> {
  const staff = await requireStaffVenue();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  if (!isUuid(sessionId)) {
    return { ok: false, reason: "invalid_input" };
  }

  const supabase = await getServerClient();

  const { error } = await supabase.rpc("staff_uncombine_tables", {
    p_venue_id: staff.venueId,
    p_session_id: sessionId,
  });

  if (error) {
    console.error("uncombineTables: rpc failed", error);
    return { ok: false, reason: "error" };
  }

  return { ok: true, sessionIds: [sessionId] };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
