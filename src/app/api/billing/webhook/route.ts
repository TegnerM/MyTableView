import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import {
  getStripe,
  planKeyFromPrice,
  isOrderingPrice,
} from "@/lib/billing/stripe";

/**
 * POST /api/billing/webhook — Stripe events.
 *
 * The single writer of ACCOUNT billing state after signup. Checkout
 * and the customer portal both funnel through here, so the database
 * always reflects what Stripe believes, never what the browser claims.
 * Tier changes made in the portal land here too — the price id maps
 * back to the plan and its venue limit.
 *
 * Signature-verified against STRIPE_WEBHOOK_SECRET; the raw body is
 * read as text BEFORE any JSON parsing, which the verification needs.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("webhook: STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error(
      "webhook: bad signature",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription
        );
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(
      `webhook: handling ${event.type} failed`,
      error instanceof Error ? error.message : error
    );
    // 500 so Stripe retries — these updates must not be lost.
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Shared Stripe account: another product's checkout reaches this endpoint
  // too. Return before the error log, or every one of their signups shows up
  // here as a fault that isn't one.
  if (!isOurs(session.metadata)) return;

  const accountId = session.metadata?.account_id;

  if (!accountId) {
    console.error("webhook: checkout session without account id", session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const plan = getPlan(session.metadata?.plan);

  // New checkouts never carry an Ordering add-on line (it's included in
  // every plan), so this reads 0 — kept as a mirror so a LEGACY add-on
  // item on an old subscription stays visible in the db until the
  // janitor removes it.
  let orderingQuantity = 0;
  if (subscriptionId) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(
        subscriptionId,
        { expand: ["items.data.price"] }
      );
      orderingQuantity = orderingQuantityFromItems(subscription);
    } catch (error) {
      console.error(
        "webhook: subscription fetch after checkout failed",
        error instanceof Error ? error.message : error
      );
      // subscription.updated will carry the same information later.
    }
  }

  const service = getServiceClient();

  const { error } = await service
    .from("accounts")
    .update({
      billing_status: "active",
      plan: plan?.key ?? null,
      max_venues: plan?.maxVenues ?? 1,
      ordering_quantity: orderingQuantity,
      stripe_subscription_id: subscriptionId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("id", accountId);

  if (error) {
    throw new Error(`account update failed: ${error.message}`);
  }
}

/** Quantity of the Ordering add-on among a subscription's items. */
function orderingQuantityFromItems(subscription: Stripe.Subscription): number {
  for (const item of subscription.items.data) {
    if (isOrderingPrice(item.price)) {
      return item.quantity ?? 0;
    }
  }
  return 0;
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  // Without this the fallback below searches `accounts` for a subscription id
  // belonging to another product. It updates nothing today only because those
  // ids never appear in this table — an absence, not a check.
  if (!isOurs(subscription.metadata)) return;

  const service = getServiceClient();

  const accountId = subscription.metadata?.account_id ?? null;

  const status = mapStatus(subscription.status);

  if (status === null) {
    // incomplete / incomplete_expired: checkout never finished — the
    // account keeps whatever state it had. Nothing to write.
    return;
  }

  // Portal upgrades/downgrades arrive as subscription.updated with a
  // new price. With the Ordering add-on the subscription can carry two
  // items — find the BASE plan among them (the add-on maps to no plan)
  // and read the add-on quantity while we're at it.
  let plan = null;
  for (const item of subscription.items.data) {
    const matched = getPlan(planKeyFromPrice(item.price));
    if (matched) {
      plan = matched;
      break;
    }
  }

  const update: Record<string, string | number | null> = {
    billing_status: status,
    stripe_subscription_id: subscription.id,
    ordering_quantity:
      status === "canceled" ? 0 : orderingQuantityFromItems(subscription),
  };

  if (plan) {
    update.plan = plan.key;
    update.max_venues = plan.maxVenues;
  }

  const query = service.from("accounts").update(update);

  const { error } = accountId
    ? await query.eq("id", accountId)
    : await query.eq("stripe_subscription_id", subscription.id);

  if (error) {
    throw new Error(`account update failed: ${error.message}`);
  }
}

/**
 * Does this Stripe object belong to MyTableView?
 *
 * Objects created before the app stamp was introduced carry no `app` key at
 * all, so an absent stamp is treated as ours — otherwise every existing
 * subscription would stop updating. Only an explicit foreign stamp is refused.
 */
function isOurs(metadata: Stripe.Metadata | null | undefined): boolean {
  const app = metadata?.app;
  return !app || app === "mytableview";
}

/**
 * Stripe subscription status → account billing_status. Null = don't
 * touch. past_due stays OPEN on the floor (see lib/billing/status);
 * Stripe retries the card and either recovers or ends at canceled.
 */
function mapStatus(
  status: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return null;
  }
}
