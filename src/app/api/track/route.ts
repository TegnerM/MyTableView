import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/track — the visit beacon (public).
 *
 * Fired once per landing-page load by TrackBeacon. Logs a visit row
 * with its source (?rmc= campaign post, ?ref= influencer, ?invite=,
 * utm_source, or organic) and sets the attribution cookies that
 * /api/signup later reads:
 *
 *   mtv-ref    30 days, FIRST touch — whoever brought the visitor
 *              first keeps the credit (Roamies rule).
 *   mtv-rmc    24 hours — campaign-post credit is same-visit.
 *   mtv-utm    30 days, first touch.
 *   mtv-invite 7 days.
 *
 * Dedupe: one row per visitor per day per source, enforced by a
 * unique index — reloading a link cannot inflate the count. The
 * visitor hash is salted ip+ua; no cookie, no personal data stored.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function cleanKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 64);
  return KEY_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export async function POST(request: Request) {
  let body: { path?: unknown; search?: unknown; referrer?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path =
    typeof body.path === "string" ? body.path.slice(0, 200) : "/";
  const search =
    typeof body.search === "string" ? body.search.slice(0, 500) : "";
  const referrer =
    typeof body.referrer === "string" ? body.referrer.slice(0, 300) : "";

  const params = new URLSearchParams(search.startsWith("?") ? search : "");
  const rmc = cleanKey(params.get("rmc"));
  const ref = cleanKey(params.get("ref"));
  const invite = cleanKey(params.get("invite"));
  const utm = cleanKey(params.get("utm_source"));

  let sourceKind: "rmc" | "ref" | "invite" | "utm" | "organic" = "organic";
  let sourceKey = "";

  if (rmc) {
    sourceKind = "rmc";
    sourceKey = rmc;
  } else if (ref) {
    sourceKind = "ref";
    sourceKey = ref;
  } else if (invite) {
    sourceKind = "invite";
    sourceKey = invite;
  } else if (utm) {
    sourceKind = "utm";
    sourceKey = utm;
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  const salt = process.env.TRACK_SALT ?? "mtv-track-1";

  const visitorHash = createHash("sha256")
    .update(`${salt}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);

  const service = getServiceClient();

  const { error } = await service.from("visits").upsert(
    {
      visitor_hash: visitorHash,
      source_kind: sourceKind,
      source_key: sourceKey,
      path,
      referrer,
      country,
    },
    {
      onConflict: "visitor_hash,visit_date,source_kind,source_key",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    // Tracking must never break the page; log and move on.
    console.error("track: insert failed", error.message);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  const cookieStore = request.headers.get("cookie") ?? "";

  const has = (name: string) => cookieStore.includes(`${name}=`);

  if (ref && !has("mtv-ref")) {
    response.cookies.set("mtv-ref", ref, {
      path: "/",
      maxAge: 30 * 86400,
      sameSite: "lax",
    });
  }
  if (rmc) {
    response.cookies.set("mtv-rmc", rmc, {
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    });
  }
  if (utm && !has("mtv-utm")) {
    response.cookies.set("mtv-utm", utm, {
      path: "/",
      maxAge: 30 * 86400,
      sameSite: "lax",
    });
  }
  if (invite) {
    response.cookies.set("mtv-invite", invite, {
      path: "/",
      maxAge: 7 * 86400,
      sameSite: "lax",
    });
  }

  return response;
}
