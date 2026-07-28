import { getServiceClient } from "@/lib/supabase/service";

/**
 * Resolves an NFC tag to a live guest context.
 *
 * A guest taps a tag and lands on /t/[tagId]. This function validates the
 * tag, checks the venue can accept activity, finds or opens the session for
 * that table, and returns everything the guest screen needs to render.
 *
 * Runs server-side only, using the service-role client. Guests are never
 * authenticated against Postgres.
 */

export const TAG_ID_PATTERN = /^[a-z0-9]{10}$/;

export type ResolveFailure =
  | "invalid_format"
  | "unknown_tag"
  | "tag_not_assigned"
  | "venue_unavailable"
  | "venue_hibernating"
  | "error";

export type LocaleMap = Record<string, string>;

export type ServiceMode = "signal" | "self_service";
export type RequestKind = "signal" | "order";

export type GuestRequestType = {
  id: string;
  code: string;
  kind: RequestKind;
  label: LocaleMap;
  sublabel: LocaleMap;
  icon: string | null;
  closesSession: boolean;
  sortOrder: number;
};

export type GuestVenue = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  defaultLocale: string;
  locales: string[];
  serviceMode: ServiceMode;
  branding: Record<string, unknown>;
};

export type GuestContext = {
  tagId: string;
  venue: GuestVenue;
  table: {
    id: string;
    label: string;
    areaName: LocaleMap | null;
  };
  session: {
    id: string;
    state: string;
    openedAt: string;
    isNew: boolean;
    guestCount: number | null;
  };
  requestTypes: GuestRequestType[];
  openRequestTypeIds: string[];
};

export type ResolveResult =
  | { ok: true; context: GuestContext }
  | { ok: false; reason: ResolveFailure };

type TagRow = {
  id: string;
  status: string;
  venue_id: string | null;
  table_id: string | null;
  tables: {
    id: string;
    label: string;
    active: boolean;
    areas: { name: LocaleMap } | null;
  } | null;
  venues: {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    default_locale: string;
    locales: string[];
    service_mode: ServiceMode;
    branding: Record<string, unknown>;
  } | null;
};

type RequestTypeRow = {
  id: string;
  code: string;
  kind: RequestKind;
  label: LocaleMap | null;
  sublabel: LocaleMap | null;
  icon: string | null;
  closes_session: boolean;
  sort_order: number;
};

type OpenRequestRow = {
  request_type_id: string;
};

export async function resolveTag(rawTagId: string): Promise<ResolveResult> {
  const tagId = rawTagId.trim().toLowerCase();

  if (!TAG_ID_PATTERN.test(tagId)) {
    return { ok: false, reason: "invalid_format" };
  }

  const supabase = getServiceClient();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select(
      `
        id,
        status,
        venue_id,
        table_id,
        tables:table_id (
          id,
          label,
          active,
          areas:area_id ( name )
        ),
        venues:venue_id (
          id,
          name,
          slug,
          status,
          timezone,
          default_locale,
          locales,
          service_mode,
          branding
        )
      `
    )
    .eq("id", tagId)
    .maybeSingle<TagRow>();

  if (tagError) {
    console.error("resolveTag: tag lookup failed", tagError);
    return { ok: false, reason: "error" };
  }

  if (!tag) {
    return { ok: false, reason: "unknown_tag" };
  }

  if (tag.status === "lost" || tag.status === "retired") {
    return { ok: false, reason: "unknown_tag" };
  }

  if (!tag.venue_id || !tag.venues) {
    return { ok: false, reason: "tag_not_assigned" };
  }

  if (!tag.table_id || !tag.tables || !tag.tables.active) {
    return { ok: false, reason: "tag_not_assigned" };
  }

  const venue = tag.venues;

  if (venue.status === "hibernating") {
    return { ok: false, reason: "venue_hibernating" };
  }

  if (venue.status !== "active") {
    return { ok: false, reason: "venue_unavailable" };
  }

  const session = await openGuestSession(venue.id, tag.table_id);

  if (!session) {
    return { ok: false, reason: "error" };
  }

  const [requestTypes, openRequestTypeIds] = await Promise.all([
    loadRequestTypes(venue.id),
    loadOpenRequestTypeIds(session.id),
  ]);

  return {
    ok: true,
    context: {
      tagId: tag.id,
      venue: {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        timezone: venue.timezone,
        defaultLocale: venue.default_locale,
        locales: venue.locales ?? [],
        serviceMode: venue.service_mode,
        branding: venue.branding ?? {},
      },
      table: {
        id: tag.tables.id,
        label: tag.tables.label,
        areaName: tag.tables.areas?.name ?? null,
      },
      session,
      requestTypes,
      openRequestTypeIds,
    },
  };
}

type SessionSummary = GuestContext["session"];

/**
 * Finds the open session covering this table, or opens one.
 *
 * Delegates to the `guest_open_session` Postgres function so the session
 * insert and the session_tables link happen in a single transaction. Two
 * guests tapping the same table simultaneously cannot produce two sessions
 * or leave an orphan behind.
 */
async function openGuestSession(
  venueId: string,
  tableId: string
): Promise<SessionSummary | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .rpc("guest_open_session", {
      p_venue_id: venueId,
      p_table_id: tableId,
    })
    .maybeSingle<{
      session_id: string;
      state: string;
      opened_at: string;
      is_new: boolean;
    }>();

  if (error || !data) {
    console.error("openGuestSession: rpc failed", error);
    return null;
  }

  // Headcount, if the waiter entered one. Shown in the guest page's
  // status strip — real data or nothing, never a mock number.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("guest_count")
    .eq("id", data.session_id)
    .maybeSingle<{ guest_count: number | null }>();

  return {
    id: data.session_id,
    state: data.state,
    openedAt: data.opened_at,
    isNew: data.is_new,
    guestCount: sessionRow?.guest_count ?? null,
  };
}

async function loadRequestTypes(venueId: string): Promise<GuestRequestType[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("request_types")
    .select("id, code, kind, label, sublabel, icon, closes_session, sort_order")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<RequestTypeRow[]>();

  if (error) {
    console.error("loadRequestTypes: failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    kind: row.kind as RequestKind,
    label: (row.label ?? {}) as LocaleMap,
    sublabel: (row.sublabel ?? {}) as LocaleMap,
    icon: row.icon,
    closesSession: row.closes_session,
    sortOrder: row.sort_order,
  }));
}

/**
 * Request types already outstanding for this session, so the guest sees
 * what they have asked for rather than tapping the same button twice
 * wondering whether it registered.
 */
async function loadOpenRequestTypeIds(sessionId: string): Promise<string[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("requests")
    .select("request_type_id")
    .eq("session_id", sessionId)
    .in("state", ["open", "acknowledged"])
    .returns<OpenRequestRow[]>();

  if (error) {
    console.error("loadOpenRequestTypeIds: failed", error);
    return [];
  }

  return Array.from(new Set((data ?? []).map((row) => row.request_type_id)));
}
