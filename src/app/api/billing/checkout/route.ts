import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getPlan, isPlanKey } from "@/lib/billing/plans";
import { getStripe, getPriceId, resolveOrigin } from "@/lib/billing/stripe";

/**
 * POST /api/billing/checkout  { plan: PlanKey }
 *
 * Owner only. The subscription lives on the owner's billing ACCOUNT
 * and covers up to the tier's number of restaurants. The chosen tier
 * must be big enough for the venues the account already runs.
 *
 * The account id travels in both the session metadata and the
 * subscription metadata so the webhook can always find its way home.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let planKey;

  try {
    const body = (await request.json()) as { plan?: unknown };
    if (!isPlanKey(body.plan)) {
      return NextResponse.json(
        { ok: false, reason: "invalid_plan" },
        { status: 400 }
      );
    }
    planKey = body.plan;
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
  // commit the restaurant group to a subscription.
  if (resolved.current.role !== "owner") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const service = getServiceClient();

  const { data: account, error: accountError } = await service
    .from("accounts")
    .select("id, stripe_customer_id")
    .eq("owner_user_id", user.id)
    .maybeSingle<{ id: string; stripe_customer_id: string | null }>();

  if (accountError || !account) {
    console.error("checkout: account lookup failed", accountError?.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  // The tier must cover every venue the account already runs.
  const { count: venueCount } = await service
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);

  const plan = getPlan(planKey);

  if (plan && venueCount !== null && venueCount > plan.maxVenues) {
    return NextResponse.json(
      { ok: false, reason: "tier_too_small", venueCount },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();

    let customerId = account.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { account_id: account.id },
      });
      customerId = customer.id;

      const { error: saveError } = await service
        .from("accounts")
        .update({ stripe_customer_id: customerId })
        .eq("id", account.id);

      if (saveError) {
        console.error("checkout: saving customer id failed", saveError.message);
      }
    }

    const origin = resolveOrigin(request);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(planKey), quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { account_id: account.id, plan: planKey },
      subscription_data: {
        metadata: { account_id: account.id, plan: planKey },
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
