import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { sendTrialReminderEmail } from "@/lib/email/resend";

/**
 * GET /api/cron/trial-reminders — fired daily by Vercel Cron (see
 * vercel.json, 09:00 UTC).
 *
 * Finds venues whose free trial hits a milestone today — 3 days left,
 * 1 day left, or ended within the last day — and emails the account
 * owner, unless the account already subscribed. Each (venue, milestone)
 * is claimed in trial_notices BEFORE sending, with the unique
 * constraint as the lock: a retried or double-fired cron can never
 * email anyone twice.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the
 * env var exists. No secret configured → the route refuses everything,
 * fail closed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type VenueRow = {
  id: string;
  name: string;
  trial_ends_at: string | null;
  accounts: {
    billing_status: string | null;
    owner_user_id: string | null;
  } | null;
};

type Milestone = "3d" | "1d" | "ended";

const DAY_MS = 86_400_000;

function milestoneFor(trialEndsAt: string, now: number): Milestone | null {
  const remaining = new Date(trialEndsAt).getTime() - now;

  // "Ended within the last day" — the run right after expiry.
  if (remaining <= 0) {
    return remaining > -DAY_MS ? "ended" : null;
  }

  const daysLeft = Math.ceil(remaining / DAY_MS);
  if (daysLeft === 3) return "3d";
  if (daysLeft === 1) return "1d";
  return null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const service = getServiceClient();
  const now = Date.now();

  const { data: venues, error } = await service
    .from("venues")
    .select(
      "id, name, trial_ends_at, accounts:account_id ( billing_status, owner_user_id )"
    )
    .not("trial_ends_at", "is", null)
    // Only trials that could possibly be at a milestone: ending within
    // 4 days, or ended within the last day.
    .lt("trial_ends_at", new Date(now + 4 * DAY_MS).toISOString())
    .gt("trial_ends_at", new Date(now - DAY_MS).toISOString())
    .returns<VenueRow[]>();

  if (error) {
    console.error("trial-reminders: venue query failed", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const sent: { venue: string; kind: Milestone }[] = [];
  let checked = 0;

  for (const venue of venues ?? []) {
    checked += 1;

    if (!venue.trial_ends_at) continue;

    // Subscribed (or grace-period) accounts don't need nudging.
    const status = venue.accounts?.billing_status ?? "none";
    if (status === "active" || status === "past_due") continue;

    const kind = milestoneFor(venue.trial_ends_at, now);
    if (!kind) continue;

    // Claim the milestone. ignoreDuplicates + select: an already-sent
    // milestone comes back as an empty array and is skipped — this is
    // the idempotency lock.
    const { data: claimed, error: claimError } = await service
      .from("trial_notices")
      .upsert(
        { venue_id: venue.id, kind },
        { onConflict: "venue_id,kind", ignoreDuplicates: true }
      )
      .select("venue_id");

    if (claimError) {
      console.error("trial-reminders: claim failed", claimError.message);
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // already sent

    const ownerId = venue.accounts?.owner_user_id;
    if (!ownerId) continue;

    const { data: owner, error: ownerError } =
      await service.auth.admin.getUserById(ownerId);

    if (ownerError || !owner.user.email) {
      console.error(
        "trial-reminders: owner lookup failed",
        venue.id,
        ownerError?.message
      );
      continue;
    }

    const result = await sendTrialReminderEmail({
      to: owner.user.email,
      venueName: venue.name,
      kind,
    });

    if (result.sent) {
      sent.push({ venue: venue.name, kind });
    } else {
      console.error(
        "trial-reminders: send failed",
        venue.id,
        result.detail ?? "not configured"
      );
    }
  }

  return NextResponse.json({ ok: true, checked, sent });
}
