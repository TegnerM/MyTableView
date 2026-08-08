/**
 * The tier ladder — the single source of truth for plans, limits,
 * prices and their Stripe price IDs.
 *
 * Price IDs: env vars win when set (that's how live mode will work);
 * the baked-in defaults are the SANDBOX price IDs created 2026-07-31,
 * so sandbox needs zero extra configuration.
 *
 * Pure data + pure functions: imported by server routes AND client
 * components (PlanPicker), so nothing here may touch server-only APIs.
 */

export type PlanKey =
  | "monthly-1"
  | "yearly-1"
  | "monthly-3"
  | "yearly-3"
  | "monthly-5"
  | "yearly-5"
  | "monthly-10"
  | "yearly-10"
  | "hotel-monthly"
  | "hotel-yearly";

export type Plan = {
  key: PlanKey;
  interval: "monthly" | "yearly";
  maxVenues: 1 | 3 | 5 | 10;
  /** Display price, EUR. */
  amount: number;
  label: string;
  priceLabel: string;
  envVar: string;
  sandboxPriceId: string;
  /** The hotel bundle — Ordering included, resolved via lookup_key
   *  (auto-created on first checkout, like the Ordering add-on). */
  hotel?: boolean;
  lookupKey?: string;
};

export const PLANS: Plan[] = [
  {
    key: "monthly-1", interval: "monthly", maxVenues: 1, amount: 49,
    label: "1 restaurant", priceLabel: "€49 / month",
    envVar: "STRIPE_PRICE_MONTHLY_1",
    sandboxPriceId: "price_1TzBkBLz7mdUWO9SgTaKRsSU",
  },
  {
    key: "yearly-1", interval: "yearly", maxVenues: 1, amount: 490,
    label: "1 restaurant", priceLabel: "€490 / year",
    envVar: "STRIPE_PRICE_YEARLY_1",
    sandboxPriceId: "price_1TzBkaLz7mdUWO9SLSvyP9ky",
  },
  {
    key: "monthly-3", interval: "monthly", maxVenues: 3, amount: 99,
    label: "Up to 3 restaurants", priceLabel: "€99 / month",
    envVar: "STRIPE_PRICE_MONTHLY_3",
    sandboxPriceId: "price_1TzBmPLz7mdUWO9SoOrM64Aa",
  },
  {
    key: "yearly-3", interval: "yearly", maxVenues: 3, amount: 990,
    label: "Up to 3 restaurants", priceLabel: "€990 / year",
    envVar: "STRIPE_PRICE_YEARLY_3",
    sandboxPriceId: "price_1TzBqALz7mdUWO9SeH6ZEDW1",
  },
  {
    key: "monthly-5", interval: "monthly", maxVenues: 5, amount: 149,
    label: "Up to 5 restaurants", priceLabel: "€149 / month",
    envVar: "STRIPE_PRICE_MONTHLY_5",
    sandboxPriceId: "price_1TzBneLz7mdUWO9SJ443Xxmy",
  },
  {
    key: "yearly-5", interval: "yearly", maxVenues: 5, amount: 1490,
    label: "Up to 5 restaurants", priceLabel: "€1,490 / year",
    envVar: "STRIPE_PRICE_YEARLY_5",
    sandboxPriceId: "price_1TzBr0Lz7mdUWO9Su8yVsljQ",
  },
  {
    key: "monthly-10", interval: "monthly", maxVenues: 10, amount: 249,
    label: "Up to 10 restaurants", priceLabel: "€249 / month",
    envVar: "STRIPE_PRICE_MONTHLY_10",
    sandboxPriceId: "price_1TzBoaLz7mdUWO9SLhNgYL20",
  },
  {
    key: "yearly-10", interval: "yearly", maxVenues: 10, amount: 2490,
    label: "Up to 10 restaurants", priceLabel: "€2,490 / year",
    envVar: "STRIPE_PRICE_YEARLY_10",
    sandboxPriceId: "price_1TzBsALz7mdUWO9StD8ry1mf",
  },
  {
    key: "hotel-monthly", interval: "monthly", maxVenues: 3, amount: 149,
    label: "Hotel + restaurant + bar", priceLabel: "€149 / month",
    envVar: "STRIPE_PRICE_HOTEL_MONTHLY",
    sandboxPriceId: "",
    hotel: true, lookupKey: "mtv_hotel_monthly",
  },
  {
    key: "hotel-yearly", interval: "yearly", maxVenues: 3, amount: 1490,
    label: "Hotel + restaurant + bar", priceLabel: "€1,490 / year",
    envVar: "STRIPE_PRICE_HOTEL_YEARLY",
    sandboxPriceId: "",
    hotel: true, lookupKey: "mtv_hotel_yearly",
  },
];

/**
 * The Ordering module add-on — priced PER RESTAURANT on top of the
 * account subscription, one Stripe subscription item whose quantity is
 * the number of restaurants with Ordering switched on (trial venues
 * ride free and don't count).
 *
 * Price resolution differs from the base tiers: env var first, then a
 * Stripe lookup_key ("mtv_ordering_monthly"/"mtv_ordering_yearly") —
 * the server creates product + price on first use if neither exists,
 * so sandbox AND live need zero manual Stripe setup.
 */
export const ORDERING_ADDON = {
  monthly: {
    amount: 19,
    priceLabel: "€19 / month",
    envVar: "STRIPE_PRICE_ORDERING_MONTHLY",
    lookupKey: "mtv_ordering_monthly",
    interval: "month" as const,
  },
  yearly: {
    amount: 190,
    priceLabel: "€190 / year",
    envVar: "STRIPE_PRICE_ORDERING_YEARLY",
    lookupKey: "mtv_ordering_yearly",
    interval: "year" as const,
  },
} as const;

export type OrderingInterval = keyof typeof ORDERING_ADDON;

export function getPlan(key: string | null | undefined): Plan | null {
  return PLANS.find((plan) => plan.key === key) ?? null;
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && PLANS.some((p) => p.key === value);
}

/** Plans big enough for an account that already runs `venueCount` venues. */
export function plansForVenueCount(venueCount: number): Plan[] {
  return PLANS.filter(
    (plan) => !plan.hotel && plan.maxVenues >= Math.max(1, venueCount)
  );
}

/**
 * The plans an account may pick. A hotel account sees the bundle
 * (hotel + restaurant + bar, Ordering included); everyone else sees
 * the restaurant ladder. A hotel account that somehow exceeds the
 * bundle's 3 venues falls back to the big restaurant tiers.
 */
export function plansForAccount(venueCount: number, hasHotel: boolean): Plan[] {
  if (hasHotel) {
    const bundles = PLANS.filter(
      (plan) => plan.hotel && plan.maxVenues >= Math.max(1, venueCount)
    );
    if (bundles.length > 0) {
      return bundles;
    }
  }
  return plansForVenueCount(venueCount);
}
