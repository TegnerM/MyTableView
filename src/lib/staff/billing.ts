import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import {
  isVenueLocked,
  isOrderingLive,
  trialDaysLeft,
  type AccountBillingStatus,
} from "@/lib/billing/status";
import { getPlan, type PlanKey } from "@/lib/billing/plans";

/**
 * Venue + account billing state for staff surfaces.
 *
 * Read through RLS as the signed-in staff member: staff can select
 * their venue row, and the accounts policy lets staff of any
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
  /** The owner's Ordering switch for THIS venue. */
  orderingActive: boolean;
  /** Whether guests can actually order right now (switch + trial/sub). */
  orderingLive: boolean;
  /** Cart service line, 0–20 %. */
  serviceChargePct: number;
  /** The account runs at least one hotel venue → hotel bundle plans. */
  hasHotel: boolean;
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
  orderingActive: false,
  orderingLive: false,
  serviceChargePct: 0,
  hasHotel: false,
};

type Row = {
  account_id: string | null;
  trial_ends_at: string | null;
  ordering_active: boolean | null;
  service_charge_pct: number | string | null;
  accounts: {
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
      "account_id, trial_ends_at, ordering_active, service_charge_pct, accounts:account_id ( billing_status, plan, max_venues, stripe_customer_id )"
    )
    .eq("id", venueId)
    .maybeSingle<Row>();

  if (error || !data) {
    if (error) {
      console.error("getVenueBilling: failed open", error.message);
    }
    return OPEN_FALLBACK;
  }

  const account = data.accounts;
  const accountStatus = (account?.billing_status ?? "none") as AccountBillingStatus;

  // Any hotel venue on the account → the bundle plans apply. Service
  // client: RLS may hide sibling venues from this staff member, and
  // the caller has already been authorized for this venue.
  let hasHotel = false;
  if (data.account_id) {
    try {
      const service = getServiceClient();
      const { data: editions } = await service
        .from("venues")
        .select("edition")
        .eq("account_id", data.account_id)
        .returns<{ edition: string | null }[]>();
      hasHotel = (editions ?? []).some((row) => row.edition === "hotel");
    } catch (hotelError) {
      console.error("getVenueBilling: hotel check failed", hotelError);
    }
  }

  return {
    accountStatus,
    plan: getPlan(account?.plan)?.key ?? null,
    maxVenues: account?.max_venues ?? 0,
    stripeCustomerId: account?.stripe_customer_id ?? null,
    trialEndsAt: data.trial_ends_at,
    trialDaysLeft: trialDaysLeft(data.trial_ends_at),
    locked: isVenueLocked(data.trial_ends_at, accountStatus),
    lockReason: accountStatus === "canceled" ? "canceled" : "trial",
    orderingActive: Boolean(data.ordering_active),
    orderingLive: isOrderingLive(
      data.ordering_active,
      data.trial_ends_at,
      accountStatus
    ),
    serviceChargePct: Number(data.service_charge_pct ?? 0) || 0,
    hasHotel,
  };
}
