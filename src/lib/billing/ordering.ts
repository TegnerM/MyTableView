import { getServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import {
  getStripe,
  getOrderingPriceId,
  isOrderingPrice,
} from "@/lib/billing/stripe";
import { isTrialRunning } from "@/lib/billing/status";

/**
 * Keeps the Stripe side of the Ordering add-on honest.
 *
 * The rule: the add-on subscription item's quantity equals the number
 * of the account's venues that have ordering_active AND are past their
 * own free trial. Trial venues taste the full product for free; the
 * moment the trial lapses (and the account is subscribed) the daily
 * sweep picks the venue up and the quantity rises.
 *
 * Called from the owner's toggle API and from the daily cron. Runs on
 * the service client — callers gate authorization.
 */

type AccountRow = {
  id: string;
  billing_status: string | null;
  plan: string | null;
  stripe_subscription_id: string | null;
  ordering_quantity: number;
};

type VenueRow = {
  id: string;
  ordering_active: boolean;
  trial_ends_at: string | null;
};

export type SyncResult =
  | { ok: true; quantity: number; changed: boolean }
  | { ok: false; reason: "account_not_found" | "stripe_error" | "error" };

export async function syncOrderingQuantity(
  accountId: string
): Promise<SyncResult> {
  const service = getServiceClient();

  const { data: account, error: accountError } = await service
    .from("accounts")
    .select("id, billing_status, plan, stripe_subscription_id, ordering_quantity")
    .eq("id", accountId)
    .maybeSingle<AccountRow>();

  if (accountError || !account) {
    if (accountError) {
      console.error("syncOrderingQuantity: account load failed", accountError.message);
    }
    return { ok: false, reason: "account_not_found" };
  }

  const { data: venues, error: venuesError } = await service
    .from("venues")
    .select("id, ordering_active, trial_ends_at")
    .eq("account_id", accountId)
    .returns<VenueRow[]>();

  if (venuesError) {
    console.error("syncOrderingQuantity: venues load failed", venuesError.message);
    return { ok: false, reason: "error" };
  }

  const payable = (venues ?? []).filter(
    (venue) => venue.ordering_active && !isTrialRunning(venue.trial_ends_at)
  ).length;

  const subscribed =
    account.billing_status === "active" || account.billing_status === "past_due";

  // No subscription (all-trial account, or lapsed): nothing to bill.
  // The db quantity still tracks the truth for the day they subscribe.
  if (!subscribed || !account.stripe_subscription_id) {
    if (account.ordering_quantity !== payable) {
      await service
        .from("accounts")
        .update({ ordering_quantity: payable })
        .eq("id", accountId);
    }
    return { ok: true, quantity: payable, changed: false };
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      account.stripe_subscription_id,
      { expand: ["items.data.price"] }
    );

    const addonItem = subscription.items.data.find((item) =>
      isOrderingPrice(item.price)
    );
    const currentQuantity = addonItem ? (addonItem.quantity ?? 0) : 0;

    if (currentQuantity !== payable) {
      if (addonItem && payable === 0) {
        await stripe.subscriptionItems.del(addonItem.id, {
          proration_behavior: "create_prorations",
        });
      } else if (addonItem) {
        await stripe.subscriptionItems.update(addonItem.id, {
          quantity: payable,
          proration_behavior: "create_prorations",
        });
      } else if (payable > 0) {
        // Match the add-on's interval to the base plan's interval so
        // one invoice covers everything.
        const interval =
          getPlan(account.plan)?.interval === "yearly" ? "yearly" : "monthly";
        const priceId = await getOrderingPriceId(interval);

        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: priceId,
          quantity: payable,
          proration_behavior: "create_prorations",
        });
      }
    }

    if (account.ordering_quantity !== payable) {
      await service
        .from("accounts")
        .update({ ordering_quantity: payable })
        .eq("id", accountId);
    }

    return {
      ok: true,
      quantity: payable,
      changed: currentQuantity !== payable,
    };
  } catch (error) {
    console.error(
      "syncOrderingQuantity: stripe failed",
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "stripe_error" };
  }
}
