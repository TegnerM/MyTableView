/**
 * Floor view types.
 *
 * Deliberately free of any import that touches the server. The client
 * component needs these shapes, and if they lived alongside the loader
 * the bundler would follow the import chain and try to pull the
 * server-only Supabase client into the browser.
 */

export type LocaleMap = Record<string, string>;

/**
 * Table status is derived from the oldest outstanding request, not
 * stored. Storing it would need a background job to age rows, and a
 * stale status is worse than no status when a waiter is deciding where
 * to walk next.
 */
export type TableStatus = "clear" | "good" | "waiting" | "overdue";

export const WAITING_THRESHOLD_SECONDS = 5 * 60;
export const OVERDUE_THRESHOLD_SECONDS = 10 * 60;

/**
 * Presses of the same button before a table counts as escalated.
 *
 * Two, not three. A second press means the guest has concluded nobody
 * is coming.
 */
export const REPEAT_TAP_THRESHOLD = 2;

/**
 * How long the original request must have been outstanding before a
 * repeat press escalates anything.
 *
 * Without this, any second tap turns a table red — which would flag a
 * waiter who is thirty seconds away carrying three plates. Five minutes
 * is nothing during service, and staff cannot be expected to drop
 * everything for an impatient guest.
 *
 * The tap is still recorded either way; this only governs whether the
 * floor reacts. Venues override it: a fine-dining room and a busy beach
 * bar have different tolerances.
 */
export const DEFAULT_ESCALATION_GRACE_SECONDS = 5 * 60;

export type EscalationSettings = {
  /** Presses of the same button before escalating. */
  repeatThreshold: number;
  /** Seconds the request must have been open before a repeat counts. */
  graceSeconds: number;
};

export const DEFAULT_ESCALATION_SETTINGS: EscalationSettings = {
  repeatThreshold: REPEAT_TAP_THRESHOLD,
  graceSeconds: DEFAULT_ESCALATION_GRACE_SECONDS,
};

/**
 * How long a table is allocated to one party. A service policy, set by
 * the venue: most rooms turn tables in 1.5–2 hours, and a large party
 * is expected to stay 3–4. The threshold decides which allowance a
 * session gets, based on its recorded guest count.
 */
export type TurnSettings = {
  /** Minutes allocated to an ordinary party. */
  standardMinutes: number;
  /** Minutes allocated once a party counts as large. */
  largeMinutes: number;
  /** Guest count at which a party counts as large. */
  largePartySize: number;
};

export const DEFAULT_TURN_SETTINGS: TurnSettings = {
  standardMinutes: 105,
  largeMinutes: 210,
  largePartySize: 6,
};

/** The allowance a given session gets, in minutes. */
export function turnAllowanceMinutes(
  guestCount: number | null,
  turns: TurnSettings
): number {
  return guestCount !== null && guestCount >= turns.largePartySize
    ? turns.largeMinutes
    : turns.standardMinutes;
}

/** 105 -> "1h 45m", 90 -> "1h 30m", 45 -> "45m". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export type StaffIdentity = {
  staffId: string;
  venueId: string;
  venueName: string;
  displayName: string;
  role: "owner" | "manager" | "waiter";
  /** Every venue this account belongs to; drives the venue switcher. */
  venues?: { venueId: string; venueName: string }[];
};

export type FloorRequest = {
  id: string;
  tableId: string;
  tableLabel: string;
  sessionId: string;
  requestTypeId: string;
  requestCode: string;
  requestLabel: LocaleMap;
  icon: string | null;
  closesSession: boolean;
  state: "open" | "acknowledged";
  createdAt: string;
  acknowledgedAt: string | null;
  /**
   * How many times the guest has pressed this button. 1 is the original
   * ask; 2 or more means they decided nobody was coming.
   */
  tapCount: number;
  /** Most recent press, which is not the same as when they first asked. */
  lastTapAt: string | null;
};

