import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { TAG_ID_PATTERN } from "@/lib/tags/generate-ids";

/**
 * POST /api/staff/tags — assign / unassign physical tags.
 *
 * assign:   an owner/manager taps an UNASSIGNED tag and picks a table.
 *           Security: a tag already belonging to ANOTHER venue can
 *           never be claimed — physical possession of a chip must not
 *           allow hijacking someone else's table page.
 * unassign: returns one of this venue's tags to stock (lost chip,
 *           table removed, re-sticking).
 *
 * Service client is used because the tags table is not exposed to
 * staff through RLS; the role checks above each operation are the gate.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  tagId?: unknown;
  tableId?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const resolved = await resolveStaff();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  if (resolved.current.role !== "owner" && resolved.current.role !== "manager") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const venueId = resolved.current.venueId;

  const tagId =
    typeof body.tagId === "string" && TAG_ID_PATTERN.test(body.tagId.trim().toLowerCase())
      ? body.tagId.trim().toLowerCase()
      : null;

  if (!tagId) {
    return NextResponse.json(
      { ok: false, reason: "invalid_tag" },
      { status: 400 }
    );
  }

  const service = getServiceClient();

  const { data: tag, error: tagError } = await service
    .from("tags")
    .select("id, venue_id, table_id, status")
    .eq("id", tagId)
    .maybeSingle<{
      id: string;
      venue_id: string | null;
      table_id: string | null;
      status: string;
    }>();

  if (tagError || !tag) {
    return NextResponse.json(
      { ok: false, reason: "unknown_tag" },
      { status: 404 }
    );
  }

  if (tag.status === "lost" || tag.status === "retired") {
    return NextResponse.json(
      { ok: false, reason: "tag_retired" },
      { status: 400 }
    );
  }

  // The one security rule that matters here: another venue's tag is
  // untouchable, full stop.
  if (tag.venue_id && tag.venue_id !== venueId) {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  if (body.action === "assign") {
    const tableId =
      typeof body.tableId === "string" && UUID.test(body.tableId)
        ? body.tableId
        : null;

    if (!tableId) {
      return NextResponse.json(
        { ok: false, reason: "invalid_table" },
        { status: 400 }
      );
    }

    const { data: table } = await service
      .from("tables")
      .select("id, label")
      .eq("id", tableId)
      .eq("venue_id", venueId)
      .eq("active", true)
      .maybeSingle<{ id: string; label: string }>();

    if (!table) {
      return NextResponse.json(
        { ok: false, reason: "invalid_table" },
        { status: 400 }
      );
    }

    const { error } = await service
      .from("tags")
      .update({
        venue_id: venueId,
        table_id: tableId,
        status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", tagId);

    if (error) {
      console.error("tags: assign failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, tableLabel: table.label },
      { status: 200 }
    );
  }

  if (body.action === "unassign") {
    if (tag.venue_id !== venueId) {
      // Stock tags (no venue) can't be "unassigned" by anyone.
      return NextResponse.json(
        { ok: false, reason: "forbidden" },
        { status: 403 }
      );
    }

    const { error } = await service
      .from("tags")
      .update({
        venue_id: null,
        table_id: null,
        status: "stock",
        assigned_at: null,
        allocated_at: null,
      })
      .eq("id", tagId);

    if (error) {
      console.error("tags: unassign failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, reason: "invalid_input" },
    { status: 400 }
  );
}
