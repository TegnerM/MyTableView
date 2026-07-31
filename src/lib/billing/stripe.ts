import Stripe from "stripe";

/**
 * Stripe client + price map.
 *
 * Server-side only. The secret key and the two sandbox price IDs come
 * from the environment — nothing Stripe-related is hardcoded, so
 * promoting sandbox → live is an env change, not a code change.
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

export type Plan = "monthly" | "yearly";

export function getPriceId(plan: Plan): string {
  const id =
    plan === "monthly"
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_YEARLY;

  if (!id) {
    throw new Error(
      plan === "monthly"
        ? "STRIPE_PRICE_MONTHLY is not set"
        : "STRIPE_PRICE_YEARLY is not set"
    );
  }

  return id;
}

/** Reverse lookup for webhooks: which plan does this price id mean? */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) {
    return null;
  }
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) {
    return "monthly";
  }
  if (priceId === process.env.STRIPE_PRICE_YEARLY) {
    return "yearly";
  }
  return null;
}

/** The site origin for redirect URLs, preferring the request's own. */
export function resolveOrigin(request: Request): string {
  const fromHeader = request.headers.get("origin");
  if (fromHeader) {
    return fromHeader;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";
}
