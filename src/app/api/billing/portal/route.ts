import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, resolveOrigin } from "@/lib/billing/stripe";

/**
 * POST /api/billing/portal
 *
 * Owner only. Opens the Stripe customer portal — change card, switch
 * plan, download invoices, cancel. All resulting changes flow back
 * through the webhook.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const resolved = await resolveStaff();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  if (resolved.current.role !== "owner") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const service = getServiceClient();

  const { data: venue, error } = await service
    .from("venues")
    .select("stripe_customer_id")
    .eq("id", resolved.current.venueId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (error || !venue?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, reason: "no_billing" },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: venue.stripe_customer_id,
      return_url: `${resolveOrigin(request)}/staff/settings`,
    });

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (portalError) {
    console.error(
      "portal: stripe error",
      portalError instanceof Error ? portalError.message : portalError
    );
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
