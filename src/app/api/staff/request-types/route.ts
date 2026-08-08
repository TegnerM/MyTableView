import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/staff/request-types — the Guest buttons switches.
 *
 * Owner/manager only. One action: toggle a request type's `active`
 * flag, which shows/hides that button on the guest page instantly.
 * Nothing is ever deleted; the hidden order-kind type (the ordering
 * module's plumbing) can never be touched from here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { id?: unknown; active?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; active?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id || typeof body.active !== "boolean") {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  const me = resolved.current;
  if (me.role !== "owner" && me.role !== "manager") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const service = getServiceClient();

  const { data: row, error: rowError } = await service
    .from("request_types")
    .select("id, kind")
    .eq("id", id)
    .eq("venue_id", me.venueId)
    .maybeSingle<{ id: string; kind: string }>();

  if (rowError) {
    console.error("request-types: load failed", rowError.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
  if (!row || row.kind === "order") {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const { error: updateError } = await service
    .from("request_types")
    .update({ active: body.active })
    .eq("id", id)
    .eq("venue_id", me.venueId);

  if (updateError) {
    console.error("request-types: update failed", updateError.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
