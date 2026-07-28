import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { resolveStaff } from "@/lib/staff/venue-context";

/**
 * Staff actions on requests.
 *
 * These run as the signed-in staff member, so RLS from migration 002
 * guarantees a waiter can only touch requests at their own venue. No
 * venue ID is accepted from the client.
 *
 * The important rule lives here: fulfilling a request whose type closes
 * the session is what ends the visit. That captures the moment the bill
 * was actually delivered, not the moment the guest asked for it.
 */

export type ActionFailure =
  | "not_signed_in"
  | "not_staff"
  | "not_found"
  | "invalid_state"
  | "error";

export type ActionResult =
  | { ok: true; requestId: string; sessionClosed: boolean }
  | { ok: false; reason: ActionFailure };

type StaffContext = {
  staffId: string;
  venueId: string;
};

async function requireStaff(): Promise<StaffContext | null> {
  const resolved = await resolveStaff();

  if (!resolved) {
    return null;
  }

  return {
    staffId: resolved.current.staffId,
    venueId: resolved.current.venueId,
  };
}

/**
 * Marks a request as seen. The guest's waiting clock keeps running —
 * acknowledging is not the same as serving.
 */
export async function acknowledgeRequest(
  requestId: string
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("requests")
    .update({
      state: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: staff.staffId,
    })
    .eq("id", requestId)
    .eq("state", "open")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("acknowledgeRequest: failed", error);
    return { ok: false, reason: "error" };
  }

  if (!data) {
    // Either RLS hid it, it does not exist, or another waiter got there
    // first. All three are the same thing from the caller's side.
    return { ok: false, reason: "invalid_state" };
  }

  return { ok: true, requestId: data.id, sessionClosed: false };
}

/**
 * Marks a request as served.
 *
 * If the request type closes the session, this also ends the visit —
 * but only once no other request on that session is still outstanding.
 * A table that asked for the bill and a coffee should not have its
 * visit closed while the coffee is still coming.
 */
