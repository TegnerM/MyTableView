import { getServiceClient } from "@/lib/supabase/service";
import { TAG_ID_PATTERN } from "@/lib/guest/resolve-tag";
import type { LocaleMap } from "@/lib/menu/types";

/**
 * The guest's own orders for their table session — powers the live
 * status chip, the Order Status screen, and "Another round".
 *
 * Read-only, resolved from the tag exactly like every guest call: the
 * client can only ever see the session its physical tag belongs to.
 * Polled (guests have no authenticated realtime socket).
 */

export type GuestTicketStatus = {
  station: string;
  state: string;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
};

export type GuestOrderStatus = {
  orderId: string;
  state: string;
  createdAt: string;
  totalCents: number;
  items: { name: LocaleMap; quantity: number }[];
  tickets: GuestTicketStatus[];
  /** The furthest-along display phase across tickets. */
  phase: "received" | "preparing" | "on_the_way" | "delivered";
};

export type GuestOpenRequest = {
  id: string;
  label: LocaleMap;
  state: "open" | "acknowledged";
  createdAt: string;
};

export type SessionOrdersResult =
  | {
      ok: true;
      /** Most recent order that isn't finished (null when none). */
      activeOrder: GuestOrderStatus | null;
      /** Lines of the most recent order — the "repeat" payload. */
      lastOrderLines: { menuItemId: string; quantity: number }[];
      /** Session's most-ordered items, for quick-add. */
      favorites: { menuItemId: string; name: LocaleMap; quantity: number }[];
      /** The guest's own open (non-order) requests — the hotel chip. */
      openRequests: GuestOpenRequest[];
    }
  | { ok: false; reason: "invalid_input" | "unknown_tag" | "no_session" | "error" };

type OrderRow = {
  id: string;
  state: string;
  created_at: string;
  total_cents: number;
  order_items: {
    menu_item_id: string | null;
    name: LocaleMap | null;
    quantity: number;
    position: number;
  }[];
  order_tickets: {
    station: string;
    state: string;
    created_at: string;
    started_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
  }[];
};

function phaseOf(tickets: GuestTicketStatus[], orderState: string): GuestOrderStatus["phase"] {
  if (orderState === "delivered") {
    return "delivered";
  }
  const states = tickets.map((ticket) => ticket.state);
  if (states.some((state) => state === "ready")) {
    return "on_the_way";
  }
  if (states.some((state) => state === "preparing")) {
    return "preparing";
  }
  return "received";
}

export async function loadSessionOrders(
  rawTagId: string
): Promise<SessionOrdersResult> {
  const tagId = typeof rawTagId === "string" ? rawTagId.trim().toLowerCase() : "";
  if (!TAG_ID_PATTERN.test(tagId)) {
    return { ok: false, reason: "invalid_input" };
  }

  const supabase = getServiceClient();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("id, venue_id, table_id, status")
    .eq("id", tagId)
    .maybeSingle<{
      id: string;
      venue_id: string | null;
      table_id: string | null;
      status: string;
    }>();

  if (tagError) {
    console.error("loadSessionOrders: tag failed", tagError.message);
    return { ok: false, reason: "error" };
  }
  // Lost/retired tags stop reading the table the moment staff mark
  // them — same rule as resolveTag and place-order.
  if (
    !tag?.venue_id ||
    !tag.table_id ||
    tag.status === "lost" ||
    tag.status === "retired"
  ) {
    return { ok: false, reason: "unknown_tag" };
  }

  // The open session covering this table.
  const { data: links, error: linkError } = await supabase
    .from("session_tables")
    .select("session_id, sessions:session_id ( id, state, venue_id )")
    .eq("table_id", tag.table_id)
    .returns<
      { session_id: string; sessions: { id: string; state: string; venue_id: string } | null }[]
    >();

  if (linkError) {
    console.error("loadSessionOrders: session failed", linkError.message);
    return { ok: false, reason: "error" };
  }

  const sessionId = (links ?? []).find(
    (row) =>
      row.sessions &&
      row.sessions.venue_id === tag.venue_id &&
      row.sessions.state !== "closed"
  )?.session_id;

  if (!sessionId) {
    return {
      ok: true,
      activeOrder: null,
      lastOrderLines: [],
      favorites: [],
      openRequests: [],
    };
  }

  const [ordersResult, requestsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
          id, state, created_at, total_cents,
          order_items ( menu_item_id, name, quantity, position ),
          order_tickets ( station, state, created_at, started_at, ready_at, delivered_at )
        `
      )
      .eq("session_id", sessionId)
      .neq("state", "cancelled")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<OrderRow[]>(),
    supabase
      .from("requests")
      .select("id, state, created_at, request_types:request_type_id ( kind, label )")
      .eq("session_id", sessionId)
      .in("state", ["open", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<
        {
          id: string;
          state: string;
          created_at: string;
          request_types: { kind: string; label: LocaleMap | null } | null;
        }[]
      >(),
  ]);

  const { data: orders, error: ordersError } = ordersResult;

  if (ordersError) {
    console.error("loadSessionOrders: orders failed", ordersError.message);
    return { ok: false, reason: "error" };
  }

  if (requestsResult.error) {
    console.error(
      "loadSessionOrders: requests failed",
      requestsResult.error.message
    );
  }

  // Orders travel as their own timeline; the open-requests list is the
  // "we've seen it" signal for towels, maintenance and the like.
  const openRequests: GuestOpenRequest[] = (requestsResult.data ?? [])
    .filter((row) => row.request_types && row.request_types.kind !== "order")
    .map((row) => ({
      id: row.id,
      label: row.request_types?.label ?? {},
      state: row.state === "acknowledged" ? "acknowledged" : "open",
      createdAt: row.created_at,
    }));

  const shaped: GuestOrderStatus[] = (orders ?? []).map((order) => {
    const tickets: GuestTicketStatus[] = (order.order_tickets ?? []).map((t) => ({
      station: t.station,
      state: t.state,
      createdAt: t.created_at,
      startedAt: t.started_at,
      readyAt: t.ready_at,
      deliveredAt: t.delivered_at,
    }));
    return {
      orderId: order.id,
      state: order.state,
      createdAt: order.created_at,
      totalCents: order.total_cents,
      items: [...(order.order_items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({ name: item.name ?? {}, quantity: item.quantity })),
      tickets,
      phase: phaseOf(tickets, order.state),
    };
  });

  const activeOrder =
    shaped.find((order) => order.state === "open") ?? null;

  const last = shaped[0];
  const lastOrderLines = last
    ? (orders ?? [])[0].order_items
        .filter((item) => item.menu_item_id)
        .map((item) => ({
          menuItemId: item.menu_item_id as string,
          quantity: item.quantity,
        }))
    : [];

  // Favourites: most-ordered items across the session.
  const tally = new Map<string, { name: LocaleMap; quantity: number }>();
  for (const order of orders ?? []) {
    for (const item of order.order_items ?? []) {
      if (!item.menu_item_id) continue;
      const entry = tally.get(item.menu_item_id) ?? {
        name: item.name ?? {},
        quantity: 0,
      };
      entry.quantity += item.quantity;
      tally.set(item.menu_item_id, entry);
    }
  }
  const favorites = [...tally.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 3)
    .map(([menuItemId, entry]) => ({
      menuItemId,
      name: entry.name,
      quantity: entry.quantity,
    }));

  return { ok: true, activeOrder, lastOrderLines, favorites, openRequests };
}
