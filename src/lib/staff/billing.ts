import { getServerClient } from "@/lib/supabase/server";
import {
  isBillingLocked,
  trialDaysLeft,
  type BillingStatus,
} from "@/lib/billing/status";

/**
 * Venue billing state for staff surfaces.
 *
 * Read through RLS as the signed-in staff member — staff can already
 * select their own venue row, and the billing columns ride along.
 *
 * FAILS OPEN. If the query errors (columns missing because the
 * migration hasn't run yet, transient outage), the venue is treated as
 * active and the failure is logged. A billing bug must never lock a
 * restaurant's floor during service.
 */

export type VenueBilling = {
  status: BillingStatus;
  trialEndsAt: string | null;
  plan: "monthly" | "yearly" | null;
  stripeCustomerId: string | null;
  locked: boolean;
  trialDaysLeft: number | null;
};

const OPEN_FALLBACK: VenueBilling = {
  status: "active",
  trialEndsAt: null,
  plan: null,
  stripeCustomerId: null,
  locked: false,
  trialDaysLeft: null,
};

type VenueBillingRow = {
  billing_status: string | null;
  trial_ends_at: string | null;
  plan: string | null;
  stripe_customer_id: string | null;
};

export async function getVenueBilling(venueId: string): Promise<VenueBilling> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("venues")
    .select("billing_status, trial_ends_at, plan, stripe_customer_id")
    .eq("id", venueId)
    .maybeSingle<VenueBillingRow>();

  if (error || !data) {
    if (error) {
      console.error("getVenueBilling: failed open", error.message);
    }
    return OPEN_FALLBACK;
  }

  const status = (data.billing_status ?? "active") as BillingStatus;

  return {
    status,
    trialEndsAt: data.trial_ends_at,
    plan: data.plan === "monthly" || data.plan === "yearly" ? data.plan : null,
    stripeCustomerId: data.stripe_customer_id,
    locked: isBillingLocked(data.billing_status, data.trial_ends_at),
    trialDaysLeft: trialDaysLeft(data.billing_status, data.trial_ends_at),
  };
}
