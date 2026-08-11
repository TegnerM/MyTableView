/**
 * Menu + ordering shapes shared by guest and staff surfaces.
 *
 * Client-safe on purpose (like floor-types): no server imports, so
 * client components can use these without dragging the Supabase server
 * client into the browser bundle.
 */

export type LocaleMap = Record<string, string>;

/** Station slug — venue-defined (see lib/stations). 'kitchen' and
 *  'bar' are the seeded defaults; editions add their own. */
export type Station = string;

export function isStationSlug(value: unknown): value is Station {
  return typeof value === "string" && /^[a-z0-9_-]{1,40}$/.test(value);
}

export type MenuOption = {
  id: string;
  name: LocaleMap;
  surchargeCents: number;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: LocaleMap;
  description: LocaleMap;
  priceCents: number;
  /** 'stock:<key>' or an uploaded photo URL; null = no photo. */
  photo: string | null;
  allergens: string[];
  available: boolean;
  sortOrder: number;
  /** Published onto the linked bar's guest menu ("Also on the bar
   *  menu"). Absent on surfaces that don't load the flag. */
  alsoOnBar?: boolean;
  options: MenuOption[];
};

export type MenuCategory = {
  id: string;
  name: LocaleMap;
  station: Station;
  sortOrder: number;
  items: MenuItem[];
};

export type VenueMenu = {
  categories: MenuCategory[];
};

/** Ticket lifecycle on the kitchen/bar boards. */
export type TicketState = "new" | "preparing" | "ready" | "delivered" | "cancelled";

export type OrderItemLine = {
  id: string;
  name: LocaleMap;
  unitPriceCents: number;
  options: { name: LocaleMap; surchargeCents: number }[];
  quantity: number;
  lineTotalCents: number;
};

export type BoardTicket = {
  id: string;
  orderId: string;
  station: Station;
  state: TicketState;
  tableLabel: string;
  areaName: LocaleMap | null;
  note: string | null;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  items: OrderItemLine[];
};

/** Photo keys of the built-in stock illustration set (public/menu-stock). */
export const STOCK_PHOTOS = [
  "starter", "salad", "soup", "main", "steak", "fish", "pizza", "pasta",
  "burger", "dessert", "coffee", "wine", "beer", "cocktail", "softdrink",
  "water",
] as const;

export type StockPhotoKey = (typeof STOCK_PHOTOS)[number];

export function stockPhotoUrl(key: string): string {
  return `/menu-stock/${key}.svg`;
}

/** Resolves a stored photo value to a renderable URL, or null. */
export function photoUrl(photo: string | null | undefined): string | null {
  if (!photo) {
    return null;
  }
  if (photo.startsWith("stock:")) {
    const key = photo.slice("stock:".length);
    return /^[a-z0-9-]+$/.test(key) ? stockPhotoUrl(key) : null;
  }
  if (photo.startsWith("https://") || photo.startsWith("/")) {
    return photo;
  }
  return null;
}

export function formatCents(cents: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} €`;
  }
}
