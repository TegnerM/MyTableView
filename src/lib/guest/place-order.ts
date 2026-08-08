import { getServiceClient } from "@/lib/supabase/service";
import { TAG_ID_PATTERN } from "@/lib/guest/resolve-tag";
import { isOrderingLive } from "@/lib/billing/status";
import type { Station } from "@/lib/menu/types";

/**
 * Creates a guest order.
 *
 * The client sends menu item IDs, option IDs and quantities — nothing
 * else is trusted. Venue, table and session derive from the tag; every
 * price is re-read from the menu and summed HERE, so a crafted request
 * can never set its own prices. The insert itself runs in one Postgres
 * transaction (guest_place_order): order + kitchen/bar tickets + lines
 * + the waiter's floor request land together or not at all.
 */

export type PlaceOrderFailure =
  | "invalid_input"
  | "unknown_tag"
  | "tag_not_assigned"
  | "venue_unavailable"
  | "ordering_off"
  | "no_open_session"
  | "unknown_item"
  | "item_unavailable"
  | "rate_limited"
  | "error";

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalCents: number }
  | { ok: false; reason: PlaceOrderFailure };

export type OrderLineInput = {
  itemId: string;
  quantity: number;
  optionIds: string[];
};

const MAX_LINES = 25;
const MAX_QTY = 9;
const MAX_NOTE = 280;

/** Orders per session per window — a table ordering a fifth round in
 *  15 minutes is a party, not an attack; beyond that it's a script. */
const ORDER_WINDOW_MS = 15 * 60_000;
const ORDER_WINDOW_LIMIT = 5;

type TagRow = {
  id: string;
  status: string;
  venue_id: string | null;
  table_id: string | null;
  venues: {
    id: string;
    status: string;
    ordering_active: boolean;
    service_charge_pct: number | string | null;
    trial_ends_at: string | null;
    accounts: { billing_status: string | null } | null;
  } | null;
};

type MenuItemRow = {
  id: string;
  category_id: string;
  name: Record<string, string> | null;
  price_cents: number;
  available: boolean;
  active: boolean;
  menu_categories: { station: string; active: boolean } | null;
};

type OptionRow = {
  id: string;
  item_id: string;
  name: Record<string, string> | null;
  surcharge_cents: number;
  active: boolean;
};

type SessionTableRow = {
  session_id: string;
  sessions: { id: string; state: string; venue_id: string } | null;
};

