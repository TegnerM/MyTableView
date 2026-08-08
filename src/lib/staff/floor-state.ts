import { getServerClient } from "@/lib/supabase/server";

/**
 * Floor state for the staff view.
 *
 * Everything here runs as the signed-in staff member, so RLS scopes it
 * to their venue automatically. No venue ID is ever taken from the
 * client.
 */

export type {
  LocaleMap,
  TableStatus,
  StaffIdentity,
  FloorRequest,
  FloorRequestOrder,
  FloorTable,
  FloorZone,
  FloorState,
  EscalationSettings,
} from "@/lib/staff/floor-types";

export {
  WAITING_THRESHOLD_SECONDS,
  OVERDUE_THRESHOLD_SECONDS,
  REPEAT_TAP_THRESHOLD,
  DEFAULT_ESCALATION_GRACE_SECONDS,
  DEFAULT_ESCALATION_SETTINGS,
  deriveTableStatus,
  isEscalated,
  isRequestEscalated,
  formatElapsed,
} from "@/lib/staff/floor-types";

import type {
  LocaleMap,
  StaffIdentity,
  FloorRequest,
  FloorTable,
  FloorZone,
  FloorState,
  EscalationSettings,
} from "@/lib/staff/floor-types";

import {
  DEFAULT_ESCALATION_SETTINGS,
  DEFAULT_TURN_SETTINGS,
  type TurnSettings,
} from "@/lib/staff/floor-types";
import { resolveStaff } from "@/lib/staff/venue-context";

/**
 * Resolves the signed-in user to a staff member.
 *
 * Returns null when nobody is signed in or the user is not staff at any
 * venue, which the page turns into a redirect.
 */
export async function getStaffIdentity(): Promise<StaffIdentity | null> {
  const resolved = await resolveStaff();

  if (!resolved) {
    return null;
  }

  const { current, memberships } = resolved;

  return {
    staffId: current.staffId,
    venueId: current.venueId,
    venueName: current.venueName,
    displayName: current.displayName,
    role: current.role,
    venues: memberships.map((m) => ({
      venueId: m.venueId,
      venueName: m.venueName,
    })),
  };
}

type TableRow = {
  id: string;
  label: string;
  area_id: string | null;
  seats: number;
  pos_x: number;
  pos_y: number;
  shape: string;
  width_m: number | null;
  depth_m: number | null;
  rotation: number;
  areas: {
    id: string;
    name: LocaleMap;
    sort_order: number;
    width_m: number;
    depth_m: number;
  } | null;
};

type AreaRow = {
  id: string;
  name: LocaleMap;
  sort_order: number;
  width_m: number;
  depth_m: number;
};

type SessionTableRow = {
  session_id: string;
  table_id: string;
  sessions: {
    id: string;
    state: string;
    opened_at: string;
    guest_count: number | null;
  } | null;
};

type RequestRow = {
  id: string;
  table_id: string;
  session_id: string;
  request_type_id: string;
  state: "open" | "acknowledged";
  created_at: string;
  acknowledged_at: string | null;
  tables: { label: string } | null;
  request_types: {
    code: string;
    label: LocaleMap;
    icon: string | null;
    closes_session: boolean;
  } | null;
  orders: {
    id: string;
    state: string;
    total_cents: number;
    note: string | null;
    order_items: { name: LocaleMap | null; quantity: number; position: number }[];
    order_tickets: { station: string; state: string }[];
  }[];
};