export async function fulfilRequest(requestId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = await getServerClient();

  const { data: request, error: loadError } = await supabase
    .from("requests")
    .select(
      "id, session_id, state, request_types:request_type_id ( closes_session )"
    )
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      session_id: string;
      state: string;
      request_types: { closes_session: boolean } | null;
    }>();

  if (loadError) {
    console.error("fulfilRequest: load failed", loadError);
    return { ok: false, reason: "error" };
  }

  if (!request) {
    return { ok: false, reason: "not_found" };
  }

  if (request.state === "fulfilled" || request.state === "cancelled") {
    return { ok: false, reason: "invalid_state" };
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("requests")
    .update({
      state: "fulfilled",
      fulfilled_at: now,
      fulfilled_by: staff.staffId,
      // A request served without being acknowledged first still needs an
      // acknowledgement timestamp, or response-time reporting has a hole.
      acknowledged_at: request.state === "acknowledged" ? undefined : now,
      acknowledged_by:
        request.state === "acknowledged" ? undefined : staff.staffId,
    })
    .eq("id", requestId)
    .in("state", ["open", "acknowledged"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (updateError) {
    console.error("fulfilRequest: update failed", updateError);
    return { ok: false, reason: "error" };
  }

  if (!updated) {
    return { ok: false, reason: "invalid_state" };
  }

  let sessionClosed = false;

  if (request.request_types?.closes_session) {
    sessionClosed = await closeSessionIfClear(request.session_id, now);
  }

  return { ok: true, requestId: updated.id, sessionClosed };
}

/**
 * Fulfils every outstanding request at a table in one action.
 *
 * This is the normal case, not an edge case: a waiter walks to a table
 * once and deals with whatever is waiting there. Clearing them one at a
 * time on a handheld while standing at the table is friction nobody
 * needs.
 *
 * If any of the cleared requests closes the session, the visit ends —
 * same rule as fulfilling that request on its own.
 */
export async function fulfilTableRequests(
  tableId: string
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = await getServerClient();

  const { data: pending, error: loadError } = await supabase
    .from("requests")
    .select(
      "id, session_id, state, request_types:request_type_id ( closes_session )"
    )
    .eq("table_id", tableId)
    .in("state", ["open", "acknowledged"])
    .returns<
      {
        id: string;
        session_id: string;
        state: string;
        request_types: { closes_session: boolean } | null;
      }[]
    >();

  if (loadError) {
    console.error("fulfilTableRequests: load failed", loadError);
    return { ok: false, reason: "error" };
  }

  if (!pending || pending.length === 0) {
    return { ok: false, reason: "invalid_state" };
  }

  const now = new Date().toISOString();
  const ids = pending.map((row) => row.id);

  const { error: updateError } = await supabase
    .from("requests")
    .update({
      state: "fulfilled",
      fulfilled_at: now,
      fulfilled_by: staff.staffId,
    })
    .in("id", ids)
    .in("state", ["open", "acknowledged"]);

  if (updateError) {
    console.error("fulfilTableRequests: update failed", updateError);
    return { ok: false, reason: "error" };
  }

  // Requests served without being acknowledged first still need an
  // acknowledgement timestamp, or response-time reporting has a hole.
  const unacknowledged = pending
    .filter((row) => row.state === "open")
    .map((row) => row.id);

  if (unacknowledged.length > 0) {
    await supabase
      .from("requests")
      .update({ acknowledged_at: now, acknowledged_by: staff.staffId })
      .in("id", unacknowledged)
      .is("acknowledged_at", null);
  }

  let sessionClosed = false;

  const closer = pending.find((row) => row.request_types?.closes_session);
  if (closer) {
    sessionClosed = await closeSessionIfClear(closer.session_id, now);
  }

  return { ok: true, requestId: ids[0], sessionClosed };
}

/**
 * Closes a visit, provided nothing else is still outstanding on it.
 */
async function closeSessionIfClear(
  sessionId: string,
  at: string
): Promise<boolean> {
  const supabase = await getServerClient();

  const { data: outstanding, error } = await supabase
    .from("requests")
    .select("id")
    .eq("session_id", sessionId)
    .in("state", ["open", "acknowledged"])
    .limit(1)
    .returns<{ id: string }[]>();

  if (error) {
    console.error("closeSessionIfClear: outstanding check failed", error);
    return false;
  }

  if ((outstanding ?? []).length > 0) {
    return false;
  }

  const { data, error: closeError } = await supabase
    .from("sessions")
    .update({ state: "closed", closed_at: at })
    .eq("id", sessionId)
    .neq("state", "closed")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (closeError) {
    console.error("closeSessionIfClear: close failed", closeError);
    return false;
  }

  return Boolean(data);
}

/**
 * Clears a table without a bill request — the guest paid at the till,
 * flagged someone down, or simply left. Cancels anything outstanding so
 * no request is left hanging on a closed visit.
 */
export async function closeSessionManually(
  sessionId: string
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = await getServerClient();
  const now = new Date().toISOString();

  const { error: cancelError } = await supabase
    .from("requests")
    .update({ state: "cancelled", cancelled_at: now })
    .eq("session_id", sessionId)
    .in("state", ["open", "acknowledged"]);

  if (cancelError) {
    console.error("closeSessionManually: cancel failed", cancelError);
    return { ok: false, reason: "error" };
  }

  const { data, error } = await supabase
    .from("sessions")
    .update({ state: "closed", closed_at: now })
    .eq("id", sessionId)
    .neq("state", "closed")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("closeSessionManually: close failed", error);
    return { ok: false, reason: "error" };
  }

  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }

  return { ok: true, requestId: "", sessionClosed: true };
}

/**
 * Seats a walk-in party that hasn't tapped the tag.
 *
 * Same machinery as a guest tap: guest_open_session holds the
 * per-table lock, reuses an open session if one exists, and links the
 * table. It runs via the service client here for the same reason the
 * guest path does — session creation is not something RLS grants — but
 * only after the staff check and only for a table at the caller's own
 * venue.
 */
export async function seatTable(tableId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = await getServerClient();

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id")
    .eq("id", tableId)
    .eq("venue_id", staff.venueId)
    .eq("active", true)
    .maybeSingle<{ id: string }>();

  if (tableError) {
    console.error("seatTable: table lookup failed", tableError.message);
    return { ok: false, reason: "error" };
  }

  if (!table) {
    return { ok: false, reason: "not_found" };
  }

  const service = getServiceClient();

  const { data, error } = await service
    .rpc("guest_open_session", {
      p_venue_id: staff.venueId,
      p_table_id: tableId,
    })
    .maybeSingle<{ session_id: string; is_new: boolean }>();

  if (error || !data) {
    console.error("seatTable: open session failed", error?.message);
    return { ok: false, reason: "error" };
  }

  return { ok: true, requestId: "", sessionClosed: false };
}

/** Optional headcount, entered by the waiter after seating a party. */
export async function setGuestCount(
  sessionId: string,
  guestCount: number | null
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  if (
    guestCount !== null &&
    (!Number.isInteger(guestCount) || guestCount < 0 || guestCount > 500)
  ) {
    return { ok: false, reason: "invalid_state" };
  }

  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("sessions")
    .update({ guest_count: guestCount })
    .eq("id", sessionId)
    .neq("state", "closed")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("setGuestCount: failed", error);
    return { ok: false, reason: "error" };
  }

  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }

  return { ok: true, requestId: "", sessionClosed: false };
}
