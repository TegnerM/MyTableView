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
  campaignId?: unknown;
  promoId?: unknown;
  caption?: unknown;
  link?: unknown;
  dir?: unknown;
  groupId?: unknown;
  url?: unknown;
  members?: unknown;
  country?: unknown;
  lang?: unknown;
  freqDays?: unknown;
  percentOff?: unknown;
  durationMonths?: unknown;
  maxRedemptions?: unknown;
  promoCodeId?: unknown;
  amountEur?: unknown;
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
        // Diagnostic: which RESEND-ish env NAMES exist at runtime
        // (names only — values are never exposed). Reveals wrong-name
        // and wrong-project cases instantly.
        const seen = Object.keys(process.env).filter((key) =>
          key.toUpperCase().includes("RESEND")
        );
        return NextResponse.json(
          {
            ok: false,
            detail: `RESEND_API_KEY not readable at runtime. RESEND-like vars visible to the server: ${seen.length ? seen.join(", ") : "none"}`,
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

    // ---------------------------------------------- campaigns/promos

    case "create_campaign": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      if (name.length < 1) {
        return NextResponse.json({ ok: false, detail: "name required" }, { status: 400 });
      }
      const { error } = await service.from("campaigns").insert({ name });
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "create_campaign", {}, { name }, ip);
      return NextResponse.json({ ok: true });
    }

    case "delete_campaign": {
      const campaignId =
        typeof body.campaignId === "string" && UUID.test(body.campaignId)
          ? body.campaignId
          : null;
      if (!campaignId) {
        return NextResponse.json({ ok: false, detail: "campaignId required" }, { status: 400 });
      }
      // Promos cascade via FK; groups/posts keep history with null campaign.
      const { error } = await service.from("campaigns").delete().eq("id", campaignId);
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "delete_campaign", { type: "campaign", id: campaignId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "create_promo":
    case "update_promo": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
      const caption = typeof body.caption === "string" ? body.caption.slice(0, 4000) : "";
      const link = typeof body.link === "string" ? body.link.trim().slice(0, 500) : "";

      if (body.action === "create_promo") {
        const campaignId =
          typeof body.campaignId === "string" && UUID.test(body.campaignId)
            ? body.campaignId
            : null;
        if (!campaignId || !name) {
          return NextResponse.json(
            { ok: false, detail: "campaignId and name required" },
            { status: 400 }
          );
        }
        const { data: last } = await service
          .from("promos")
          .select("position")
          .eq("campaign_id", campaignId)
          .order("position", { ascending: false })
          .limit(1);
        const position = ((last?.[0] as { position: number } | undefined)?.position ?? 0) + 1;
        const { error } = await service
          .from("promos")
          .insert({ campaign_id: campaignId, position, name, caption, link });
        if (error) {
          return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
        }
        await logAudit(gate.userId, "create_promo", { type: "campaign", id: campaignId }, { name }, ip);
        return NextResponse.json({ ok: true });
      }

      const promoId =
        typeof body.promoId === "string" && UUID.test(body.promoId) ? body.promoId : null;
      if (!promoId || !name) {
        return NextResponse.json(
          { ok: false, detail: "promoId and name required" },
          { status: 400 }
        );
      }
      const { error } = await service
        .from("promos")
        .update({ name, caption, link })
        .eq("id", promoId);
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "update_promo", { type: "promo", id: promoId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "delete_promo": {
      const promoId =
        typeof body.promoId === "string" && UUID.test(body.promoId) ? body.promoId : null;
      if (!promoId) {
        return NextResponse.json({ ok: false, detail: "promoId required" }, { status: 400 });
      }
      const { error } = await service.from("promos").delete().eq("id", promoId);
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "delete_promo", { type: "promo", id: promoId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "move_promo": {
      const promoId =
        typeof body.promoId === "string" && UUID.test(body.promoId) ? body.promoId : null;
      const dir = body.dir === "up" ? -1 : body.dir === "down" ? 1 : 0;
      if (!promoId || dir === 0) {
        return NextResponse.json(
          { ok: false, detail: "promoId and dir (up/down) required" },
          { status: 400 }
        );
      }
      const { data: promo } = await service
        .from("promos")
        .select("id, campaign_id, position")
        .eq("id", promoId)
        .maybeSingle<{ id: string; campaign_id: string; position: number }>();
      if (!promo) {
        return NextResponse.json({ ok: false, detail: "promo not found" }, { status: 404 });
      }
      const { data: neighbours } = await service
        .from("promos")
        .select("id, position")
        .eq("campaign_id", promo.campaign_id)
        .order("position", { ascending: true })
        .returns<{ id: string; position: number }[]>();
      const list = neighbours ?? [];
      const index = list.findIndex((p) => p.id === promo.id);
      const swapWith = list[index + dir];
      if (!swapWith) {
        return NextResponse.json({ ok: true }); // already at the edge
      }
      await service.from("promos").update({ position: swapWith.position }).eq("id", promo.id);
      await service.from("promos").update({ position: promo.position }).eq("id", swapWith.id);
      return NextResponse.json({ ok: true });
    }

    // ------------------------------------------------------- groups

    case "create_group":
    case "update_group": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
      const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "";
      const members = Number.isInteger(Number(body.members)) ? Number(body.members) : 0;
      const country = typeof body.country === "string" ? body.country.trim().slice(0, 60) : "";
      const lang = typeof body.lang === "string" ? body.lang.trim().slice(0, 40) : "";
      const freqDays =
        Number.isInteger(Number(body.freqDays)) && Number(body.freqDays) >= 1
          ? Math.min(Number(body.freqDays), 90)
          : 7;
      const campaignId =
        typeof body.campaignId === "string" && UUID.test(body.campaignId)
          ? body.campaignId
          : null;

      if (!name) {
        return NextResponse.json({ ok: false, detail: "name required" }, { status: 400 });
      }

      const fields = {
        name,
        url,
        members,
        country,
        lang,
        freq_days: freqDays,
        campaign_id: campaignId,
      };

      if (body.action === "create_group") {
        const { error } = await service.from("fb_groups").insert(fields);
        if (error) {
          return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
        }
        await logAudit(gate.userId, "create_group", {}, { name }, ip);
        return NextResponse.json({ ok: true });
      }

      const groupId =
        typeof body.groupId === "string" && UUID.test(body.groupId) ? body.groupId : null;
      if (!groupId) {
        return NextResponse.json({ ok: false, detail: "groupId required" }, { status: 400 });
      }
      const { error } = await service.from("fb_groups").update(fields).eq("id", groupId);
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "update_group", { type: "group", id: groupId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "delete_group": {
      const groupId =
        typeof body.groupId === "string" && UUID.test(body.groupId) ? body.groupId : null;
      if (!groupId) {
        return NextResponse.json({ ok: false, detail: "groupId required" }, { status: 400 });
      }
      const { error } = await service.from("fb_groups").delete().eq("id", groupId);
      if (error) {
        return NextResponse.json({ ok: false, detail: error.message }, { status: 500 });
      }
      await logAudit(gate.userId, "delete_group", { type: "group", id: groupId }, {}, ip);
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------- attribution

    case "set_attribution": {
      // The dispute-settler: an influencer pitched in person, the
      // restaurant signed up without link or code, the influencer
      // claims it, Michael verifies and stamps it. Audited.
      const code =
        typeof body.code === "string" ? body.code.trim().toLowerCase() : "";

      if (!accountId) {
        return NextResponse.json(
          { ok: false, detail: "accountId required" },
          { status: 400 }
        );
      }

      if (code === "") {
        const { error } = await service
          .from("accounts")
          .update({ acquired_source_kind: null, acquired_source_key: null })
          .eq("id", accountId);
        if (error) {
          return NextResponse.json(
            { ok: false, detail: error.message },
            { status: 500 }
          );
        }
        await logAudit(
          gate.userId,
          "set_attribution",
          { type: "account", id: accountId },
          { cleared: true },
          ip
        );
        return NextResponse.json({ ok: true });
      }

      if (!/^[a-z0-9-]{2,32}$/.test(code)) {
        return NextResponse.json(
          { ok: false, detail: "code: 2-32 chars, a-z 0-9 -" },
          { status: 400 }
        );
      }

      const { data: influencer } = await service
        .from("influencers")
        .select("id")
        .eq("code", code)
        .maybeSingle<{ id: string }>();

      if (!influencer) {
        return NextResponse.json(
          { ok: false, detail: `no influencer with code "${code}"` },
          { status: 404 }
        );
      }

      const { error } = await service
        .from("accounts")
        .update({ acquired_source_kind: "ref", acquired_source_key: code })
        .eq("id", accountId);

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "set_attribution",
        { type: "account", id: accountId },
        { code },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------- payouts

    case "record_payout": {
      const influencerId =
        typeof body.influencerId === "string" && UUID.test(body.influencerId)
          ? body.influencerId
          : null;
      const amountEur = Number(body.amountEur);
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 120)
          : null;

      if (!influencerId) {
        return NextResponse.json(
          { ok: false, reason: "invalid_input" },
          { status: 400 }
        );
      }
      if (!Number.isFinite(amountEur) || amountEur <= 0 || amountEur > 100000) {
        return NextResponse.json(
          { ok: false, detail: "amount must be 0.01-100000 EUR" },
          { status: 400 }
        );
      }

      const { error } = await service.from("influencer_payouts").insert({
        influencer_id: influencerId,
        amount_cents: Math.round(amountEur * 100),
        note,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, detail: error.message },
          { status: 500 }
        );
      }

      await logAudit(
        gate.userId,
        "record_payout",
        { type: "influencer", id: influencerId },
        { amount_cents: Math.round(amountEur * 100), note },
        ip
      );
      return NextResponse.json({ ok: true });
    }

    // ------------------------------------------------------ vouchers

    case "create_voucher": {
      const percentOff = Number(body.percentOff);
      const durationMonths = Number(body.durationMonths ?? 0);
      const code =
        typeof body.code === "string" && body.code.trim().length > 0
          ? body.code.trim().toUpperCase()
          : null;
      const maxRedemptions = Number(body.maxRedemptions ?? 0);

      if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
        return NextResponse.json(
          { ok: false, detail: "percentOff must be 1–100" },
          { status: 400 }
        );
      }
      if (code && !/^[A-Z0-9-]{3,32}$/.test(code)) {
        return NextResponse.json(
          { ok: false, detail: "code: 3–32 chars, A–Z 0–9 -" },
          { status: 400 }
        );
      }

      try {
        const { getStripe } = await import("@/lib/billing/stripe");
        const stripe = getStripe();

        const coupon = await stripe.coupons.create({
          percent_off: percentOff,
          ...(durationMonths === 0
            ? { duration: "forever" as const }
            : durationMonths === 1
              ? { duration: "once" as const }
              : {
                  duration: "repeating" as const,
                  duration_in_months: durationMonths,
                }),
          name: `MyTableView ${percentOff}% off${
            durationMonths === 0
              ? " forever"
              : durationMonths === 1
                ? " once"
                : ` for ${durationMonths} months`
          }`,
        });

        const promo = await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: coupon.id },
          ...(code ? { code } : {}),
          ...(maxRedemptions >= 1
            ? { max_redemptions: Math.min(maxRedemptions, 10000) }
            : {}),
        });

        await logAudit(
          gate.userId,
          "create_voucher",
          {},
          { code: promo.code, percent_off: percentOff, months: durationMonths },
          ip
        );
        return NextResponse.json({ ok: true, code: promo.code });
      } catch (stripeError) {
        const detail =
          stripeError instanceof Error ? stripeError.message : "stripe error";
        return NextResponse.json({ ok: false, detail }, { status: 500 });
      }
    }

    case "toggle_voucher": {
      const promoCodeId =
        typeof body.promoCodeId === "string" &&
        /^promo_[A-Za-z0-9]+$/.test(body.promoCodeId)
          ? body.promoCodeId
          : null;

      if (!promoCodeId || typeof body.active !== "boolean") {
        return NextResponse.json(
          { ok: false, detail: "promoCodeId and active required" },
          { status: 400 }
        );
      }

      try {
        const { getStripe } = await import("@/lib/billing/stripe");
        await getStripe().promotionCodes.update(promoCodeId, {
          active: body.active,
        });
        await logAudit(
          gate.userId,
          "toggle_voucher",
          { type: "promo_code" },
          { id: promoCodeId, active: body.active },
          ip
        );
        return NextResponse.json({ ok: true });
      } catch (stripeError) {
        const detail =
          stripeError instanceof Error ? stripeError.message : "stripe error";
        return NextResponse.json({ ok: false, detail }, { status: 500 });
      }
    }

    // -------------------------------------------------- mark posted

    case "mark_posted": {
      const groupId =
        typeof body.groupId === "string" && UUID.test(body.groupId) ? body.groupId : null;
      if (!groupId) {
        return NextResponse.json({ ok: false, detail: "groupId required" }, { status: 400 });
      }

      const { data: group } = await service
        .from("fb_groups")
        .select("id, name, campaign_id, step")
        .eq("id", groupId)
        .maybeSingle<{
          id: string;
          name: string;
          campaign_id: string | null;
          step: number;
        }>();

      if (!group?.campaign_id) {
        return NextResponse.json(
          { ok: false, detail: "group has no campaign assigned" },
          { status: 400 }
        );
      }

      const { data: promos } = await service
        .from("promos")
        .select("id, name")
        .eq("campaign_id", group.campaign_id)
        .order("position", { ascending: true })
        .returns<{ id: string; name: string }[]>();

      if (!promos || promos.length === 0) {
        return NextResponse.json(
          { ok: false, detail: "campaign has no promos" },
          { status: 400 }
        );
      }

      const index = ((group.step ?? 1) - 1) % promos.length;
      const promo = promos[index];

      const today = new Date().toISOString().slice(0, 10);
      const week = isoWeekLabel(new Date());

      const { data: post, error } = await service
        .from("posts")
        .insert({
          group_id: group.id,
          promo_id: promo.id,
          campaign_id: group.campaign_id,
          posted_at: today,
          week_label: week,
        })
        .select("id")
        .single<{ id: number }>();

      if (error || !post) {
        return NextResponse.json(
          { ok: false, detail: error?.message ?? "insert failed" },
          { status: 500 }
        );
      }

      const nextStep = (index + 1) % promos.length === 0 ? 1 : group.step + 1;
      await service
        .from("fb_groups")
        .update({ last_posted_at: today, step: nextStep })
        .eq("id", group.id);

      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";
      const trackLink = `${site}/?rmc=${post.id}`;

      await logAudit(
        gate.userId,
        "mark_posted",
        { type: "group", id: group.id },
        { promo: promo.name, post_id: post.id },
        ip
      );
      return NextResponse.json({ ok: true, postId: post.id, trackLink });
    }

    default:
      return NextResponse.json(
        { ok: false, detail: "unknown action" },
        { status: 400 }
      );
  }
}

/** ISO week label like 2026-W31. */
function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
