import { getServiceClient } from "@/lib/supabase/service";
import { TAG_ID_PATTERN } from "@/lib/guest/resolve-tag";

/**
 * Creates a guest request.
 *
 * Everything is re-validated here. The client sends a tag ID and a
 * request type ID; nothing else is trusted. The venue, table and session
 * are all derived server-side from the tag, so a crafted request cannot
 * post to another venue's table.
 */

export type CreateFailure =
  | "invalid_input"
  | "unknown_tag"
  | "tag_not_assigned"
  | "venue_unavailable"
  | "unknown_request_type"
  | "no_open_session"
  | "duplicate"
  | "rate_limited"
  | "error";

export type CreateResult =
  | {
      ok: true;
      requestId: string;
      requestTypeId: string;
      closesSession: boolean;
    }
  | { ok: false; reason: CreateFailure };

/**
 * A guest may not fire the same request type again while one is still
 * outstanding, and may not post more than this many requests in the
 * window. Both limits are per session, not per device — a table with
 * four phones is still one table.
 */
const BURST_WINDOW_SECONDS = 60;
const BURST_LIMIT = 8;

type RecentRequestRow = {
  id: string;
  request_type_id: string;
  state: string;
  created_at: string;
};

type SessionTableRow = {
  session_id: string;
  sessions: { id: string; state: string; venue_id: string } | null;
};

