import { getServiceClient } from "@/lib/supabase/service";
import { resolveStaff } from "@/lib/staff/venue-context";
import type {
  BoardTicket,
  OrderItemLine,
  Station,
  TicketState,
} from "@/lib/menu/types";

/**
 * Orders board data + ticket transitions.
 *
 * Kitchen taps Start and Ready; the waiter (floor or board) taps
 * Delivered. Every transition is timestamped — these timestamps ARE
 * the service clock the owner reads in Insights.
 *
 * Ticket state and the waiter's floor request stay in lockstep:
 * the LAST delivered ticket of an order fulfils the floor request, a
 * fully-cancelled order cancels it. The reverse direction (waiter taps
 * Done on the floor) lives in request-actions.ts.
 *
 * Service client after the staff check, venue-scoped on every write.
 */

export type OrderActionFailure = "not_staff" | "not_found" | "invalid_state" | "error";

export type OrderActionResult =
  | { ok: true }
  | { ok: false; reason: OrderActionFailure };

type StaffContext = { staffId: string; venueId: string };

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

/* -------------------------------------------------------- board data */

type TicketRow = {
  id: string;
  order_id: string;
  station: string;
  state: string;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  orders: {
    id: string;
    note: string | null;
    table_id: string;
    tables: {
      label: string;
      areas: { name: Record<string, string> } | null;
    } | null;
  } | null;
  order_items: {
    id: string;
    name: Record<string, string> | null;
    unit_price_cents: number;
    options: { name?: Record<string, string>; surcharge_cents?: number }[] | null;
    quantity: number;
    line_total_cents: number;
    position: number;
  }[];
};

const DELIVERED_WINDOW_MS = 60 * 60_000;

export async function loadBoardTickets(venueId: string): Promise<BoardTicket[]> {
  const supabase = getServiceClient();

  const openStates = ["new", "preparing", "ready"];

  const select = `
    id, order_id, station, state, created_at, started_at, ready_at, delivered_at,
    orders:order_id (
      id, note, table_id,
      tables:table_id ( label, areas:area_id ( name ) )
    ),
    order_items ( id, name, unit_price_cents, options, quantity, line_total_cents, position )
  `;

  const [openResult, deliveredResult] = await Promise.all([
    supabase
      .from("order_tickets")
      .select(select)
      .eq("venue_id", venueId)
      .in("state", openStates)
      .order("created_at", { ascending: true })
      .returns<TicketRow[]>(),
    supabase
      .from("order_tickets")
      .select(select)
      .eq("venue_id", venueId)
      .eq("state", "delivered")
      .gte(
        "delivered_at",
        new Date(Date.now() - DELIVERED_WINDOW_MS).toISOString()
      )
      .order("delivered_at", { ascending: false })
      .limit(30)
      .returns<TicketRow[]>(),
  ]);

  if (openResult.error) {
    console.error("loadBoardTickets: open failed", openResult.error.message);
  }
  if (deliveredResult.error) {
    console.error("loadBoardTickets: delivered failed", deliveredResult.error.message);
  }

  const rows = [...(openResult.data ?? []), ...(deliveredResult.data ?? [])];

  return rows.map((row) => {
    const items: OrderItemLine[] = [...row.order_items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        name: item.name ?? {},
        unitPriceCents: item.unit_price_cents,
        options: (item.options ?? []).map((option) => ({
          name: option.name ?? {},
          surchargeCents: option.surcharge_cents ?? 0,
        })),
        quantity: item.quantity,
        lineTotalCents: item.line_total_cents,
      }));

    return {
      id: row.id,
      orderId: row.order_id,
      station: (row.station === "bar" ? "bar" : "kitchen") as Station,
      state: row.state as TicketState,
      tableLabel: row.orders?.tables?.label ?? "",
      areaName: row.orders?.tables?.areas?.name ?? null,
      note: row.orders?.note ?? null,
      createdAt: row.created_at,
      startedAt: row.started_at,
      readyAt: row.ready_at,
      deliveredAt: row.delivered_at,
      items,
    };
  });
}

/* ------------------------------------------------------ transitions */

export async function startTicket(ticketId: string): Promise<OrderActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("order_tickets")
    .update({
      state: "preparing",
      started_at: new Date().toISOString(),
      started_by: staff.staffId,
    })
    .eq("id", ticketId)
    .eq("venue_id", staff.venueId)
    .eq("state", "new")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("startTicket: failed", error.message);
    return { ok: false, reason: "error" };
  }
  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }
  return { ok: true };
}

export async function readyTicket(ticketId: string): Promise<OrderActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const now = new Date().toISOString();
  const supabase = getServiceClient();

  // A station may skip Start under pressure — Ready from "new" counts
  // the whole span as preparation and backfills started_at. Read first,
  // then ONE update: a second UPDATE would make every floor device's
  // pass bell ring twice (realtime sends one event per update, and
  // old.state isn't available to dedupe on).
  const { data: current, error: loadError } = await supabase
    .from("order_tickets")
    .select("id, started_at")
    .eq("id", ticketId)
    .eq("venue_id", staff.venueId)
    .in("state", ["new", "preparing"])
    .maybeSingle<{ id: string; started_at: string | null }>();

  if (loadError) {
    console.error("readyTicket: load failed", loadError.message);
    return { ok: false, reason: "error" };
  }
  if (!current) {
    return { ok: false, reason: "invalid_state" };
  }

  const { data, error } = await supabase
    .from("order_tickets")
    .update({
      state: "ready",
      ready_at: now,
      ready_by: staff.staffId,
      ...(current.started_at ? {} : { started_at: now }),
    })
    .eq("id", ticketId)
    .eq("venue_id", staff.venueId)
    .in("state", ["new", "preparing"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("readyTicket: failed", error.message);
    return { ok: false, reason: "error" };
  }
  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }

  return { ok: true };
}

