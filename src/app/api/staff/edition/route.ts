import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { applyEdition, EDITIONS } from "@/lib/edition";

/**
 * POST /api/staff/edition — switch a venue between editions.
 *
 * Owner only. The actual work lives in lib/edition.ts (shared with
 * signup, which creates bar venues born with the right defaults).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { edition?: unknown };
  try {
    body = (await request.json()) as { edition?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const edition = typeof body.edition === "string" ? body.edition : "";
  if (!EDITIONS.has(edition)) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  if (resolved.current.role !== "owner") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const applied = await applyEdition(resolved.current.venueId, edition);
  if (!applied) {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, edition });
}
