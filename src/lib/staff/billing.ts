import { getServerClient } from "@/lib/supabase/server";
import {
  isVenueLocked,
  trialDaysLeft,
  type AccountBillingStatus,
} from "@/lib/billing/status";
import { getPlan, type PlanKey } from "@/lib/billing/plans";

/**
 * Venue + account billing state for staff surfaces.
 *
 * Read through RLS as the signed-in staff member: staff can select
 * their venue row, and the billing_accounts policy lets staff of any
 * venue in the account read the account.
 *
 * FAILS OPEN. If the query errors (migration not applied yet,
 * transient outage), the venue is treated as active and the failure is
 * logged. A billing bug must never lock a restaurant's floor during
 * service.
 */

export type VenueBilling = {
  /** The account's subscription state. */
  accountStatus: AccountBillingStatus;
  plan: PlanKey | null;
  maxVenues: number;
  stripeCustomerId: string | null;
  /** This venue's own trial. */
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  locked: boolean;
  /** Why a locked venue is locked — drives the lock screen copy. */
  lockReason: "trial" | "canceled";
};

const OPEN_FALLBACK: VenueBilling = {
  accountStatus: "active",
  plan: null,
  maxVenues: 0,
  stripeCustomerId: null,
  trialEndsAt: null,
  trialDaysLeft: null,
  locked: false,
  lockReason: "trial",
};

type Row = {
  trial_ends_at: string | null;
  billing_accounts: {
    billing_status: string | null;
    plan: string | null;
    max_venues: number | null;
    stripe_customer_id: string | null;
  } | null;
};

export async function getVenueBilling(venueId: string): Promise<VenueBilling> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("venues")
    .select(
      "trial_ends_at, billing_accounts:billing_account_id ( billing_status, plan, max_venues, stripe_customer_id )"
    )
    .eq("id", venueId)
    .maybeSingle<Row>();

  if (error || !data) {
    if (error) {
      console.error("getVenueBilling: failed open", error.message);
    }
    return OPEN_FALLBACK;
  }

  const account = data.billing_accounts;
  const accountStatus = (account?.billing_status ?? "none") as AccountBillingStatus;

  return {
    accountStatus,
    plan: getPlan(account?.plan)?.key ?? null,
    maxVenues: account?.max_venues ?? 0,
    stripeCustomerId: account?.stripe_customer_id ?? null,
    trialEndsAt: data.trial_ends_at,
    trialDaysLeft: trialDaysLeft(data.trial_ends_at),
    locked: isVenueLocked(data.trial_ends_at, accountStatus),
    lockReason: accountStatus === "canceled" ? "canceled" : "trial",
  };
}
