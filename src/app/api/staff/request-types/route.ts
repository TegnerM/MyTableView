import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import { translateToLocales } from "@/lib/menu/translate";

/**
 * POST /api/staff/request-types — the Guest buttons.
 *
 * Owner/manager only. Four actions:
 *   { id, active }                  — show/hide a button on the guest page
 *   { id, etaMinutes }              — set the taxi button's suggested
 *                                     pickup time (meta.etaMinutes);
 *                                     null clears it
 *   { create: { label, sublabel } } — add the owner's own button. The
 *                                     text is written in the venue's
 *                                     main language and best-effort
 *                                     machine-translated into the
 *                                     venue's other guest languages.
 *   { id, remove: true }            — delete a custom button (only
 *                                     custom_ codes can be deleted;
 *                                     built-ins only toggle)
 *
 * Nothing built-in is ever deleted; the hidden order-kind type (the
 * ordering module's plumbing) can never be touched from here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CUSTOM_BUTTONS = 12;
const MAX_LABEL_LENGTH = 48;
const MAX_SUBLABEL_LENGTH = 64;

type Body = {
  id?: unknown;
  active?: unknown;
  etaMinutes?: unknown;
  create?: unknown;
  remove?: unknown;
};

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

  // ---- create a custom button ----------------------------------------
  if (body.create !== undefined) {
    const create = body.create as { label?: unknown; sublabel?: unknown };
    const label =
      typeof create?.label === "string" ? create.label.trim() : "";
    const sublabel =
      typeof create?.sublabel === "string" ? create.sublabel.trim() : "";

    if (
      label.length < 2 ||
      label.length > MAX_LABEL_LENGTH ||
      sublabel.length > MAX_SUBLABEL_LENGTH
    ) {
      return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
    }

    const { data: venue, error: venueError } = await service
      .from("venues")
      .select("default_locale, locales")
      .eq("id", me.venueId)
      .maybeSingle<{ default_locale: string | null; locales: string[] | null }>();

    if (venueError) {
      console.error("request-types: venue load failed", venueError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    const { count, error: countError } = await service
      .from("request_types")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", me.venueId)
      .like("code", "custom\\_%");

    if (countError) {
      console.error("request-types: count failed", countError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_CUSTOM_BUTTONS) {
      return NextResponse.json({ ok: false, reason: "too_many" }, { status: 400 });
    }

    // The owner's text under the venue's main language; the machine
    // fills in the other guest languages. Best-effort — a translation
    // hiccup must never block the button.
    const primary = venue?.default_locale ?? "en";
    const targets = (venue?.locales ?? []).filter((code) => code !== primary);

    const labelMap: Record<string, string> = { [primary]: label };
    const sublabelMap: Record<string, string> = sublabel
      ? { [primary]: sublabel }
      : {};

    if (targets.length > 0) {
      Object.assign(labelMap, await translateToLocales(label, primary, targets));
      labelMap[primary] = label;
      if (sublabel) {
        Object.assign(
          sublabelMap,
          await translateToLocales(sublabel, primary, targets)
        );
        sublabelMap[primary] = sublabel;
      }
    }

    const { data: created, error: insertError } = await service
      .from("request_types")
      .insert({
        venue_id: me.venueId,
        code: `custom_${randomUUID().slice(0, 8)}`,
        kind: "signal",
        label: labelMap,
        sublabel: sublabelMap,
        icon: "star",
        closes_session: false,
        sort_order: 200,
        active: true,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertError || !created) {
      console.error("request-types: insert failed", insertError?.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 200 });
  }

  // ---- everything else needs an existing row -------------------------
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  type Row = {
    id: string;
    code: string;
    kind: string;
    meta?: Record<string, unknown> | null;
  };

  let row: Row | null = null;
  let metaAvailable = true;
  {
    const { data, error } = await service
      .from("request_types")
      .select("id, code, kind, meta")
      .eq("id", id)
      .eq("venue_id", me.venueId)
      .maybeSingle<Row>();

    if (error) {
      metaAvailable = false;
      // Pre-migration database (no meta column yet): the toggle must
      // keep working — retry without it.
      const { data: fallback, error: fallbackError } = await service
        .from("request_types")
        .select("id, code, kind")
        .eq("id", id)
        .eq("venue_id", me.venueId)
        .maybeSingle<Row>();

      if (fallbackError) {
        console.error("request-types: load failed", fallbackError.message);
        return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
      }
      row = fallback;
    } else {
      row = data;
    }
  }
  if (!row || row.kind === "order") {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  // ---- delete (custom buttons only) ----------------------------------
  if (body.remove === true) {
    if (!row.code.startsWith("custom_")) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const { error: deleteError } = await service
      .from("request_types")
      .delete()
      .eq("id", id)
      .eq("venue_id", me.venueId);

    if (deleteError) {
      console.error("request-types: delete failed", deleteError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ---- taxi pickup time ----------------------------------------------
  if (body.etaMinutes !== undefined) {
    if (!metaAvailable) {
      // The meta column doesn't exist yet — run the guest-options
      // migration; a blind write would 500 with a confusing message.
      return NextResponse.json(
        { ok: false, reason: "migration_required" },
        { status: 409 }
      );
    }
    let eta: number | null = null;
    if (body.etaMinutes !== null) {
      const value = Number(body.etaMinutes);
      if (!Number.isFinite(value) || value < 1 || value > 180) {
        return NextResponse.json(
          { ok: false, reason: "invalid_input" },
          { status: 400 }
        );
      }
      eta = Math.round(value);
    }

    const meta = { ...(row.meta ?? {}) };
    if (eta === null) {
      delete meta.etaMinutes;
    } else {
      meta.etaMinutes = eta;
    }

    const { error: metaError } = await service
      .from("request_types")
      .update({ meta })
      .eq("id", id)
      .eq("venue_id", me.venueId);

    if (metaError) {
      console.error("request-types: meta update failed", metaError.message);
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ---- show/hide toggle ----------------------------------------------
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const { error: updateError } = await service
    .from("request_types")
    .update({ active: body.active })
    .eq("id", id)
    .eq("venue_id", me.venueId);

  if (updateError) {
    console.error("request-types: update failed", updateError.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