export type FloorTable = {
  id: string;
  label: string;
  areaId: string | null;
  areaName: LocaleMap | null;
  seats: number;
  /** Metres from the zone's left edge to the table CENTRE. */
  posX: number;
  /** Metres from the zone's top edge to the table CENTRE. */
  posY: number;
  shape: string;
  /** Footprint in metres. Defaults derive from seat count. */
  widthM: number;
  depthM: number;
  /** Degrees clockwise; rotation pivots on the centre. */
  rotation: number;
  sessionId: string | null;
  sessionOpenedAt: string | null;
  sessionState: string | null;
  guestCount: number | null;
  /** Tables sharing this session, when a party has been combined. */
  combinedWith: string[];
  requests: FloorRequest[];
};

export type FloorZone = {
  id: string;
  name: LocaleMap;
  sortOrder: number;
  /** Room size in metres — a restaurant knows its terrace is 12 by 8. */
  widthM: number;
  depthM: number;
};

export type FloorState = {
  identity: StaffIdentity;
  tables: FloorTable[];
  areas: FloorZone[];
  /** Venue's own thresholds for when a repeat ask becomes a problem. */
  escalation: EscalationSettings;
  /** Venue's table-time allowances. */
  turns: TurnSettings;
};

/**
 * Derives a table's status.
 *
 * Two things escalate a table: time, and repeat asking.
 *
 * A guest who presses the same button a second time has decided nobody
 * is coming. That is a worse signal than the clock — a table that asked
 * twice in ninety seconds is more annoyed than one waiting quietly for
 * six minutes — so a repeat tap goes straight to overdue regardless of
 * elapsed time.
 *
 * Acknowledged requests still count as waiting: the guest asked, and
 * until it is fulfilled they are still waiting. A waiter tapping "seen"
 * must not make a table look green.
 */
export function deriveTableStatus(
  table: Pick<FloorTable, "sessionId" | "requests">,
  now: number = Date.now(),
  settings: EscalationSettings = DEFAULT_ESCALATION_SETTINGS
): TableStatus {
  if (!table.sessionId) {
    return "clear";
  }

  if (table.requests.length === 0) {
    return "good";
  }

  // A repeat ask outranks the clock — but only once the venue's grace
  // period has passed. Before that the guest is simply impatient, and
  // the waiter is probably already on the way.
  if (isEscalated(table, now, settings)) {
    return "overdue";
  }

  let oldestSeconds = 0;
  for (const request of table.requests) {
    const age = (now - new Date(request.createdAt).getTime()) / 1000;
    if (age > oldestSeconds) {
      oldestSeconds = age;
    }
  }

  if (oldestSeconds >= OVERDUE_THRESHOLD_SECONDS) {
    return "overdue";
  }

  if (oldestSeconds >= WAITING_THRESHOLD_SECONDS) {
    return "waiting";
  }

  return "good";
}

/**
 * True when a table has asked again AND waited long enough for that to
 * mean something. This is what raises it to the manager.
 *
 * Both conditions matter. Repeat presses inside the grace period are
 * recorded but ignored by the floor: a guest tapping twice in ninety
 * seconds has told you they are impatient, not that they are being
 * neglected.
 */
export function isEscalated(
  table: Pick<FloorTable, "requests">,
  now: number = Date.now(),
  settings: EscalationSettings = DEFAULT_ESCALATION_SETTINGS
): boolean {
  return table.requests.some((request) =>
    isRequestEscalated(request, now, settings)
  );
}

export function isRequestEscalated(
  request: Pick<FloorRequest, "tapCount" | "createdAt">,
  now: number = Date.now(),
  settings: EscalationSettings = DEFAULT_ESCALATION_SETTINGS
): boolean {
  if (request.tapCount < settings.repeatThreshold) {
    return false;
  }

  const ageSeconds = (now - new Date(request.createdAt).getTime()) / 1000;
  return ageSeconds >= settings.graceSeconds;
}

export function formatElapsed(from: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(from).getTime()) / 1000);

  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
