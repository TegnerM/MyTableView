import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, resolveOrigin } from "@/lib/billing/stripe";

/**
 * POST /api/billing/portal
 *
 * Owner only. Opens the Stripe customer portal for the owner's billing
 * ACCOUNT — change card, switch tier, download invoices, cancel. All
 * resulting changes flow back through the webhook.
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

  const { data: account, error } = await service
    .from("billing_accounts")
    .select("stripe_customer_id")
    .eq("owner_user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (error || !account?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, reason: "no_billing" },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripe_customer_id,
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
