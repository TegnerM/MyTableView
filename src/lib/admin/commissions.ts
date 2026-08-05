import type Stripe from "stripe";
import { getPlan, isPlanKey } from "@/lib/billing/plans";

/**
 * Influencer commissions — 50% of what a referred restaurant pays in
 * its first 3 months, computed from PAID Stripe invoices (never from
 * intentions), capped at 3 months' worth of the plan so a yearly
 * prepay earns the same as three monthly payments would:
 *
 *   monthly €49  → cap 3 × €49   → commission ≤ €73.50
 *   yearly  €490 → cap 3 × €490/12 → commission ≤ €61.25
 *
 * The 90-day window starts at the restaurant's FIRST paid invoice, so
 * a long trial doesn't quietly eat the influencer's earning period.
 */

export type ReferredAccountCommission = {
  accountName: string;
  registeredAt: string;
  influencerCode: string;
  planKey: string | null;
  firstPaidAt: string | null;
  paidInWindowCents: number;
  commissionCents: number;
};

type ReferredAccountRow = {
  id: string;
  name: string;
  created_at: string;
  acquired_source_key: string | null;
  stripe_customer_id: string | null;
  plan: string | null;
};

const WINDOW_MS = 90 * 86_400_000;

function monthlyEquivalentCents(planKey: string | null): number | null {
  if (!planKey || !isPlanKey(planKey)) return null;
  const plan = getPlan(planKey);
  const monthly =
    plan.interval === "yearly" ? plan.amount / 12 : plan.amount;
  return Math.round(monthly * 100);
}

export async function computeReferredCommissions(
  accounts: ReferredAccountRow[],
  stripe: Stripe
): Promise<ReferredAccountCommission[]> {
  const results: ReferredAccountCommission[] = [];

  for (const account of accounts) {
    const base: ReferredAccountCommission = {
      accountName: account.name,
      registeredAt: account.created_at,
      influencerCode: account.acquired_source_key ?? "",
      planKey: account.plan,
      firstPaidAt: null,
      paidInWindowCents: 0,
      commissionCents: 0,
    };

    if (!account.stripe_customer_id) {
      results.push(base);
      continue;
    }

    try {
      const invoices = await stripe.invoices.list({
        customer: account.stripe_customer_id,
        status: "paid",
        limit: 100,
      });

      const paid = invoices.data
        .filter((invoice) => (invoice.amount_paid ?? 0) > 0)
        .sort((a, b) => a.created - b.created);

      if (paid.length === 0) {
        results.push(base);
        continue;
      }

      const firstPaidMs = paid[0].created * 1000;
      const windowEnd = firstPaidMs + WINDOW_MS;

      const paidInWindow = paid
        .filter((invoice) => invoice.created * 1000 < windowEnd)
        .reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);

      const monthlyEq = monthlyEquivalentCents(account.plan);
      const capCents = monthlyEq !== null ? monthlyEq * 3 : paidInWindow;

      results.push({
        ...base,
        firstPaidAt: new Date(firstPaidMs).toISOString(),
        paidInWindowCents: paidInWindow,
        commissionCents: Math.round(Math.min(paidInWindow, capCents) * 0.5),
      });
    } catch (error) {
      console.error(
        "commissions: stripe lookup failed",
        account.id,
        error instanceof Error ? error.message : error
      );
      results.push(base);
    }
  }

  return results;
}

export function formatEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}
