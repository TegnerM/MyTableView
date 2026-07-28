import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listMemberships, VENUE_COOKIE } from "@/lib/staff/venue-context";

/**
 * POST /api/staff/venue — switch which venue this device works as.
 *
 * The requested venue must be one of the caller's own memberships;
 * anything else is refused. The choice lives in an httpOnly cookie so
 * every server-rendered staff page and every staff action resolves the
 * same venue.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  let body: { venueId?: unknown };

  try {
    body = (await request.json()) as { venueId?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  if (typeof body.venueId !== "string") {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const memberships = await listMemberships();

  if (memberships.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "not_staff" },
      { status: 401 }
    );
  }

  const target = memberships.find((m) => m.venueId === body.venueId);

  if (!target) {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const store = await cookies();
  store.set(VENUE_COOKIE, target.venueId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR_SECONDS,
  });

  return NextResponse.json(
    { ok: true, venueId: target.venueId, venueName: target.venueName },
    { status: 200 }
  );
}
