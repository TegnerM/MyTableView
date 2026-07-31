import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { resolveStaff, VENUE_COOKIE } from "@/lib/staff/venue-context";

/**
 * POST /api/venues/add  { venueName, timezone? }
 *
 * Owner only. Creates restaurant #2..N on the caller's billing
 * account via the add_venue_for_owner() Postgres function, which
 * enforces the limits in ONE place: up to 3 restaurants while
 * unsubscribed (each with its own 14-day trial), the tier's size when
 * subscribed. The new venue becomes the device's active venue.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let venueName = "";
  let timezone = "";

  try {
    const body = (await request.json()) as {
      venueName?: unknown;
      timezone?: unknown;
    };
    venueName = typeof body.venueName === "string" ? body.venueName.trim() : "";
    timezone =
      typeof body.timezone === "string" && body.timezone.length < 64
        ? body.timezone.trim()
        : "";
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  if (venueName.length < 2 || venueName.length > 80) {
    return NextResponse.json(
      { ok: false, reason: "invalid_venue_name" },
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

  const { data: venueId, error } = await service.rpc("add_venue_for_owner", {
    p_user_id: user.id,
    p_venue_name: venueName,
    p_display_name: resolved.current.displayName,
    p_timezone: timezone || "Europe/Madrid",
    p_locale: "en",
  });

  if (error || !venueId) {
    const limitHit = error?.message?.includes("venue_limit_reached");
    if (!limitHit) {
      console.error("add venue: failed", error?.message);
    }
    return NextResponse.json(
      { ok: false, reason: limitHit ? "venue_limit_reached" : "error" },
      { status: limitHit ? 409 : 500 }
    );
  }

  const store = await cookies();
  store.set(VENUE_COOKIE, String(venueId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, venueId }, { status: 200 });
}
