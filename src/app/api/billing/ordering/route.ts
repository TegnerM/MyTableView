import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { isTrialRunning } from "@/lib/billing/status";
import { syncOrderingQuantity } from "@/lib/billing/ordering";

/**
 * POST /api/billing/ordering
 *
 *   { enable: boolean }            — switch Ordering for the CURRENT venue
 *   { serviceChargePct: number }   — set the cart's service line (0–20)
 *
 * Owner only, like every billing action. Enabling on a subscribed
 * account adds/raises the €19-per-restaurant subscription item with
 * proration; on a venue still in trial it's free until the trial ends
 * (the daily sweep starts billing then). Enabling with no subscription
 * and no trial is refused — subscribe first.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { enable?: unknown; serviceChargePct?: unknown };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  if (resolved.current.role !== "owner") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const venueId = resolved.current.venueId;
  const service = getServiceClient();

  // ---- service charge -------------------------------------------------
  if (typeof body.serviceChargePct === "number") {
    const pct = body.serviceChargePct;
    if (!Number.isFinite(pct) || pct < 0 || pct > 20) {
      return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
    }

    const { error } = await service
      .from("venues")
      .update({ service_charge_pct: Math.round(pct * 10) / 10 })
      .eq("id", venueId);

    if (error) {
      console.error("ordering: service charge update failed", error.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ---- enable / disable ----------------------------------------------
  if (typeof body.enable !== "boolean") {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const { data: venue, error: venueError } = await service
    .from("venues")
    .select("id, account_id, trial_ends_at, ordering_active, accounts:account_id ( billing_status )")
    .eq("id", venueId)
    .maybeSingle<{
      id: string;
      account_id: string;
      trial_ends_at: string | null;
      ordering_active: boolean;
      accounts: { billing_status: string | null } | null;
    }>();

  if (venueError || !venue) {
    console.error("ordering: venue load failed", venueError?.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  const accountStatus = venue.accounts?.billing_status ?? "none";
  const subscribed = accountStatus === "active" || accountStatus === "past_due";
  const inTrial = isTrialRunning(venue.trial_ends_at);

  if (body.enable && !inTrial && !subscribed) {
    // No free trial left and no subscription to bill against.
    return NextResponse.json(
      { ok: false, reason: "subscribe_first" },
      { status: 400 }
    );
  }

  const { error: flagError } = await service
    .from("venues")
    .update({ ordering_active: body.enable })
    .eq("id", venueId);

  if (flagError) {
    console.error("ordering: flag update failed", flagError.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  // Keep Stripe honest. If Stripe is briefly unreachable the flag still
  // stands and the daily sweep will reconcile — an owner's activation
  // must not bounce on a transient Stripe hiccup.
  const sync = await syncOrderingQuantity(venue.account_id);

  return NextResponse.json(
    {
      ok: true,
      orderingActive: body.enable,
      billedQuantity: sync.ok ? sync.quantity : null,
      billingSynced: sync.ok,
    },
    { status: 200 }
  );
}
