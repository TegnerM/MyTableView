import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";

/**
 * POST /api/staff/settings
 *
 * Venue-level settings. Managers and owners only — the RLS policy on
 * venues already restricts updates to managers, but the role is checked
 * here too so an unauthorised call fails clearly rather than silently
 * updating nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  graceSeconds?: unknown;
  repeatThreshold?: unknown;
  standardMinutes?: unknown;
  largeMinutes?: unknown;
  largePartySize?: unknown;
};

const ALLOWED_GRACE = [120, 180, 300, 480, 600];
const ALLOWED_REPEAT = [2, 3, 4];
const ALLOWED_TURN_STANDARD = [75, 90, 105, 120, 150];
const ALLOWED_TURN_LARGE = [150, 180, 210, 240, 300];
const ALLOWED_TURN_SIZE = [4, 5, 6, 8, 10];

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  // Validate per action before touching the database.
  let update: Record<string, number>;

  if (body.action === "escalation") {
    const graceSeconds = Number(body.graceSeconds);
    const repeatThreshold = Number(body.repeatThreshold);

    if (
      !ALLOWED_GRACE.includes(graceSeconds) ||
      !ALLOWED_REPEAT.includes(repeatThreshold)
    ) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input" },
        { status: 400 }
      );
    }

    update = {
      escalation_grace_seconds: graceSeconds,
      escalation_repeat_threshold: repeatThreshold,
    };
  } else if (body.action === "turns") {
    const standardMinutes = Number(body.standardMinutes);
    const largeMinutes = Number(body.largeMinutes);
    const largePartySize = Number(body.largePartySize);

    if (
      !ALLOWED_TURN_STANDARD.includes(standardMinutes) ||
      !ALLOWED_TURN_LARGE.includes(largeMinutes) ||
      !ALLOWED_TURN_SIZE.includes(largePartySize)
    ) {
      return NextResponse.json(
        { ok: false, reason: "invalid_input" },
        { status: 400 }
      );
    }

    update = {
      turn_standard_minutes: standardMinutes,
      turn_large_minutes: largeMinutes,
      turn_large_party_size: largePartySize,
    };
  } else {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const supabase = await getServerClient();

  const resolved = await resolveStaff();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  // The venue this DEVICE is working as — same resolution as every
  // staff page, so a multi-venue account can never edit venue B while
  // looking at venue A.
  const staff = {
    venue_id: resolved.current.venueId,
    role: resolved.current.role,
  };

  if (staff.role !== "owner" && staff.role !== "manager") {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("venues")
    .update(update)
    .eq("id", staff.venue_id);

  if (error) {
    console.error("settings: update failed", error.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
