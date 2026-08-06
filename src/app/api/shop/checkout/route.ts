import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, resolveOrigin } from "@/lib/billing/stripe";

/**
 * POST /api/shop/checkout — buy hardware (NFC tags, table numbers).
 *
 * One-off Stripe Checkout in payment mode: quantity is adjustable at
 * the checkout itself, shipping address is collected there, and the
 * order lands in Stripe where the money already lives. The price ID is
 * validated as a real, active, ONE-TIME price before a session is
 * created — a subscription price can never be smuggled through here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE = /^price_[A-Za-z0-9]+$/;

export async function POST(request: Request) {
  let body: { priceId?: unknown };
  try {
    body = (await request.json()) as { priceId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const priceId =
    typeof body.priceId === "string" && PRICE.test(body.priceId)
      ? body.priceId
      : null;
  if (!priceId) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  const me = resolved.current;
  if (me.role !== "owner" && me.role !== "manager") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  try {
    const stripe = getStripe();

    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "one_time") {
      return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
    }

    // Reuse the account's Stripe customer so orders and subscriptions
    // share one customer record.
    const service = getServiceClient();
    const { data: venue } = await service
      .from("venues")
      .select("account_id, accounts:account_id ( stripe_customer_id )")
      .eq("id", me.venueId)
      .maybeSingle<{
        account_id: string;
        accounts: { stripe_customer_id: string | null } | null;
      }>();

    const origin = resolveOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
          adjustable_quantity: { enabled: true, minimum: 1, maximum: 50 },
        },
      ],
      ...(venue?.accounts?.stripe_customer_id
        ? { customer: venue.accounts.stripe_customer_id }
        : {}),
      shipping_address_collection: {
        allowed_countries: [
          "ES", "DK", "SE", "NO", "DE", "NL", "FR", "BE", "AT", "IT",
          "PT", "FI", "IE", "LU", "GB",
        ],
      },
      billing_address_collection: "auto",
      metadata: {
        kind: "shop_order",
        venue_id: me.venueId,
        account_id: venue?.account_id ?? "",
        venue_name: me.venueName,
      },
      success_url: `${origin}/staff/shop?ordered=1`,
      cancel_url: `${origin}/staff/shop?cancelled=1`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error(
      "shop checkout failed",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
