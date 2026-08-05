import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { sendStaffInviteEmail } from "@/lib/email/resend";

/**
 * POST /api/staff/team — owners and managers run their crew.
 *
 * invite: create a staff invite (waiter, or manager if the caller is
 *         the owner) and email the join link. Without RESEND_API_KEY
 *         the link is returned for manual sending — same fallback the
 *         admin invites use.
 * revoke: kill a pending invite.
 * remove: deactivate a staff member (soft: staff.active = false, so
 *         history and RLS-scoped rows keep their author).
 *
 * Authority ladder, enforced server-side on every call:
 * - owners manage everyone below them (managers + waiters)
 * - managers manage waiters only
 * - nobody touches owners, nobody removes themselves
 * - invites can never mint an owner
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  inviteId?: unknown;
  staffId?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function resolveOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

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

  const me = resolved.current;

  if (me.role !== "owner" && me.role !== "manager") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const service = getServiceClient();
  const venueId = me.venueId;

  switch (body.action) {
    // ---------------------------------------------------------- invite
    case "invite": {
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const displayName =
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim().slice(0, 60)
          : null;
      const role = body.role === "manager" ? "manager" : "waiter";

      if (!EMAIL.test(email)) {
        return NextResponse.json(
          { ok: false, detail: "That doesn't look like an email address." },
          { status: 400 }
        );
      }
      if (role === "manager" && me.role !== "owner") {
        return NextResponse.json(
          { ok: false, detail: "Only the owner can invite managers." },
          { status: 403 }
        );
      }

      // The caller's own email can't be invited, and neither can an
      // address that's already on this venue's crew.
      const supabase = await getServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email && user.email.toLowerCase() === email) {
        return NextResponse.json(
          { ok: false, detail: "That's you — you're already on the team." },
          { status: 400 }
        );
      }

      // Refresh any still-pending invite for the same address instead
      // of piling up rows: same email, same venue → same invite.
      const { data: pending } = await service
        .from("staff_invites")
        .select("id, token")
        .eq("venue_id", venueId)
        .eq("email", email)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .maybeSingle<{ id: string; token: string }>();

      let token: string;

      if (pending) {
        token = pending.token;
        await service
          .from("staff_invites")
          .update({
            role,
            display_name: displayName,
            expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
          })
          .eq("id", pending.id);
      } else {
        token = randomBytes(16).toString("hex");
        const { error } = await service.from("staff_invites").insert({
          venue_id: venueId,
          email,
          role,
          display_name: displayName,
          token,
          invited_by: user?.id ?? null,
          expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
        });
        if (error) {
          console.error("team invite: insert failed", error.message);
          return NextResponse.json(
            { ok: false, detail: error.message },
            { status: 500 }
          );
        }
      }

      const link = `${resolveOrigin(request)}/staff/join?token=${token}`;
      const emailResult = await sendStaffInviteEmail({
        to: email,
        venueName: me.venueName,
        inviterName: me.displayName,
        role,
        inviteLink: link,
      });

      return NextResponse.json({
        ok: true,
        link,
        emailSent: emailResult.sent,
        emailConfigured: emailResult.configured,
      });
    }

    // ---------------------------------------------------------- revoke
    case "revoke": {
      const inviteId =
        typeof body.inviteId === "string" && UUID.test(body.inviteId)
          ? body.inviteId
          : null;
      if (!inviteId) {
        return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
      }

      const { error } = await service
        .from("staff_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("venue_id", venueId)
        .is("accepted_at", null);

      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------- remove
    case "remove": {
      const staffId =
        typeof body.staffId === "string" && UUID.test(body.staffId)
          ? body.staffId
          : null;
      if (!staffId) {
        return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
      }
      if (staffId === me.staffId) {
        return NextResponse.json(
          { ok: false, detail: "You can't remove yourself." },
          { status: 400 }
        );
      }

      const { data: target } = await service
        .from("staff")
        .select("id, role")
        .eq("id", staffId)
        .eq("venue_id", venueId)
        .eq("active", true)
        .maybeSingle<{ id: string; role: string }>();

      if (!target) {
        return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
      }
      if (target.role === "owner") {
        return NextResponse.json(
          { ok: false, detail: "Owners can't be removed." },
          { status: 403 }
        );
      }
      if (target.role === "manager" && me.role !== "owner") {
        return NextResponse.json(
          { ok: false, detail: "Only the owner can remove managers." },
          { status: 403 }
        );
      }

      const { error } = await service
        .from("staff")
        .update({ active: false })
        .eq("id", staffId)
        .eq("venue_id", venueId);

      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  }
}
