import Stripe from "stripe";
import { getPlan, type PlanKey } from "@/lib/billing/plans";

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

/** The site origin for redirect URLs, preferring the request's own. */
export function resolveOrigin(request: Request): string {
  const fromHeader = request.headers.get("origin");
  if (fromHeader) {
    return fromHeader;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";
}