export async function placeGuestOrder(
  rawTagId: string,
  rawLines: unknown,
  rawNote: unknown
): Promise<PlaceOrderResult> {
  const tagId = typeof rawTagId === "string" ? rawTagId.trim().toLowerCase() : "";

  if (!TAG_ID_PATTERN.test(tagId)) {
    return { ok: false, reason: "invalid_input" };
  }

  const lines = parseLines(rawLines);
  if (!lines || lines.length === 0) {
    return { ok: false, reason: "invalid_input" };
  }

  const note =
    typeof rawNote === "string" && rawNote.trim().length > 0
      ? rawNote.trim().slice(0, MAX_NOTE)
      : null;

  const supabase = getServiceClient();

  // ---- resolve the tag → venue/table, check the ordering gate --------
  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select(
      `
        id, status, venue_id, table_id,
        venues:venue_id (
          id, status, ordering_active, service_charge_pct, trial_ends_at,
          accounts:account_id ( billing_status )
        )
      `
    )
    .eq("id", tagId)
    .maybeSingle<TagRow>();

  if (tagError) {
    console.error("placeGuestOrder: tag lookup failed", tagError);
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

  if (
    !isOrderingLive(
      tag.venues.ordering_active,
      tag.venues.trial_ends_at,
      tag.venues.accounts?.billing_status
    )
  ) {
    return { ok: false, reason: "ordering_off" };
  }

  const venueId = tag.venue_id;
  const tableId = tag.table_id;

  const sessionId = await findOpenSessionId(venueId, tableId);
  if (!sessionId) {
    return { ok: false, reason: "no_open_session" };
  }

  // ---- rate limit ----------------------------------------------------
  const { count: recentOrders, error: recentError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gte("created_at", new Date(Date.now() - ORDER_WINDOW_MS).toISOString());

  if (recentError) {
    console.error("placeGuestOrder: rate query failed", recentError);
    // Fail open — a broken metric must never block a real guest.
  } else if ((recentOrders ?? 0) >= ORDER_WINDOW_LIMIT) {
    return { ok: false, reason: "rate_limited" };
  }

  // ---- re-read the menu and price everything server-side -------------
  const itemIds = [...new Set(lines.map((line) => line.itemId))];

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, price_cents, available, active, menu_categories:category_id ( station, active )"
    )
    .eq("venue_id", venueId)
    .in("id", itemIds)
    .returns<MenuItemRow[]>();

  if (itemsError) {
    console.error("placeGuestOrder: items lookup failed", itemsError);
    return { ok: false, reason: "error" };
  }

  const itemById = new Map((items ?? []).map((item) => [item.id, item]));

  for (const line of lines) {
    const item = itemById.get(line.itemId);
    if (!item || !item.active || !item.menu_categories?.active) {
      return { ok: false, reason: "unknown_item" };
    }
    if (!item.available) {
      return { ok: false, reason: "item_unavailable" };
    }
  }

  const optionIds = [...new Set(lines.flatMap((line) => line.optionIds))];

  let optionById = new Map<string, OptionRow>();
  if (optionIds.length > 0) {
    const { data: options, error: optionsError } = await supabase
      .from("menu_item_options")
      .select("id, item_id, name, surcharge_cents, active")
      .eq("venue_id", venueId)
      .in("id", optionIds)
      .returns<OptionRow[]>();

    if (optionsError) {
      console.error("placeGuestOrder: options lookup failed", optionsError);
      return { ok: false, reason: "error" };
    }
    optionById = new Map((options ?? []).map((option) => [option.id, option]));
  }

  // ---- build the station tickets -------------------------------------
  type TicketItem = {
    menu_item_id: string;
    name: Record<string, string>;
    unit_price_cents: number;
    options: { name: Record<string, string>; surcharge_cents: number }[];
    quantity: number;
    line_total_cents: number;
  };

  const byStation = new Map<Station, TicketItem[]>();
  let subtotal = 0;

  for (const line of lines) {
    const item = itemById.get(line.itemId)!;

    const chosen: { name: Record<string, string>; surcharge_cents: number }[] = [];
    for (const optionId of line.optionIds) {
      const option = optionById.get(optionId);
      // An option must exist, be active, and belong to THIS item.
      if (!option || !option.active || option.item_id !== item.id) {
        return { ok: false, reason: "invalid_input" };
      }
      chosen.push({
        name: option.name ?? {},
        surcharge_cents: option.surcharge_cents,
      });
    }

    const unit =
      item.price_cents +
      chosen.reduce((sum, option) => sum + option.surcharge_cents, 0);
    const lineTotal = unit * line.quantity;
    subtotal += lineTotal;

    const station: Station =
      item.menu_categories?.station === "bar" ? "bar" : "kitchen";

    const list = byStation.get(station) ?? [];
    list.push({
      menu_item_id: item.id,
      name: item.name ?? {},
      unit_price_cents: unit,
      options: chosen,
      quantity: line.quantity,
      line_total_cents: lineTotal,
    });
    byStation.set(station, list);
  }

  const servicePct = Number(tag.venues.service_charge_pct ?? 0) || 0;

  const tickets = [...byStation.entries()].map(([station, ticketItems]) => ({
    station,
    items: ticketItems,
  }));

  // ---- one transaction -----------------------------------------------
  const { data: created, error: insertError } = await supabase
    .rpc("guest_place_order", {
      p_venue_id: venueId,
      p_session_id: sessionId,
      p_table_id: tableId,
      p_tag_id: tagId,
      p_note: note,
      p_service_pct: servicePct,
      p_tickets: tickets,
    })
    .maybeSingle<{ order_id: string; request_id: string }>();

  if (insertError || !created) {
    console.error("placeGuestOrder: insert failed", insertError);
    return { ok: false, reason: "error" };
  }

  const serviceCents = Math.round((subtotal * servicePct) / 100);

  return {
    ok: true,
    orderId: created.order_id,
    totalCents: subtotal + serviceCents,
  };
}

function parseLines(raw: unknown): OrderLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) {
    return null;
  }

  const lines: OrderLineInput[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const item = entry as Record<string, unknown>;

    const itemId = typeof item.itemId === "string" ? item.itemId : "";
    const quantity = typeof item.quantity === "number" ? item.quantity : NaN;
    const optionIds = Array.isArray(item.optionIds) ? item.optionIds : [];

    if (!isUuid(itemId)) {
      return null;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return null;
    }
    if (optionIds.length > 20 || !optionIds.every((id) => isUuid(id))) {
      return null;
    }

    lines.push({
      itemId,
      quantity,
      optionIds: [...new Set(optionIds as string[])],
    });
  }

  return lines;
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
    console.error("placeGuestOrder: session lookup failed", error);
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
