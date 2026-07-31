import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, getPriceId, resolveOrigin, type Plan } from "@/lib/billing/stripe";

/**
 * POST /api/billing/checkout  { plan: "monthly" | "yearly" }
 *
 * Owner only. Creates (or reuses) the venue's Stripe customer and
 * returns a Checkout session URL. The venue id travels in BOTH the
 * session metadata and the subscription metadata so the webhook can
 * always find its way home.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let plan: Plan;

  try {
    const body = (await request.json()) as { plan?: unknown };
    if (body.plan !== "monthly" && body.plan !== "yearly") {
      return NextResponse.json(
        { ok: false, reason: "invalid_plan" },
        { status: 400 }
      );
    }
    plan = body.plan;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const resolved = await resolveStaff();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  // Billing is the owner's alone — a manager can run the floor, not
  // commit the restaurant to a subscription.
  if (resolved.current.role !== "owner") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const venueId = resolved.current.venueId;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const service = getServiceClient();

  const { data: venue, error: venueError } = await service
    .from("venues")
    .select("name, stripe_customer_id")
    .eq("id", venueId)
    .maybeSingle<{ name: string; stripe_customer_id: string | null }>();

  if (venueError || !venue) {
    console.error("checkout: venue lookup failed", venueError?.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  try {
    const stripe = getStripe();

    let customerId = venue.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: venue.name,
        email: user?.email ?? undefined,
        metadata: { venue_id: venueId },
      });
      customerId = customer.id;

      const { error: saveError } = await service
        .from("venues")
        .update({ stripe_customer_id: customerId })
        .eq("id", venueId);

      if (saveError) {
        console.error("checkout: saving customer id failed", saveError.message);
      }
    }

    const origin = resolveOrigin(request);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(plan), quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { venue_id: venueId, plan },
      subscription_data: {
        metadata: { venue_id: venueId, plan },
      },
      success_url: `${origin}/staff/settings?billing=success`,
      cancel_url: `${origin}/staff/settings?billing=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (error) {
    console.error(
      "checkout: stripe error",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
