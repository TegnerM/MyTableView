import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { isAllergenCode } from "@/lib/menu/allergens";
import { isStationSlug } from "@/lib/menu/types";
import { isVenueStation } from "@/lib/stations";
import { autoTranslateMenuRow } from "@/lib/menu/translate";

/**
 * POST /api/staff/menu — every menu-editor mutation.
 *
 * Owner/manager only; the venue always comes from the resolved staff
 * context, never the client. Rows are deactivated, never deleted —
 * existing order lines keep their snapshots and history stays whole.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 120;
const MAX_DESC = 400;
const MAX_PRICE_CENTS = 1_000_000;

type Ctx = { venueId: string };

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad();
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  const me = resolved.current;
  if (me.role !== "owner" && me.role !== "manager") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const ctx: Ctx = { venueId: me.venueId };
  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "category_save":
      return categorySave(ctx, body);
    case "category_delete":
      return categoryDelete(ctx, body);
    case "category_move":
      return move(ctx, body, "menu_categories");
    case "item_save":
      return itemSave(ctx, body);
    case "item_delete":
      return deactivate(ctx, body, "menu_items");
    case "item_move":
      return move(ctx, body, "menu_items");
    case "item_availability":
      return itemAvailability(ctx, body);
    case "item_bar_share":
      return itemBarShare(ctx, body);
    case "option_save":
      return optionSave(ctx, body);
    case "option_delete":
      return deactivate(ctx, body, "menu_item_options");
    case "auto_translate":
      return setAutoTranslate(ctx, body);
    default:
      return bad();
  }
}

/* ------------------------------------------------------------ actions */

