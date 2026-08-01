import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin, logAudit } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { sendInviteEmail } from "@/lib/email/resend";

/**
 * POST /api/admin/action — every admin mutation funnels through here.
 *
 * requireAdmin() re-verifies session + platform_admins membership +
 * aal2 on EVERY call — independent of any page-level check. Non-admins
 * get a 404 indistinguishable from the route not existing. Every
 * mutation lands in admin_audit before the response returns.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  venueId?: unknown;
  accountId?: unknown;
  days?: unknown;
  note?: unknown;
  confirmName?: unknown;
  name?: unknown;
  code?: unknown;
  influencerId?: unknown;
  active?: unknown;
  email?: unknown;
  trialDays?: unknown;
  inviteId?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const gate = await requireAdmin();

  if (!gate.ok) {
    // 404: to a non-admin this endpoint does not exist.
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, detail: "invalid input" },
      { status: 400 }
    );
  }

  const service = getServiceClient();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const venueId =
    typeof body.venueId === "string" && UUID.test(body.venueId)
      ? body.venueId
      : null;
  const accountId =
    typeof body.accountId === "string" && UUID.test(body.accountId)
      ? body.accountId
      : null;

  switch (body.action) {
    case "lock_venue":
    case "unlock_venue": {
      if (!venueId) {
        return NextResponse.json(
          { ok: false, detail: "venueId required" },
          { status: 400 }
        );
      }

      const nextStatus = body.action === "lock_venue" ? "hibernating" : "active";
      const { error } = await service
        .from("venues")
        .update({ status: nextStatus })
        .eq("id", venueId);

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(gate.userId, body.action, { type: "venue", id: venueId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "extend_trial": {
      const days = Number(body.days);
      if (!venueId || !Number.isInteger(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { ok: false, detail: "venueId and days (1–365) required" },
          { status: 400 }
        );
      }

      const newEnd = new Date(Date.now() + days * 86_400_000).toISOString();
      const { error } = await service
        .from("venues")
        .update({ trial_ends_at: newEnd })
        .eq("id", venueId);

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "extend_trial",
        { type: "venue", id: venueId },
        { days, new_end: newEnd },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    case "save_note": {
      const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";
      if (!accountId) {
        return NextResponse.json(
          { ok: false, detail: "accountId required" },
          { status: 400 }
        );
      }

      const { error } = await service
        .from("accounts")
        .update({ admin_notes: note })
        .eq("id", accountId);

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      // Notes are routine; audited without the note body to keep the
      // trail compact.
      await logAudit(gate.userId, "save_note", { type: "account", id: accountId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "purge_venue": {
      const confirmName =
        typeof body.confirmName === "string" ? body.confirmName.trim() : "";

      if (!venueId || !confirmName) {
        return NextResponse.json(
          { ok: false, detail: "venueId and confirmName required" },
          { status: 400 }
        );
      }

      // The name check happens server-side too — the client prompt is
      // UX, not security.
      const { data: venue } = await service
        .from("venues")
        .select("name")
        .eq("id", venueId)
        .maybeSingle<{ name: string }>();

      if (!venue) {
        return NextResponse.json(
          { ok: false, detail: "venue not found" },
          { status: 404 }
        );
      }

      if (venue.name.trim() !== confirmName) {
        return NextResponse.json(
          { ok: false, detail: "name does not match" },
          { status: 400 }
        );
      }

      const { error } = await service.rpc("admin_purge_venue", {
        p_venue_id: venueId,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "purge_venue",
        { type: "venue", id: venueId },
        { name: venue.name },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    case "create_influencer": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const code =
        typeof body.code === "string" ? body.code.trim().toLowerCase() : "";

      if (name.length < 1 || !/^[a-z0-9-]{2,32}$/.test(code)) {
        return NextResponse.json(
          {
            ok: false,
            detail: "name and code (2–32 chars, a–z 0–9 -) required",
          },
          { status: 400 }
        );
      }

      const { error } = await service
        .from("influencers")
        .insert({ name, code, active: true });

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(gate.userId, "create_influencer", {}, { name, code }, ip);
      return NextResponse.json({ ok: true });
    }

    case "toggle_influencer": {
      const influencerId =
        typeof body.influencerId === "string" && UUID.test(body.influencerId)
          ? body.influencerId
          : null;

      if (!influencerId || typeof body.active !== "boolean") {
        return NextResponse.json(
          { ok: false, detail: "influencerId and active required" },
          { status: 400 }
        );
      }

      const { error } = await service
        .from("influencers")
        .update({ active: body.active })
        .eq("id", influencerId);

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "toggle_influencer",
        { type: "influencer", id: influencerId },
        { active: body.active },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    case "create_invite": {
      const email =
        typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
      const note =
        typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
      const trialDays = Number(body.trialDays ?? 14);

      if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365) {
        return NextResponse.json(
          { ok: false, detail: "trialDays must be 1–365" },
          { status: 400 }
        );
      }

      const token = randomBytes(12).toString("hex");

      const { error } = await service.from("invites").insert({
        token,
        email: email || null,
        note: note || null,
        trial_days: trialDays,
        created_by: gate.userId,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "create_invite",
        {},
        { email, trial_days: trialDays },
        ip
      );
      return NextResponse.json({ ok: true, token });
    }

    case "email_invite": {
      const inviteId =
        typeof body.inviteId === "string" && UUID.test(body.inviteId)
          ? body.inviteId
          : null;

      if (!inviteId) {
        return NextResponse.json(
          { ok: false, detail: "inviteId required" },
          { status: 400 }
        );
      }

      const { data: invite } = await service
        .from("invites")
        .select("token, email, note, trial_days")
        .eq("id", inviteId)
        .maybeSingle<{
          token: string;
          email: string | null;
          note: string | null;
          trial_days: number;
        }>();

      if (!invite?.email) {
        return NextResponse.json(
          { ok: false, detail: "invite has no email address" },
          { status: 400 }
        );
      }

      const site =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";
      const result = await sendInviteEmail({
        to: invite.email,
        inviteLink: `${site}/staff/sign-up?invite=${invite.token}`,
        note: invite.note,
        trialDays: invite.trial_days,
      });

      if (!result.configured) {
        return NextResponse.json(
          {
            ok: false,
            detail:
              "RESEND_API_KEY not set — copy the invite link and send it yourself",
          },
          { status: 400 }
        );
      }

      if (!result.sent) {
        return NextResponse.json(
          { ok: false, detail: result.detail ?? "send failed" },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "email_invite",
        { type: "invite", id: inviteId },
        { to: invite.email },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { ok: false, detail: "unknown action" },
        { status: 400 }
      );
  }
}
