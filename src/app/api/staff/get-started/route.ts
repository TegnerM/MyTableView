import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/staff/get-started — the two actions behind the onboarding
 * card on Overview.
 *
 *   test_request — the "magic moment": seats the venue's first table
 *   (if it isn't already) and drops a real drinks request onto it, so
 *   a brand-new owner watches their own floor react exactly the way it
 *   will when a guest taps. Real session, real request, real realtime —
 *   nothing simulated, which is the point.
 *
 *   dismiss — stamps venues.get_started_dismissed_at so the card never
 *   comes back on this venue. The card also dismisses itself when all
 *   four steps are complete.
 *
 * Owners only, and the venue always comes from the resolved staff
 * identity — never from the client.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: unknown };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "test_request" && action !== "dismiss") {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }
  const me = resolved.current;
  if (me.role !== "owner") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const service = getServiceClient();

  if (action === "dismiss") {
    const { error } = await service
      .from("venues")
      .update({ get_started_dismissed_at: new Date().toISOString() })
      .eq("id", me.venueId);

    if (error) {
      console.error("get-started dismiss failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --------------------------------------------------- test_request

  try {
    // The venue's first table, same ordering the floor uses.
    const { data: tables, error: tableError } = await service
      .from("tables")
      .select("id, label")
      .eq("venue_id", me.venueId)
      .eq("active", true)
      .order("label", { ascending: true })
      .limit(1)
      .returns<{ id: string; label: string }[]>();

    if (tableError) {
      console.error("get-started: table lookup failed", tableError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    const table = (tables ?? [])[0];
    if (!table) {
      return NextResponse.json(
        { ok: false, reason: "no_tables" },
        { status: 400 }
      );
    }

    // A non-closing request type — drinks when it exists, otherwise the
    // first by sort order. A bill request would push the session into
    // its closing phase, which is not the demo a new owner should get.
    const { data: types, error: typeError } = await service
      .from("request_types")
      .select("id, code")
      .eq("venue_id", me.venueId)
      .eq("active", true)
      .eq("closes_session", false)
      .order("sort_order", { ascending: true })
      .limit(10)
      .returns<{ id: string; code: string }[]>();

    if (typeError) {
      console.error("get-started: type lookup failed", typeError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    const requestType =
      (types ?? []).find((t) => t.code === "drinks") ?? (types ?? [])[0];
    if (!requestType) {
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    // Reuse the table's open session if it has one — pressing the
    // button twice must not stack sessions on the same table.
    const { data: links, error: linkError } = await service
      .from("session_tables")
      .select("session_id, sessions:session_id ( id, state, venue_id )")
      .eq("table_id", table.id)
      .returns<
        {
          session_id: string;
          sessions: { id: string; state: string; venue_id: string } | null;
        }[]
      >();

    if (linkError) {
      console.error("get-started: session lookup failed", linkError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    let sessionId: string | null = null;
    for (const row of links ?? []) {
      const session = row.sessions;
      if (
        session &&
        session.venue_id === me.venueId &&
        session.state !== "closed"
      ) {
        sessionId = session.id;
        break;
      }
    }

    if (!sessionId) {
      const { data: created, error: sessionError } = await service
        .from("sessions")
        .insert({ venue_id: me.venueId, state: "open" })
        .select("id")
        .single<{ id: string }>();

      if (sessionError || !created) {
        console.error(
          "get-started: session create failed",
          sessionError?.message
        );
        return NextResponse.json(
          { ok: false, reason: "error" },
          { status: 500 }
        );
      }

      const { error: joinError } = await service
        .from("session_tables")
        .insert({ session_id: created.id, table_id: table.id });

      if (joinError) {
        console.error("get-started: session link failed", joinError.message);
        return NextResponse.json(
          { ok: false, reason: "error" },
          { status: 500 }
        );
      }

      sessionId = created.id;
    }

    // Same suppression as a real guest tap: if this request type is
    // already outstanding on the table, the floor already shows the
    // moment — don't stack a duplicate row.
    const { data: outstanding } = await service
      .from("requests")
      .select("id")
      .eq("session_id", sessionId)
      .eq("request_type_id", requestType.id)
      .in("state", ["open", "acknowledged"])
      .limit(1)
      .returns<{ id: string }[]>();

    if ((outstanding ?? []).length > 0) {
      return NextResponse.json({ ok: true, tableLabel: table.label });
    }

    const { error: insertError } = await service.from("requests").insert({
      venue_id: me.venueId,
      session_id: sessionId,
      table_id: table.id,
      request_type_id: requestType.id,
      state: "open",
    });

    if (insertError) {
      console.error("get-started: request insert failed", insertError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tableLabel: table.label });
  } catch (error) {
    console.error(
      "get-started: test request failed",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
