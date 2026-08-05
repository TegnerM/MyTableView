import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import { getStripe, planKeyFromPriceId } from "@/lib/billing/stripe";

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

  const service = getServiceClient();

  const { error } = await service
    .from("accounts")
    .update({
      billing_status: "active",
      plan: plan?.key ?? null,
      max_venues: plan?.maxVenues ?? 1,
      stripe_subscription_id: subscriptionId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("id", accountId);

  if (error) {
    throw new Error(`account update failed: ${error.message}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const service = getServiceClient();

  const accountId = subscription.metadata?.account_id ?? null;

  const status = mapStatus(subscription.status);

  if (status === null) {
    // incomplete / incomplete_expired: checkout never finished — the
    // account keeps whatever state it had. Nothing to write.
    return;
  }

  // Portal upgrades/downgrades arrive as subscription.updated with a
  // new price — map it back to the tier and its venue limit.
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = getPlan(planKeyFromPriceId(priceId));

  const update: Record<string, string | number | null> = {
    billing_status: status,
    stripe_subscription_id: subscription.id,
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
