import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, isOrderingPrice } from "@/lib/billing/stripe";

/**
 * Ordering (the menu) is INCLUDED in every subscription — restaurant,
 * bar and hotel alike. Nothing is billed for it; the owner's toggle is
 * purely a feature switch.
 *
 * This sync survives as the janitor for accounts that subscribed back
 * when Ordering was a €19-per-restaurant add-on: it finds the legacy
 * add-on item on the Stripe subscription and removes it (with a
 * proration credit). Called from the owner's toggle API and the daily
 * cron, so every legacy account is cleaned up on its next touch.
 * Runs on the service client — callers gate authorization.
 */

type AccountRow = {
  id: string;
  billing_status: string | null;
  plan: string | null;
  stripe_subscription_id: string | null;
  ordering_quantity: number;
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

  const subscribed =
    account.billing_status === "active" || account.billing_status === "past_due";

  // Nothing on Stripe to clean up (all-trial account, or lapsed).
  if (!subscribed || !account.stripe_subscription_id) {
    if (account.ordering_quantity !== 0) {
      const { error } = await service
        .from("accounts")
        .update({ ordering_quantity: 0 })
        .eq("id", accountId);
      if (error) {
        console.error("syncOrderingQuantity: quantity reset failed", error.message);
      }
    }
    return { ok: true, quantity: 0, changed: false };
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      account.stripe_subscription_id,
      { expand: ["items.data.price"] }
    );

    // A legacy add-on item from before Ordering became included:
    // remove it and let Stripe credit the unused time.
    const addonItem = subscription.items.data.find((item) =>
      isOrderingPrice(item.price)
    );

    if (addonItem) {
      await stripe.subscriptionItems.del(addonItem.id, {
        proration_behavior: "create_prorations",
      });
    }

    if (account.ordering_quantity !== 0) {
      const { error } = await service
        .from("accounts")
        .update({ ordering_quantity: 0 })
        .eq("id", accountId);
      if (error) {
        console.error("syncOrderingQuantity: quantity reset failed", error.message);
      }
    }

    return { ok: true, quantity: 0, changed: Boolean(addonItem) };
  } catch (error) {
    console.error(
      "syncOrderingQuantity: stripe failed",
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "stripe_error" };
  }
}
