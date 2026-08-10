/**
 * Venue → property grouping for navigation.
 *
 * A hotel signup creates sibling venues named "<Property> — Restaurant"
 * and "<Property> — Bar" beside the hotel's own "<Property>". To the
 * owner that is ONE venue — so navigation groups by the shared base
 * name and shows Restaurant / Bar / Hotel nested underneath.
 *
 * Venues that share no base with anything else render flat, exactly
 * as before — a three-restaurant group is three entries, not a tree.
 */

export type GroupableVenue = {
  venueId: string;
  venueName: string;
  edition?: string;
};

export type VenueGroup<V extends GroupableVenue> = {
  /** The property name ("Grand Meridian") for a real group; the plain
   *  venue name for a group of one. */
  base: string;
  venues: V[];
  /** True when 2+ venues share the base — render as a tree. */
  grouped: boolean;
};

const SEPARATOR = " — ";

export function venueBaseName(name: string): string {
  const index = name.indexOf(SEPARATOR);
  return index > 0 ? name.slice(0, index) : name;
}

/**
 * The short name to show under a property header: the part after
 * "<Property> — ", or null when the venue IS the property (the hotel
 * itself) — callers label that one by its edition.
 */
export function venueShortName(name: string, base: string): string | null {
  if (name === base) return null;
  if (name.startsWith(base + SEPARATOR)) {
    const short = name.slice(base.length + SEPARATOR.length).trim();
    return short.length > 0 ? short : null;
  }
  return null;
}

export function groupVenues<V extends GroupableVenue>(
  venues: V[]
): VenueGroup<V>[] {
  const byBase = new Map<string, V[]>();
  const order: string[] = [];

  for (const venue of venues) {
    const base = venueBaseName(venue.venueName);
    const bucket = byBase.get(base);
    if (bucket) {
      bucket.push(venue);
    } else {
      byBase.set(base, [venue]);
      order.push(base);
    }
  }

  return order.map((base) => {
    const members = byBase.get(base) ?? [];
    return { base, venues: members, grouped: members.length > 1 };
  });
}
