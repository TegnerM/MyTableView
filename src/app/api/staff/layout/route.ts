import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/staff/layout
 *
 * Table positions and zone dimensions. Managers and owners only.
 *
 * Everything is validated and clamped server-side. The client already
 * clamps while dragging, but a table that ends up outside the room
 * would be invisible on the floor view, so it is not left to the
 * browser to get right.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  tableId?: unknown;
  zoneId?: unknown;
  posX?: unknown;
  posY?: unknown;
  widthM?: unknown;
  depthM?: unknown;
  seats?: unknown;
  shape?: unknown;
  rotation?: unknown;
  name?: unknown;
  items?: unknown;
};

/**
 * Mirrors table_default_footprint in the database. The grid layout for
 * bulk adds needs footprints before the insert happens; the RPC still
 * assigns the authoritative stored size.
 */
function footprint(seats: number, shape: string) {
  const widthM = Math.round((0.6 + 0.15 * seats) * 100) / 100;
  const depthM =
    shape === "square"
      ? Math.round((0.5 + 0.1 * seats) * 100) / 100
      : widthM;
  return { widthM, depthM };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return bad();
  }

  const supabase = await getServerClient();

  const resolved = await resolveStaff();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  // The venue this DEVICE is working as — same resolution as every
  // staff page, so a multi-venue account can never edit venue B while
  // looking at venue A.
  const staff = {
    venue_id: resolved.current.venueId,
    role: resolved.current.role,
  };

  if (staff.role !== "owner" && staff.role !== "manager") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  if (body.action === "move_table") {
    if (typeof body.tableId !== "string" || !UUID.test(body.tableId)) {
      return bad();
    }

    const posX = Number(body.posX);
    const posY = Number(body.posY);

    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      return bad();
    }

    // The table's own zone decides the bounds. Reading it here rather
    // than trusting the client means a resized room cannot leave a
    // table stranded outside it.
    const { data: table } = await supabase
      .from("tables")
      .select(
        "id, width_m, depth_m, rotation, venue_id, areas:area_id ( width_m, depth_m )"
      )
      .eq("id", body.tableId)
      .eq("venue_id", staff.venue_id)
      .maybeSingle<{
        id: string;
        width_m: number | null;
        depth_m: number | null;
        rotation: number | null;
        venue_id: string;
        areas: { width_m: number; depth_m: number } | null;
      }>();

    if (!table) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        { status: 404 }
      );
    }

    const zoneW = table.areas?.width_m ?? 10;
    const zoneD = table.areas?.depth_m ?? 8;

    // Rotation enlarges the axis-aligned box a table occupies, so the
    // clamp has to use the rotated extent or a turned table clips a
    // wall.
    const rad = ((table.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const w = table.width_m ?? 0.9;
    const d = table.depth_m ?? 0.9;
    const halfW = (w * cos + d * sin) / 2;
    const halfD = (w * sin + d * cos) / 2;

    const clampedX = clamp(round2(posX), halfW, Math.max(halfW, zoneW - halfW));
    const clampedY = clamp(round2(posY), halfD, Math.max(halfD, zoneD - halfD));

    const { error } = await supabase
      .from("tables")
      .update({ pos_x: clampedX, pos_y: clampedY })
      .eq("id", body.tableId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: move failed", error);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, posX: clampedX, posY: clampedY },
      { status: 200 }
    );
  }

  if (body.action === "zone_size") {
    if (typeof body.zoneId !== "string" || !UUID.test(body.zoneId)) {
      return bad();
    }

    const widthM = Number(body.widthM);
    const depthM = Number(body.depthM);

    if (
      !Number.isFinite(widthM) ||
      !Number.isFinite(depthM) ||
      widthM < 1 ||
      widthM > 200 ||
      depthM < 1 ||
      depthM > 200
    ) {
      return bad();
    }

    const { error } = await supabase
      .from("areas")
      .update({ width_m: round2(widthM), depth_m: round2(depthM) })
      .eq("id", body.zoneId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: zone size failed", error);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    // Shrinking a room can leave tables outside it. Pull them back in
    // rather than letting them disappear off the plan.
    const { error: clampError } = await supabase.rpc("clamp_tables_to_zone", {
      p_zone_id: body.zoneId,
    });

    if (clampError) {
      console.error("layout: clamp failed", clampError);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "add_table") {
    if (typeof body.zoneId !== "string" || !UUID.test(body.zoneId)) {
      return bad();
    }

    const seats = Number(body.seats);
    const shape = body.shape === "square" ? "square" : "round";
    const posX = Number(body.posX);
    const posY = Number(body.posY);

    if (
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > 40 ||
      !Number.isFinite(posX) ||
      !Number.isFinite(posY)
    ) {
      return bad();
    }

    // The label is assigned inside the function from the next free
    // number, holding a lock on the venue — two managers adding tables
    // at the same moment cannot both claim "13".
    //
    // OUT parameters carry an o_ prefix (migration 016) so they cannot
    // shadow column names inside the function. The full stored geometry
    // comes back so the editor can draw the table without waiting for a
    // page refresh.
    const { data, error } = await supabase
      .rpc("staff_add_table", {
        p_venue_id: staff.venue_id,
        p_zone_id: body.zoneId,
        p_seats: seats,
        p_shape: shape,
        p_pos_x: round2(posX),
        p_pos_y: round2(posY),
      })
      .maybeSingle<{
        o_table_id: string;
        o_label: string;
        o_width_m: number;
        o_depth_m: number;
        o_pos_x: number;
        o_pos_y: number;
      }>();

    if (error || !data) {
      console.error("layout: add table failed", error);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        tableId: data.o_table_id,
        label: data.o_label,
        widthM: Number(data.o_width_m),
        depthM: Number(data.o_depth_m),
        posX: Number(data.o_pos_x),
        posY: Number(data.o_pos_y),
      },
      { status: 201 }
    );
  }

  if (body.action === "rotate_table") {
    if (typeof body.tableId !== "string" || !UUID.test(body.tableId)) {
      return bad();
    }

    const rotation = Number(body.rotation);

    if (!Number.isFinite(rotation)) {
      return bad();
    }

    // Free angles, normalised to 0–359.
    const normalised = ((Math.round(rotation) % 360) + 360) % 360;

    const { error } = await supabase
      .from("tables")
      .update({ rotation: normalised })
      .eq("id", body.tableId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: rotate failed", error);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    // A rotated rectangle needs a larger axis-aligned box than its own
    // footprint, so turning a table near a wall can push it through it.
    // Re-clamp against the new extent rather than leaving it outside.
    const { error: clampError } = await supabase.rpc("clamp_table_to_zone", {
      p_table_id: body.tableId,
    });

    if (clampError) {
      console.error("layout: clamp after rotate failed", clampError);
    }

    return NextResponse.json({ ok: true, rotation: normalised }, { status: 200 });
  }

  if (body.action === "remove_table") {
    if (typeof body.tableId !== "string" || !UUID.test(body.tableId)) {
      return bad();
    }

    // Deactivate rather than delete. A table that has been in service
    // has visits and requests attached, and that history stays valuable
    // long after the furniture is gone.
    const { error } = await supabase
      .from("tables")
      .update({ active: false })
      .eq("id", body.tableId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: remove table failed", error);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "add_zone") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const widthM = Number(body.widthM);
    const depthM = Number(body.depthM);

    if (
      name.length < 1 ||
      name.length > 40 ||
      !Number.isFinite(widthM) ||
      !Number.isFinite(depthM) ||
      widthM < 1 ||
      widthM > 200 ||
      depthM < 1 ||
      depthM > 200
    ) {
      return bad();
    }

    // Insert goes through the service client: the venue and role are
    // already verified above, and RLS was written before zones became
    // user-creatable.
    const service = getServiceClient();

    const { data: maxRow } = await service
      .from("areas")
      .select("sort_order")
      .eq("venue_id", staff.venue_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>();

    const { data, error } = await service
      .from("areas")
      .insert({
        venue_id: staff.venue_id,
        name: { en: name },
        sort_order: (maxRow?.sort_order ?? -1) + 1,
        width_m: round2(widthM),
        depth_m: round2(depthM),
      })
      .select("id, sort_order, width_m, depth_m")
      .single<{
        id: string;
        sort_order: number;
        width_m: number;
        depth_m: number;
      }>();

    if (error || !data) {
      console.error("layout: add zone failed", error?.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        zoneId: data.id,
        sortOrder: data.sort_order,
        widthM: Number(data.width_m),
        depthM: Number(data.depth_m),
      },
      { status: 201 }
    );
  }

  if (body.action === "rename_zone") {
    if (typeof body.zoneId !== "string" || !UUID.test(body.zoneId)) {
      return bad();
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (name.length < 1 || name.length > 40) {
      return bad();
    }

    // The whole name map is replaced with the typed value. Zone names
    // are the owner's own words ("Roof terrace"), not translated UI.
    const service = getServiceClient();

    const { error } = await service
      .from("areas")
      .update({ name: { en: name } })
      .eq("id", body.zoneId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: rename zone failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "remove_zone") {
    if (typeof body.zoneId !== "string" || !UUID.test(body.zoneId)) {
      return bad();
    }

    // A zone that still has tables cannot be removed — the tables would
    // silently vanish from the floor with their history attached.
    const { count } = await supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("area_id", body.zoneId)
      .eq("venue_id", staff.venue_id)
      .eq("active", true);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, reason: "zone_not_empty" },
        { status: 409 }
      );
    }

    // Deactivate, never delete — same rule as tables.
    const service = getServiceClient();

    const { error } = await service
      .from("areas")
      .update({ active: false })
      .eq("id", body.zoneId)
      .eq("venue_id", staff.venue_id);

    if (error) {
      console.error("layout: remove zone failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.action === "add_tables_bulk") {
    if (typeof body.zoneId !== "string" || !UUID.test(body.zoneId)) {
      return bad();
    }

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 12) {
      return bad();
    }

    const items: { seats: number; shape: string; count: number }[] = [];

    for (const raw of body.items) {
      const seats = Number((raw as Record<string, unknown>)?.seats);
      const shapeRaw = (raw as Record<string, unknown>)?.shape;
      const shape = shapeRaw === "square" ? "square" : "round";
      const count = Number((raw as Record<string, unknown>)?.count);

      if (
        !Number.isInteger(seats) ||
        seats < 1 ||
        seats > 40 ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > 60
      ) {
        return bad();
      }

      if (count > 0) {
        items.push({ seats, shape, count });
      }
    }

    const total = items.reduce((sum, item) => sum + item.count, 0);

    if (total < 1 || total > 120) {
      return bad();
    }

    const { data: zone } = await supabase
      .from("areas")
      .select("id, width_m, depth_m")
      .eq("id", body.zoneId)
      .eq("venue_id", staff.venue_id)
      .maybeSingle<{ id: string; width_m: number; depth_m: number }>();

    if (!zone) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        { status: 404 }
      );
    }

    const zoneW = Number(zone.width_m);
    const zoneD = Number(zone.depth_m);

    // Lay the batch out as a grid of drop points, row by row, largest
    // templates first so each row has a consistent height. These are
    // starting positions to drag from, not a seating plan — but a tidy
    // grid beats a heap in the corner. staff_add_table clamps each
    // point, so a batch bigger than the room still lands inside it.
    const GAP = 0.5;
    const MARGIN = 0.4;

    const queue: { seats: number; shape: string }[] = [];
    for (const item of [...items].sort(
      (a, b) => footprint(b.seats, b.shape).depthM - footprint(a.seats, a.shape).depthM
    )) {
      for (let i = 0; i < item.count; i += 1) {
        queue.push({ seats: item.seats, shape: item.shape });
      }
    }

    let cursorX = MARGIN;
    let cursorY = MARGIN;
    let rowDepth = 0;

    const created: {
      tableId: string;
      label: string;
      seats: number;
      shape: string;
      widthM: number;
      depthM: number;
      posX: number;
      posY: number;
    }[] = [];

    for (const entry of queue) {
      const fp = footprint(entry.seats, entry.shape);

      if (cursorX + fp.widthM > zoneW - MARGIN && cursorX > MARGIN) {
        // Wrap to the next row.
        cursorX = MARGIN;
        cursorY += rowDepth + GAP;
        rowDepth = 0;
      }

      const posX = round2(cursorX + fp.widthM / 2);
      const posY = round2(cursorY + fp.depthM / 2);

      cursorX += fp.widthM + GAP;
      rowDepth = Math.max(rowDepth, fp.depthM);

      // Sequential on purpose: staff_add_table takes the venue's
      // numbering lock, so parallel calls would just queue on it anyway.
      const { data, error } = await supabase
        .rpc("staff_add_table", {
          p_venue_id: staff.venue_id,
          p_zone_id: body.zoneId,
          p_seats: entry.seats,
          p_shape: entry.shape,
          p_pos_x: posX,
          p_pos_y: posY,
        })
        .maybeSingle<{
          o_table_id: string;
          o_label: string;
          o_width_m: number;
          o_depth_m: number;
          o_pos_x: number;
          o_pos_y: number;
        }>();

      if (error || !data) {
        console.error("layout: bulk add failed", error?.message);
        // Whatever was created before the failure stays — the client
        // refreshes and shows exactly what landed.
        return NextResponse.json(
          { ok: false, reason: "error", created },
          { status: 500 }
        );
      }

      created.push({
        tableId: data.o_table_id,
        label: data.o_label,
        seats: entry.seats,
        shape: entry.shape,
        widthM: Number(data.o_width_m),
        depthM: Number(data.o_depth_m),
        posX: Number(data.o_pos_x),
        posY: Number(data.o_pos_y),
      });
    }

    return NextResponse.json({ ok: true, created }, { status: 201 });
  }

  return bad();
}

function bad() {
  return NextResponse.json(
    { ok: false, reason: "invalid_input" },
    { status: 400 }
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