async function categorySave(ctx: Ctx, body: Record<string, unknown>) {
  const name = cleanLocaleMap(body.name, MAX_TEXT);
  if (!name || !isStationSlug(body.station)) {
    return bad();
  }
  if (!(await isVenueStation(ctx.venueId, body.station))) {
    return bad();
  }

  const service = getServiceClient();

  if (typeof body.id === "string") {
    const { data, error } = await service
      .from("menu_categories")
      .update({ name, station: body.station })
      .eq("id", body.id)
      .eq("venue_id", ctx.venueId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (data?.id) {
      await autoTranslateMenuRow("menu_categories", data.id, ctx.venueId, {
        name: primaryText(name),
      });
    }
    return finish(data?.id, error?.message);
  }

  const sortOrder = await nextSortOrder(ctx, "menu_categories", null);
  const { data, error } = await service
    .from("menu_categories")
    .insert({
      venue_id: ctx.venueId,
      name,
      station: body.station,
      sort_order: sortOrder,
    })
    .select("id")
    .single<{ id: string }>();
  if (data?.id) {
    await autoTranslateMenuRow("menu_categories", data.id, ctx.venueId, {
      name: primaryText(name),
    });
  }
  return finish(data?.id, error?.message);
}

async function categoryDelete(ctx: Ctx, body: Record<string, unknown>) {
  if (typeof body.id !== "string") {
    return bad();
  }
  const service = getServiceClient();

  // The category and its dishes leave the menu together — a hidden
  // category with visible dishes would be a menu no one can explain.
  const { error: itemsError } = await service
    .from("menu_items")
    .update({ active: false })
    .eq("category_id", body.id)
    .eq("venue_id", ctx.venueId);

  if (itemsError) {
    return finish(undefined, itemsError.message);
  }

  const { data, error } = await service
    .from("menu_categories")
    .update({ active: false })
    .eq("id", body.id)
    .eq("venue_id", ctx.venueId)
    .select("id")
    .maybeSingle<{ id: string }>();
  return finish(data?.id, error?.message);
}

async function itemSave(ctx: Ctx, body: Record<string, unknown>) {
  const name = cleanLocaleMap(body.name, MAX_TEXT);
  const description = cleanLocaleMap(body.description, MAX_DESC) ?? {};
  const priceCents = body.priceCents;
  const photo = cleanPhoto(body.photo);
  const allergens = cleanAllergens(body.allergens);
  // "Also on the bar menu" — optional; absent when the editor hides
  // the tick (no linked bar, or a bar venue's own editor).
  const alsoOnBar =
    typeof body.alsoOnBar === "boolean" ? body.alsoOnBar : undefined;

  if (
    !name ||
    typeof priceCents !== "number" ||
    !Number.isInteger(priceCents) ||
    priceCents < 0 ||
    priceCents > MAX_PRICE_CENTS ||
    photo === undefined ||
    allergens === null
  ) {
    return bad();
  }

  const service = getServiceClient();

  if (typeof body.id === "string") {
    // A dish hidden only because it had no price comes back the moment
    // it gets one. A deliberate 86 (priced dish, availability off) is
    // the owner's call and stays off.
    const { data: existing } = await service
      .from("menu_items")
      .select("price_cents, available")
      .eq("id", body.id)
      .eq("venue_id", ctx.venueId)
      .maybeSingle<{ price_cents: number; available: boolean }>();

    const revive =
      existing !== null &&
      existing.available === false &&
      existing.price_cents <= 0 &&
      priceCents > 0;

    const update = {
      name,
      description,
      price_cents: priceCents,
      photo,
      allergens,
      ...(revive ? { available: true } : {}),
      ...(alsoOnBar === undefined ? {} : { also_on_bar: alsoOnBar }),
    };
    let { data, error } = await service
      .from("menu_items")
      .update(update)
      .eq("id", body.id)
      .eq("venue_id", ctx.venueId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error && /also_on_bar/.test(error.message)) {
      // Pre-migration database — save everything else.
      delete (update as Record<string, unknown>).also_on_bar;
      ({ data, error } = await service
        .from("menu_items")
        .update(update)
        .eq("id", body.id)
        .eq("venue_id", ctx.venueId)
        .select("id")
        .maybeSingle<{ id: string }>());
    }
    if (data?.id) {
      await autoTranslateMenuRow("menu_items", data.id, ctx.venueId, {
        name: primaryText(name),
        description: primaryText(description),
      });
    }
    return finish(data?.id, error?.message);
  }

  if (typeof body.categoryId !== "string") {
    return bad();
  }

  // The category must be the venue's own.
  const { data: category } = await service
    .from("menu_categories")
    .select("id")
    .eq("id", body.categoryId)
    .eq("venue_id", ctx.venueId)
    .maybeSingle<{ id: string }>();

  if (!category) {
    return bad();
  }

  const sortOrder = await nextSortOrder(ctx, "menu_items", body.categoryId);
  const insert = {
    venue_id: ctx.venueId,
    category_id: body.categoryId,
    name,
    description,
    price_cents: priceCents,
    photo,
    allergens,
    sort_order: sortOrder,
    ...(alsoOnBar === undefined ? {} : { also_on_bar: alsoOnBar }),
  };
  let { data, error } = await service
    .from("menu_items")
    .insert(insert)
    .select("id")
    .single<{ id: string }>();
  if (error && /also_on_bar/.test(error.message)) {
    delete (insert as Record<string, unknown>).also_on_bar;
    ({ data, error } = await service
      .from("menu_items")
      .insert(insert)
      .select("id")
      .single<{ id: string }>());
  }
  if (data?.id) {
    await autoTranslateMenuRow("menu_items", data.id, ctx.venueId, {
      name: primaryText(name),
      description: primaryText(description),
    });
  }
  return finish(data?.id, error?.message);
}

async function itemAvailability(ctx: Ctx, body: Record<string, unknown>) {
  if (typeof body.id !== "string" || typeof body.available !== "boolean") {
    return bad();
  }
  const service = getServiceClient();
  const { data, error } = await service
    .from("menu_items")
    .update({ available: body.available })
    .eq("id", body.id)
    .eq("venue_id", ctx.venueId)
    .select("id")
    .maybeSingle<{ id: string }>();
  return finish(data?.id, error?.message);
}

/** The per-dish "Bar menu" tick — instant, like availability. Fails
 *  loudly (the row reverts) until the 2026-08-11 migration has run. */
async function itemBarShare(ctx: Ctx, body: Record<string, unknown>) {
  if (typeof body.id !== "string" || typeof body.alsoOnBar !== "boolean") {
    return bad();
  }
  const service = getServiceClient();
  const { data, error } = await service
    .from("menu_items")
    .update({ also_on_bar: body.alsoOnBar })
    .eq("id", body.id)
    .eq("venue_id", ctx.venueId)
    .select("id")
    .maybeSingle<{ id: string }>();
  return finish(data?.id, error?.message);
}

async function optionSave(ctx: Ctx, body: Record<string, unknown>) {
  const name = cleanLocaleMap(body.name, MAX_TEXT);
  const surcharge = body.surchargeCents;

  if (
    !name ||
    typeof surcharge !== "number" ||
    !Number.isInteger(surcharge) ||
    surcharge < 0 ||
    surcharge > 100_000
  ) {
    return bad();
  }

  const service = getServiceClient();

  if (typeof body.id === "string") {
    const { data, error } = await service
      .from("menu_item_options")
      .update({ name, surcharge_cents: surcharge })
      .eq("id", body.id)
      .eq("venue_id", ctx.venueId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (data?.id) {
      await autoTranslateMenuRow("menu_item_options", data.id, ctx.venueId, {
        name: primaryText(name),
      });
    }
    return finish(data?.id, error?.message);
  }

  if (typeof body.itemId !== "string") {
    return bad();
  }

  const { data: item } = await service
    .from("menu_items")
    .select("id")
    .eq("id", body.itemId)
    .eq("venue_id", ctx.venueId)
    .maybeSingle<{ id: string }>();

  if (!item) {
    return bad();
  }

  const { count } = await service
    .from("menu_item_options")
    .select("id", { count: "exact", head: true })
    .eq("item_id", body.itemId)
    .eq("active", true);

  if ((count ?? 0) >= 20) {
    return bad();
  }

  const { data, error } = await service
    .from("menu_item_options")
    .insert({
      venue_id: ctx.venueId,
      item_id: body.itemId,
      name,
      surcharge_cents: surcharge,
      sort_order: (count ?? 0) + 1,
    })
    .select("id")
    .single<{ id: string }>();
  if (data?.id) {
    await autoTranslateMenuRow("menu_item_options", data.id, ctx.venueId, {
      name: primaryText(name),
    });
  }
  return finish(data?.id, error?.message);
}

async function setAutoTranslate(ctx: Ctx, body: Record<string, unknown>) {
  if (typeof body.enabled !== "boolean") {
    return bad();
  }
  const service = getServiceClient();
  const { error } = await service
    .from("venues")
    .update({ menu_auto_translate: body.enabled })
    .eq("id", ctx.venueId);
  if (error) {
    console.error("staff/menu: auto_translate failed", error.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

/* ------------------------------------------------------------ shared */

async function deactivate(
  ctx: Ctx,
  body: Record<string, unknown>,
  table: "menu_items" | "menu_item_options"
) {
  if (typeof body.id !== "string") {
    return bad();
  }
  const service = getServiceClient();
  const { data, error } = await service
    .from(table)
    .update({ active: false })
    .eq("id", body.id)
    .eq("venue_id", ctx.venueId)
    .select("id")
    .maybeSingle<{ id: string }>();
  return finish(data?.id, error?.message);
}

/** Swaps sort_order with the neighbour in the given direction. */
async function move(
  ctx: Ctx,
  body: Record<string, unknown>,
  table: "menu_categories" | "menu_items"
) {
  const direction = body.direction;
  if (typeof body.id !== "string" || (direction !== -1 && direction !== 1)) {
    return bad();
  }

  const service = getServiceClient();

  const { data: row } = await service
    .from(table)
    .select("id, sort_order" + (table === "menu_items" ? ", category_id" : ""))
    .eq("id", body.id)
    .eq("venue_id", ctx.venueId)
    .maybeSingle<{ id: string; sort_order: number; category_id?: string }>();

  if (!row) {
    return bad();
  }

  let neighbourQuery = service
    .from(table)
    .select("id, sort_order")
    .eq("venue_id", ctx.venueId)
    .eq("active", true);

  if (table === "menu_items" && row.category_id) {
    neighbourQuery = neighbourQuery.eq("category_id", row.category_id);
  }

  const { data: neighbour } = await (direction === -1
    ? neighbourQuery
        .lt("sort_order", row.sort_order)
        .order("sort_order", { ascending: false })
    : neighbourQuery
        .gt("sort_order", row.sort_order)
        .order("sort_order", { ascending: true })
  )
    .limit(1)
    .maybeSingle<{ id: string; sort_order: number }>();

  if (!neighbour) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { error: first } = await service
    .from(table)
    .update({ sort_order: neighbour.sort_order })
    .eq("id", row.id);
  const { error: second } = await service
    .from(table)
    .update({ sort_order: row.sort_order })
    .eq("id", neighbour.id);

  return finish(row.id, first?.message ?? second?.message);
}

async function nextSortOrder(
  ctx: Ctx,
  table: "menu_categories" | "menu_items",
  categoryId: string | null
): Promise<number> {
  const service = getServiceClient();
  let query = service
    .from(table)
    .select("sort_order")
    .eq("venue_id", ctx.venueId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  const { data } = await query.maybeSingle<{ sort_order: number }>();
  return (data?.sort_order ?? 0) + 1;
}

/** The one text value the editor writes (its single-language field). */
function primaryText(
  map: Record<string, string> | null | undefined
): string | undefined {
  if (!map) {
    return undefined;
  }
  const values = Object.values(map).filter((value) => value.trim() !== "");
  return values[0];
}

function cleanLocaleMap(
  raw: unknown,
  maxLength: number
): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const result: Record<string, string> = {};
  let any = false;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z]{2}(-[a-z0-9]{2,8})?$/i.test(key)) {
      continue;
    }
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim().slice(0, maxLength);
    if (trimmed.length > 0) {
      result[key.toLowerCase()] = trimmed;
      any = true;
    }
  }

  return any ? result : null;
}

/** null clears the photo; 'stock:key' or an https URL passes. */
function cleanPhoto(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string" || raw.length > 500) {
    return undefined;
  }
  if (/^stock:[a-z0-9-]+$/.test(raw)) {
    return raw;
  }
  if (raw.startsWith("https://")) {
    return raw;
  }
  return undefined;
}

function cleanAllergens(raw: unknown): string[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.length > 20) {
    return null;
  }
  const result: string[] = [];
  for (const code of raw) {
    if (!isAllergenCode(code)) {
      return null;
    }
    if (!result.includes(code)) {
      result.push(code);
    }
  }
  return result;
}

function bad() {
  return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
}

function finish(id: string | undefined, errorMessage: string | undefined) {
  if (errorMessage || !id) {
    if (errorMessage) {
      console.error("staff/menu:", errorMessage);
    }
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
