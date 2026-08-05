import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/staff/join — accept a staff invite.
 *
 * Two paths, decided by whether the invited email already has an
 * account:
 * - New person: they set a display name + password; the account is
 *   created with email pre-confirmed (they proved the inbox by
 *   clicking the emailed link) and the staff row is written. The
 *   client then signs them in with the password they just chose.
 * - Existing account: creating fails with "already registered", and we
 *   only attach the staff row if the CALLER'S SESSION is that same
 *   email — otherwise anyone holding the link could bind themselves to
 *   someone else's identity. The client responds by sending them
 *   through sign-in and retrying.
 *
 * The token is single-use: accepted_at is stamped in the same flow
 * that writes the staff row.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: unknown;
  displayName?: unknown;
  password?: unknown;
};

const TOKEN = /^[0-9a-f]{16,64}$/;

type InviteRow = {
  id: string;
  venue_id: string;
  email: string;
  role: "waiter" | "manager";
  display_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const token =
    typeof body.token === "string" && TOKEN.test(body.token) ? body.token : null;

  if (!token) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: invite } = await service
    .from("staff_invites")
    .select("id, venue_id, email, role, display_name, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (
    !invite ||
    invite.revoked_at !== null ||
    invite.accepted_at !== null ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { ok: false, reason: "invite_invalid" },
      { status: 410 }
    );
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim().slice(0, 60)
      : (invite.display_name ?? invite.email.split("@")[0]);

  /** Writes the staff link (or reactivates a soft-removed one) and
   *  consumes the invite. */
  const attach = async (userId: string) => {
    const { data: existing } = await service
      .from("staff")
      .select("id, active")
      .eq("user_id", userId)
      .eq("venue_id", invite.venue_id)
      .maybeSingle<{ id: string; active: boolean }>();

    if (existing) {
      const { error } = await service
        .from("staff")
        .update({ active: true, role: invite.role, display_name: displayName })
        .eq("id", existing.id);
      if (error) return error.message;
    } else {
      const { error } = await service.from("staff").insert({
        user_id: userId,
        venue_id: invite.venue_id,
        display_name: displayName,
        role: invite.role,
        active: true,
      });
      if (error) return error.message;
    }

    await service
      .from("staff_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_user: userId })
      .eq("id", invite.id)
      .is("accepted_at", null);

    return null;
  };

  // Path A — the visitor is already signed in as the invited email.
  const supabase = await getServerClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (sessionUser?.email?.toLowerCase() === invite.email.toLowerCase()) {
    const detail = await attach(sessionUser.id);
    if (detail) {
      return NextResponse.json({ ok: false, detail }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "attached" });
  }

  // Path B — create the account with the chosen password.
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, reason: "password_required" },
      { status: 400 }
    );
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

  if (createError) {
    // Already registered → they must prove the identity by signing in.
    if (/already|registered|exists/i.test(createError.message)) {
      return NextResponse.json(
        { ok: false, reason: "account_exists" },
        { status: 409 }
      );
    }
    console.error("join: createUser failed", createError.message);
    return NextResponse.json(
      { ok: false, detail: createError.message },
      { status: 500 }
    );
  }

  const detail = await attach(created.user.id);
  if (detail) {
    return NextResponse.json({ ok: false, detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "created" });
}