export async function loadFloorState(
  identity: StaffIdentity
): Promise<FloorState> {
  const supabase = await getServerClient();

  const [venueResult, areasResult, tablesResult, sessionsResult, requestsResult] =
    await Promise.all([
    supabase
      .from("venues")
      .select(
        "escalation_repeat_threshold, escalation_grace_seconds, turn_standard_minutes, turn_large_minutes, turn_large_party_size"
      )
      .eq("id", identity.venueId)
      .maybeSingle<{
        escalation_repeat_threshold: number;
        escalation_grace_seconds: number;
        turn_standard_minutes: number | null;
        turn_large_minutes: number | null;
        turn_large_party_size: number | null;
      }>(),

    // Zones are queried in their own right, not inferred from the
    // tables that sit in them. Inferring meant a zone whose last table
    // was deleted vanished from the editor while sitting happily in the
    // database.
    supabase
      .from("areas")
      .select("id, name, sort_order, width_m, depth_m")
      .eq("venue_id", identity.venueId)
      // Removed zones are deactivated, never deleted (migration 021).
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<AreaRow[]>(),

    supabase
      .from("tables")
      .select(
        "id, label, area_id, seats, pos_x, pos_y, shape, width_m, depth_m, rotation, areas:area_id ( id, name, sort_order, width_m, depth_m )"
      )
      .eq("venue_id", identity.venueId)
      .eq("active", true)
      .order("label", { ascending: true })
      .returns<TableRow[]>(),

    supabase
      .from("session_tables")
      .select(
        "session_id, table_id, sessions:session_id ( id, state, opened_at, guest_count )"
      )
      .returns<SessionTableRow[]>(),

    supabase
      .from("requests")
      .select(
        `
          id,
          table_id,
          session_id,
          request_type_id,
          state,
          created_at,
          acknowledged_at,
          tables:table_id ( label ),
          request_types:request_type_id ( code, label, icon, closes_session ),
          orders (
            id, state, total_cents, note,
            order_items ( name, quantity, position ),
            order_tickets ( station, state )
          )
        `
      )
      .eq("venue_id", identity.venueId)
      .in("state", ["open", "acknowledged"])
      .order("created_at", { ascending: true })
      .returns<RequestRow[]>(),
  ]);

  const escalation: EscalationSettings = {
    repeatThreshold:
      venueResult.data?.escalation_repeat_threshold ??
      DEFAULT_ESCALATION_SETTINGS.repeatThreshold,
    graceSeconds:
      venueResult.data?.escalation_grace_seconds ??
      DEFAULT_ESCALATION_SETTINGS.graceSeconds,
  };

  const turns: TurnSettings = {
    standardMinutes:
      venueResult.data?.turn_standard_minutes ??
      DEFAULT_TURN_SETTINGS.standardMinutes,
    largeMinutes:
      venueResult.data?.turn_large_minutes ??
      DEFAULT_TURN_SETTINGS.largeMinutes,
    largePartySize:
      venueResult.data?.turn_large_party_size ??
      DEFAULT_TURN_SETTINGS.largePartySize,
  };

  // Error props on PostgrestError are non-enumerable, so logging the
  // object prints "{}" in the Next dev overlay. Spell the fields out.
  const logQueryError = (
    label: string,
    error: {
      message?: string;
      code?: string;
      details?: string | null;
      hint?: string | null;
    }
  ) => {
    console.error(
      `loadFloorState: ${label} failed`,
      `message=${error.message ?? ""}`,
      `code=${error.code ?? ""}`,
      `details=${error.details ?? ""}`,
      `hint=${error.hint ?? ""}`
    );
  };

  if (areasResult.error) {
    logQueryError("areas", areasResult.error);
  }
  if (tablesResult.error) {
    logQueryError("tables", tablesResult.error);
  }
  if (sessionsResult.error) {
    logQueryError("sessions", sessionsResult.error);
  }
  if (requestsResult.error) {
    logQueryError("requests", requestsResult.error);
  }

  const tableRows = tablesResult.data ?? [];
  const sessionRows = (sessionsResult.data ?? []).filter(
    (row) => row.sessions && row.sessions.state !== "closed"
  );
  const requestRows = requestsResult.data ?? [];

  // How many times the guest has pressed each outstanding request. A
  // second press is what escalates a table to the manager, so this is
  // loaded with the floor rather than left to reporting.
  const tapCounts = new Map<string, { count: number; lastAt: string }>();

  if (requestRows.length > 0) {
    const { data: taps, error: tapsError } = await supabase
      .from("request_taps")
      .select("request_id, created_at")
      .in(
        "request_id",
        requestRows.map((row) => row.id)
      )
      .returns<{ request_id: string; created_at: string }[]>();

    if (tapsError) {
      // Managers only: RLS hides request_taps from waiters, so this
      // failing is expected on a waiter's device. Tap counts fall back
      // to 1 and the clock still drives escalation.
      console.debug("loadFloorState: taps unavailable", tapsError.message);
    }

    for (const tap of taps ?? []) {
      const existing = tapCounts.get(tap.request_id);
      if (existing) {
        existing.count += 1;
        if (tap.created_at > existing.lastAt) {
          existing.lastAt = tap.created_at;
        }
      } else {
        tapCounts.set(tap.request_id, {
          count: 1,
          lastAt: tap.created_at,
        });
      }
    }
  }

  // session_id -> table ids, so a combined party knows its siblings
  const sessionMembers = new Map<string, string[]>();
  for (const row of sessionRows) {
    const members = sessionMembers.get(row.session_id) ?? [];
    members.push(row.table_id);
    sessionMembers.set(row.session_id, members);
  }

  const sessionByTable = new Map<string, SessionTableRow>();
  for (const row of sessionRows) {
    sessionByTable.set(row.table_id, row);
  }

  const requestsByTable = new Map<string, FloorRequest[]>();
  for (const row of requestRows) {
    const taps = tapCounts.get(row.id);
    const list = requestsByTable.get(row.table_id) ?? [];
    list.push({
      id: row.id,
      tableId: row.table_id,
      tableLabel: row.tables?.label ?? "",
      sessionId: row.session_id,
      requestTypeId: row.request_type_id,
      requestCode: row.request_types?.code ?? "",
      requestLabel: row.request_types?.label ?? {},
      icon: row.request_types?.icon ?? null,
      closesSession: row.request_types?.closes_session ?? false,
      state: row.state,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      tapCount: taps?.count ?? 1,
      lastTapAt: taps?.lastAt ?? null,
      order: mapRequestOrder(row),
    });
    requestsByTable.set(row.table_id, list);
  }

  const tables: FloorTable[] = tableRows.map((row) => {
    const sessionRow = sessionByTable.get(row.id);
    const session = sessionRow?.sessions ?? null;
    const members = session ? (sessionMembers.get(session.id) ?? []) : [];

    return {
      id: row.id,
      label: row.label,
      areaId: row.area_id,
      areaName: row.areas?.name ?? null,
      seats: row.seats,
      posX: Number(row.pos_x),
      posY: Number(row.pos_y),
      shape: row.shape,
      widthM: Number(row.width_m ?? 0.9),
      depthM: Number(row.depth_m ?? 0.9),
      rotation: row.rotation ?? 0,
      sessionId: session?.id ?? null,
      sessionOpenedAt: session?.opened_at ?? null,
      sessionState: session?.state ?? null,
      guestCount: session?.guest_count ?? null,
      combinedWith: members.filter((id) => id !== row.id),
      requests: requestsByTable.get(row.id) ?? [],
    };
  });

  const areas: FloorZone[] = (areasResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    widthM: Number(row.width_m),
    depthM: Number(row.depth_m),
  }));

  return { identity, tables, areas, escalation, turns };
}

/** Shapes the embedded order (if any) hanging off a floor request. */
function mapRequestOrder(row: RequestRow): FloorRequest["order"] {
  const order = (row.orders ?? [])[0];
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    state: order.state,
    totalCents: order.total_cents,
    note: order.note,
    items: [...(order.order_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ name: item.name ?? {}, quantity: item.quantity })),
    stations: (order.order_tickets ?? []).map((ticket) => ({
      station: ticket.station === "bar" ? ("bar" as const) : ("kitchen" as const),
      state: ticket.state,
    })),
    anyReady: (order.order_tickets ?? []).some(
      (ticket) => ticket.state === "ready"
    ),
  };
}
