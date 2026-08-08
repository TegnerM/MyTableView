import Stripe from "stripe";
import {
  getPlan,
  ORDERING_ADDON,
  type OrderingInterval,
  type PlanKey,
} from "@/lib/billing/plans";

/**
 * Stripe client + price resolution.
 *
 * Server-side only. Price IDs resolve per plan from the environment,
 * falling back to the baked-in sandbox IDs (see lib/billing/plans) so
 * sandbox needs no configuration. Live mode = set the env vars.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) {
    return cached;
  }

  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  cached = new Stripe(key);
  return cached;
}

export function getPriceId(planKey: PlanKey): string {
  const plan = getPlan(planKey);

  if (!plan) {
    throw new Error(`Unknown plan: ${planKey}`);
  }

  return process.env[plan.envVar] ?? plan.sandboxPriceId;
}

/** Reverse lookup for webhooks: which plan does this price id mean? */
export function planKeyFromPriceId(
  priceId: string | null | undefined
): PlanKey | null {
  if (!priceId) {
    return null;
  }

  for (const plan of (
    [
      "monthly-1", "yearly-1", "monthly-3", "yearly-3",
      "monthly-5", "yearly-5", "monthly-10", "yearly-10",
    ] as PlanKey[]
  )) {
    if (getPriceId(plan) === priceId) {
      return plan;
    }
  }

  return null;
}

/**
 * Resolves the Ordering add-on price for an interval.
 *
 * Env var wins; otherwise the price is found by lookup_key, and on the
 * very first use created (product + price) — idempotent because Stripe
 * enforces one active price per lookup_key via transfer_lookup_key
 * being unused and our search-first order.
 */
export async function getOrderingPriceId(
  interval: OrderingInterval
): Promise<string> {
  const addon = ORDERING_ADDON[interval];

  const fromEnv = process.env[addon.envVar];
  if (fromEnv) {
    return fromEnv;
  }

  const stripe = getStripe();

  const existing = await stripe.prices.list({
    lookup_keys: [addon.lookupKey],
    active: true,
    limit: 1,
  });

  if (existing.data[0]) {
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: "Ordering module",
    description:
      "In-app food & drink ordering for one restaurant. Guests browse the menu and order from the table.",
    metadata: { mtv_kind: "ordering_addon" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: addon.amount * 100,
    recurring: { interval: addon.interval },
    lookup_key: addon.lookupKey,
    metadata: { mtv_kind: "ordering_addon" },
  });

  return price.id;
}

/**
 * Whether a subscription item's price is the Ordering add-on (either
 * interval). Prefers metadata/lookup_key so it also matches env-var
 * prices created by hand in the dashboard.
 */
export function isOrderingPrice(
  price: Stripe.Price | null | undefined
): boolean {
  if (!price) {
    return false;
  }
  if (price.metadata?.mtv_kind === "ordering_addon") {
    return true;
  }
  if (
    price.lookup_key === ORDERING_ADDON.monthly.lookupKey ||
    price.lookup_key === ORDERING_ADDON.yearly.lookupKey
  ) {
    return true;
  }
  return (
    price.id === process.env[ORDERING_ADDON.monthly.envVar] ||
    price.id === process.env[ORDERING_ADDON.yearly.envVar]
  );
}

/** The site origin for redirect URLs, preferring the request's own. */
export function resolveOrigin(request: Request): string {
  const fromHeader = request.headers.get("origin");
  if (fromHeader) {
    return fromHeader;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";
}
