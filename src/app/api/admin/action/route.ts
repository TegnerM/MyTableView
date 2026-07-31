import { NextResponse } from "next/server";
import { requireAdmin, logAudit } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";

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

    default:
      return NextResponse.json(
        { ok: false, detail: "unknown action" },
        { status: 400 }
      );
  }
}