export async function deliverTicket(ticketId: string): Promise<OrderActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const now = new Date().toISOString();
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("order_tickets")
    .update({
      state: "delivered",
      delivered_at: now,
      delivered_by: staff.staffId,
    })
    .eq("id", ticketId)
    .eq("venue_id", staff.venueId)
    .in("state", ["new", "preparing", "ready"])
    .select("id, order_id")
    .maybeSingle<{ id: string; order_id: string }>();

  if (error) {
    console.error("deliverTicket: failed", error.message);
    return { ok: false, reason: "error" };
  }
  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }

  await settleOrderIfDone(data.order_id, staff, now);
  return { ok: true };
}

export async function cancelTicket(ticketId: string): Promise<OrderActionResult> {
  const staff = await requireStaff();
  if (!staff) {
    return { ok: false, reason: "not_staff" };
  }

  const now = new Date().toISOString();
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("order_tickets")
    .update({ state: "cancelled" })
    .eq("id", ticketId)
    .eq("venue_id", staff.venueId)
    .in("state", ["new", "preparing", "ready"])
    .select("id, order_id")
    .maybeSingle<{ id: string; order_id: string }>();

  if (error) {
    console.error("cancelTicket: failed", error.message);
    return { ok: false, reason: "error" };
  }
  if (!data) {
    return { ok: false, reason: "invalid_state" };
  }

  await settleOrderIfDone(data.order_id, staff, now);
  return { ok: true };
}

/**
 * Once every ticket of an order has finished, settle the order and its
 * floor request. All-cancelled → cancelled; otherwise (all finished,
 * at least one delivered) → delivered + request fulfilled, so the
 * waiter's queue clears without a second tap.
 */
async function settleOrderIfDone(
  orderId: string,
  staff: StaffContext,
  at: string
): Promise<void> {
  const supabase = getServiceClient();

  const { data: tickets, error } = await supabase
    .from("order_tickets")
    .select("state")
    .eq("order_id", orderId)
    .returns<{ state: string }[]>();

  if (error || !tickets || tickets.length === 0) {
    if (error) {
      console.error("settleOrderIfDone: tickets load failed", error.message);
    }
    return;
  }

  const open = tickets.some(
    (ticket) => ticket.state !== "delivered" && ticket.state !== "cancelled"
  );
  if (open) {
    return;
  }

  const allCancelled = tickets.every((ticket) => ticket.state === "cancelled");
  const orderState = allCancelled ? "cancelled" : "delivered";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .update({ state: orderState, closed_at: at })
    .eq("id", orderId)
    .eq("venue_id", staff.venueId)
    .eq("state", "open")
    .select("request_id")
    .maybeSingle<{ request_id: string | null }>();

  if (orderError) {
    console.error("settleOrderIfDone: order update failed", orderError.message);
    return;
  }

  if (!order?.request_id) {
    return;
  }

  if (allCancelled) {
    const { error: cancelError } = await supabase
      .from("requests")
      .update({ state: "cancelled", cancelled_at: at })
      .eq("id", order.request_id)
      .in("state", ["open", "acknowledged"]);
    if (cancelError) {
      console.error("settleOrderIfDone: request cancel failed", cancelError.message);
    }
    return;
  }

  const { error: fulfilError } = await supabase
    .from("requests")
    .update({
      state: "fulfilled",
      fulfilled_at: at,
      fulfilled_by: staff.staffId,
    })
    .eq("id", order.request_id)
    .in("state", ["open", "acknowledged"]);

  if (fulfilError) {
    console.error("settleOrderIfDone: request fulfil failed", fulfilError.message);
    return;
  }

  await supabase
    .from("requests")
    .update({ acknowledged_at: at, acknowledged_by: staff.staffId })
    .eq("id", order.request_id)
    .is("acknowledged_at", null);
}

/**
 * The reverse direction: the waiter cleared floor request(s) (Done /
 * Done-all / table cleared). Any tickets still open on the linked
 * orders follow along — delivered when served, cancelled when the
 * visit was closed without serving.
 */
export async function settleTicketsForRequests(
  requestIds: string[],
  venueId: string,
  staffId: string,
  mode: "delivered" | "cancelled"
): Promise<void> {
  if (requestIds.length === 0) {
    return;
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("venue_id", venueId)
    .in("request_id", requestIds)
    .eq("state", "open")
    .returns<{ id: string }[]>();

  if (error) {
    console.error("settleTicketsForRequests: orders load failed", error.message);
    return;
  }
  if (!orders || orders.length === 0) {
    return;
  }

  const orderIds = orders.map((order) => order.id);

  const update =
    mode === "delivered"
      ? {
          state: "delivered",
          delivered_at: now,
          delivered_by: staffId,
        }
      : { state: "cancelled" };

  const { error: ticketsError } = await supabase
    .from("order_tickets")
    .update(update)
    .in("order_id", orderIds)
    .in("state", ["new", "preparing", "ready"]);

  if (ticketsError) {
    console.error("settleTicketsForRequests: tickets failed", ticketsError.message);
    return;
  }

  const { error: ordersError } = await supabase
    .from("orders")
    .update({
      state: mode === "delivered" ? "delivered" : "cancelled",
      closed_at: now,
    })
    .in("id", orderIds)
    .eq("state", "open");

  if (ordersError) {
    console.error("settleTicketsForRequests: orders failed", ordersError.message);
  }
}