export async function createGuestRequest(
  rawTagId: string,
  rawRequestTypeId: string,
  note?: string
): Promise<CreateResult> {
  const tagId = rawTagId?.trim().toLowerCase() ?? "";
  const requestTypeId = rawRequestTypeId?.trim() ?? "";

  if (!TAG_ID_PATTERN.test(tagId)) {
    return { ok: false, reason: "invalid_input" };
  }

  if (!isUuid(requestTypeId)) {
    return { ok: false, reason: "invalid_input" };
  }

  const trimmedNote =
    typeof note === "string" && note.trim().length > 0
      ? note.trim().slice(0, 280)
      : null;

  const supabase = getServiceClient();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select(
      `
        id,
        status,
        venue_id,
        table_id,
        venues:venue_id ( id, status )
      `
    )
    .eq("id", tagId)
    .maybeSingle<{
      id: string;
      status: string;
      venue_id: string | null;
      table_id: string | null;
      venues: { id: string; status: string } | null;
    }>();

  if (tagError) {
    console.error("createGuestRequest: tag lookup failed", tagError);
    return { ok: false, reason: "error" };
  }

  if (!tag || tag.status === "lost" || tag.status === "retired") {
    return { ok: false, reason: "unknown_tag" };
  }

  if (!tag.venue_id || !tag.table_id || !tag.venues) {
    return { ok: false, reason: "tag_not_assigned" };
  }

  if (tag.venues.status !== "active") {
    return { ok: false, reason: "venue_unavailable" };
  }

  const venueId = tag.venue_id;
  const tableId = tag.table_id;

  // The request type must belong to this venue. Without this check a
  // guest could post another venue's request type ID.
  const { data: requestType, error: typeError } = await supabase
    .from("request_types")
    .select("id, closes_session, active, venue_id")
    .eq("id", requestTypeId)
    .eq("venue_id", venueId)
    .maybeSingle<{
      id: string;
      closes_session: boolean;
      active: boolean;
      venue_id: string;
    }>();

  if (typeError) {
    console.error("createGuestRequest: request type lookup failed", typeError);
    return { ok: false, reason: "error" };
  }

  if (!requestType || !requestType.active) {
    return { ok: false, reason: "unknown_request_type" };
  }

  const sessionId = await findOpenSessionId(venueId, tableId);

  if (!sessionId) {
    return { ok: false, reason: "no_open_session" };
  }

  const { data: recent, error: recentError } = await supabase
    .from("requests")
    .select("id, request_type_id, state, created_at")
    .eq("session_id", sessionId)
    .gte(
      "created_at",
      new Date(Date.now() - BURST_WINDOW_SECONDS * 1000).toISOString()
    )
    .returns<RecentRequestRow[]>();

  if (recentError) {
    console.error("createGuestRequest: recent lookup failed", recentError);
    return { ok: false, reason: "error" };
  }

  if ((recent ?? []).length >= BURST_LIMIT) {
    return { ok: false, reason: "rate_limited" };
  }

  // Same request type already outstanding: the waiter's screen keeps
  // one row rather than stacking duplicates. The tap itself is still
  // recorded — a guest pressing four times because nobody came is the
  // clearest service-failure signal in the system, and throwing it away
  // would make an ignored table look identical to a served one.
  const { data: outstanding, error: outstandingError } = await supabase
    .from("requests")
    .select("id, created_at")
    .eq("session_id", sessionId)
    .eq("request_type_id", requestTypeId)
    .in("state", ["open", "acknowledged"])
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<{ id: string; created_at: string }[]>();

  if (outstandingError) {
    console.error(
      "createGuestRequest: outstanding lookup failed",
      outstandingError
    );
    return { ok: false, reason: "error" };
  }

  const existing = (outstanding ?? [])[0];

  if (existing) {
    await logTap({
      venueId,
      sessionId,
      tableId,
      requestTypeId,
      requestId: existing.id,
      tagId,
      firstCreatedAt: existing.created_at,
    });

    return { ok: false, reason: "duplicate" };
  }

  const { data: created, error: insertError } = await supabase
    .from("requests")
    .insert({
      venue_id: venueId,
      session_id: sessionId,
      table_id: tableId,
      tag_id: tagId,
      request_type_id: requestTypeId,
      state: "open",
      note: trimmedNote,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("createGuestRequest: insert failed", insertError);
    return { ok: false, reason: "error" };
  }

  // A bill request moves the visit into its closing phase. The session
  // is not closed until staff fulfil the request — that is what captures
  // the real departure time rather than the moment they asked.
  if (requestType.closes_session) {
    const { error: sessionError } = await supabase
      .from("sessions")
      .update({
        state: "closing",
        bill_requested_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("state", "open");

    if (sessionError) {
      console.error(
        "createGuestRequest: session state update failed",
        sessionError
      );
    }
  }

  await logTap({
    venueId,
    sessionId,
    tableId,
    requestTypeId,
    requestId: created.id,
    tagId,
    firstCreatedAt: null,
  });

  return {
    ok: true,
    requestId: created.id,
    requestTypeId,
    closesSession: requestType.closes_session,
  };
}

/**
 * Records a guest tap.
 *
 * Every press is logged, whether or not it created a new request. Tap
 * number and elapsed time make repeat-pressing measurable: a manager
 * can see that table 12 asked for drinks four times over six minutes
 * before anyone came, which response time alone would not reveal.
 *
 * Failures here are swallowed. Losing a metric must never stop a guest
 * getting served.
 */
async function logTap(params: {
  venueId: string;
  sessionId: string;
  tableId: string;
  requestTypeId: string;
  requestId: string;
  tagId: string;
  firstCreatedAt: string | null;
}): Promise<void> {
  const supabase = getServiceClient();

  try {
    let tapNumber = 1;
    let secondsSinceFirst = 0;

    if (params.firstCreatedAt) {
      const { count } = await supabase
        .from("request_taps")
        .select("id", { count: "exact", head: true })
        .eq("request_id", params.requestId);

      tapNumber = (count ?? 0) + 1;
      secondsSinceFirst = Math.max(
        0,
        Math.round(
          (Date.now() - new Date(params.firstCreatedAt).getTime()) / 1000
        )
      );
    }

    await supabase.from("request_taps").insert({
      venue_id: params.venueId,
      session_id: params.sessionId,
      table_id: params.tableId,
      request_type_id: params.requestTypeId,
      request_id: params.requestId,
      tag_id: params.tagId,
      tap_number: tapNumber,
      seconds_since_first: secondsSinceFirst,
    });
  } catch (error) {
    console.error("logTap: failed", error);
  }
}

async function findOpenSessionId(
  venueId: string,
  tableId: string
): Promise<string | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("session_tables")
    .select("session_id, sessions:session_id ( id, state, venue_id )")
    .eq("table_id", tableId)
    .returns<SessionTableRow[]>();

  if (error) {
    console.error("findOpenSessionId: lookup failed", error);
    return null;
  }

  for (const row of data ?? []) {
    const session = row.sessions;

    if (session && session.venue_id === venueId && session.state !== "closed") {
      return session.id;
    }
  }

  return null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
