import { getServiceClient } from "@/lib/supabase/service";
import type { LocaleMap } from "@/lib/menu/types";

/**
 * Venue-defined stations — the generalization that carries every
 * edition. Slugs are stable machine names ('kitchen', 'bar', later
 * 'housekeeping'...); display names are per-venue locale maps.
 *
 * Client-safe types at the top; the loaders below are server-only via
 * the service client (callers gate authorization).
 */

export type VenueStation = {
  slug: string;
  name: LocaleMap;
  sortOrder: number;
};

export const DEFAULT_STATIONS: VenueStation[] = [
  {
    slug: "kitchen",
    sortOrder: 1,
    name: {
      en: "Kitchen", es: "Cocina", da: "Køkken", sv: "Kök",
      no: "Kjøkken", de: "Küche", nl: "Keuken", fr: "Cuisine",
    },
  },
  {
    slug: "bar",
    sortOrder: 2,
    name: {
      en: "Bar", es: "Barra", da: "Bar", sv: "Bar",
      no: "Bar", de: "Bar", nl: "Bar", fr: "Bar",
    },
  },
];

/** The hotel edition's extra station. Requests still reach the floor;
 *  this board carries order tickets for categories a hotel routes to
 *  housekeeping (minibar restock, pillow menu, ...). */
export const HOUSEKEEPING_STATION: VenueStation = {
  slug: "housekeeping",
  sortOrder: 3,
  name: {
    en: "Housekeeping", es: "Limpieza", da: "Housekeeping", sv: "Städning",
    no: "Renhold", de: "Housekeeping", nl: "Housekeeping", fr: "Ménage",
  },
};

/** Bar-edition display names for the same two slugs — the snack
 *  kitchen is still the 'kitchen' station underneath. */
export const BAR_EDITION_STATION_NAMES: Record<string, LocaleMap> = {
  kitchen: {
    en: "Snack kitchen", es: "Cocina de snacks", da: "Snackkøkken",
    sv: "Snackkök", no: "Snackkjøkken", de: "Snackküche",
    nl: "Snackkeuken", fr: "Cuisine snacks",
  },
  bar: {
    en: "Bar", es: "Barra", da: "Bar", sv: "Bar",
    no: "Bar", de: "Bar", nl: "Bar", fr: "Bar",
  },
};

type StationRow = {
  slug: string;
  name: LocaleMap | null;
  sort_order: number;
};

/**
 * A venue's active stations, seeding the defaults on first touch so a
 * venue created before (or outside) the migration can never end up
 * station-less.
 */
export async function loadVenueStations(venueId: string): Promise<VenueStation[]> {
  const service = getServiceClient();

  const { data, error } = await service
    .from("stations")
    .select("slug, name, sort_order")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<StationRow[]>();

  if (error) {
    console.error("loadVenueStations: failed", error.message);
    return DEFAULT_STATIONS;
  }

  if (!data || data.length === 0) {
    const { error: seedError } = await service.from("stations").insert(
      DEFAULT_STATIONS.map((station) => ({
        venue_id: venueId,
        slug: station.slug,
        name: station.name,
        sort_order: station.sortOrder,
      }))
    );
    if (seedError) {
      console.error("loadVenueStations: seed failed", seedError.message);
    }
    return DEFAULT_STATIONS;
  }

  return data.map((row) => ({
    slug: row.slug,
    name: row.name ?? {},
    sortOrder: row.sort_order,
  }));
}

/** Set membership test used by the menu/order APIs. */
export async function isVenueStation(
  venueId: string,
  slug: string
): Promise<boolean> {
  const stations = await loadVenueStations(venueId);
  return stations.some((station) => station.slug === slug);
}
