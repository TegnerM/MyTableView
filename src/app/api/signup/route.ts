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
  inviteToken?: unknown;
  referralCode?: unknown;
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

  let service: ReturnType<typeof getServiceClient>;
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

  // ---- acquisition attribution (best-effort; never blocks signup) --
  try {
    const KEY = /^[a-z0-9_-]{1,64}$/i;
    const fromBody =
      typeof body.inviteToken === "string" && KEY.test(body.inviteToken.trim())
        ? body.inviteToken.trim()
        : null;
    const cookieVal = (name: string) => {
      const value = store.get(name)?.value ?? null;
      return value && KEY.test(value) ? value : null;
    };

    const inviteToken = fromBody ?? cookieVal("mtv-invite");
    const ref = cookieVal("mtv-ref");
    const rmc = cookieVal("mtv-rmc");
    const utm = cookieVal("mtv-utm");

    // Typed referral code — for verbal pitches ("use my code maria").
    // It outranks the cookie: the person's own statement of who sent
    // them beats a stale first-touch. Only real influencer codes count;
    // anything else is silently ignored so a typo never blocks signup.
    let typedRef: string | null = null;
    const rawTyped =
      typeof body.referralCode === "string"
        ? body.referralCode.trim().toLowerCase()
        : "";
    if (/^[a-z0-9-]{2,32}$/.test(rawTyped)) {
      const { data: influencer } = await service
        .from("influencers")
        .select("code")
        .eq("code", rawTyped)
        .eq("active", true)
        .maybeSingle<{ code: string }>();
      typedRef = influencer?.code ?? null;
    }

    let kind: string | null = null;
    let key: string | null = null;
    if (inviteToken) {
      kind = "invite";
      key = inviteToken;
    } else if (typedRef) {
      kind = "ref";
      key = typedRef;
    } else if (ref) {
      kind = "ref";
      key = ref;
    } else if (rmc) {
      kind = "rmc";
      key = rmc;
    } else if (utm) {
      kind = "utm";
      key = utm;
    }

    const { data: account } = await service
      .from("accounts")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle<{ id: string }>();

    if (account && kind) {
      const update: Record<string, string> = {
        acquired_source_kind: kind,
        acquired_source_key: key ?? "",
      };

      if (inviteToken) {
        const { data: invite } = await service
          .from("invites")
          .select("id, trial_days, accepted_at")
          .eq("token", inviteToken)
          .maybeSingle<{
            id: string;
            trial_days: number;
            accepted_at: string | null;
          }>();

        if (invite && !invite.accepted_at) {
          update.invite_id = invite.id;

          await service
            .from("invites")
            .update({
              accepted_at: new Date().toISOString(),
              accepted_account_id: account.id,
            })
            .eq("id", invite.id);

          // Invited restaurants can carry a custom trial length.
          if (
            Number.isInteger(invite.trial_days) &&
            invite.trial_days > 0 &&
            invite.trial_days !== 14 &&
            invite.trial_days <= 365
          ) {
            await service
              .from("venues")
              .update({
                trial_ends_at: new Date(
                  Date.now() + invite.trial_days * 86_400_000
                ).toISOString(),
              })
              .eq("id", venueId);
          }
        }
      }

      await service.from("accounts").update(update).eq("id", account.id);
    }
  } catch (attributionError) {
    console.error("signup: attribution failed", attributionError);
  }

  return NextResponse.json({ ok: true, venueId }, { status: 200 });
}
