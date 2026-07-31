import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { VENUE_COOKIE } from "@/lib/staff/venue-context";

/**
 * POST /api/signup
 *
 * Second half of self-serve signup. The browser has already created the
 * auth user (supabase.auth.signUp) and holds a session; this route
 * verifies that session, then calls the signup_create_venue() Postgres
 * function with the service role — venue, owner staff row, starter zone
 * and default request types land in one transaction.
 *
 * The venue cookie is set here so the very first staff page load
 * resolves to the venue that was just created.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  venueName?: unknown;
  displayName?: unknown;
  timezone?: unknown;
};

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

  const venueName =
    typeof body.venueName === "string" ? body.venueName.trim() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const timezone =
    typeof body.timezone === "string" && body.timezone.length < 64
      ? body.timezone.trim()
      : "";

  if (venueName.length < 2 || venueName.length > 80) {
    return NextResponse.json(
      { ok: false, reason: "invalid_venue_name" },
      { status: 400 }
    );
  }

  if (displayName.length < 1 || displayName.length > 80) {
    return NextResponse.json(
      { ok: false, reason: "invalid_display_name" },
      { status: 400 }
    );
  }

  // The cookie session is the proof of who is signing up. Never trust a
  // user id from the request body.
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

  let service;
  try {
    service = getServiceClient();
  } catch (configError) {
    // SUPABASE_SERVICE_ROLE_KEY missing in this deployment.
    console.error("signup: service client unavailable", configError);
    return NextResponse.json(
      {
        ok: false,
        reason: "server_misconfigured",
        detail:
          configError instanceof Error
            ? configError.message
            : "service client unavailable",
      },
      { status: 500 }
    );
  }

  // One venue per signup call; a user who already belongs somewhere is
  // signed in, not re-onboarded. (Multi-venue owners get venue #2 via a
  // future "add venue" action, not by signing up twice.)
  const { data: existing } = await service
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { ok: false, reason: "already_staff" },
      { status: 409 }
    );
  }

  const { data: venueId, error } = await service.rpc("signup_create_venue", {
    p_user_id: user.id,
    p_venue_name: venueName,
    p_display_name: displayName,
    p_timezone: timezone || "Europe/Madrid",
    p_locale: "en",
  });

  if (error || !venueId) {
    console.error(
      "signup: create venue failed",
      error?.message,
      error?.details,
      error?.hint,
      error?.code
    );
    // detail is surfaced to the (signed-in) user while we stabilise
    // signup — a real error message beats "please try again".
    return NextResponse.json(
      {
        ok: false,
        reason: "error",
        detail: error
          ? `${error.code ?? ""} ${error.message}${error.details ? ` — ${error.details}` : ""}`.trim()
          : "function returned no venue id",
      },
      { status: 500 }
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
