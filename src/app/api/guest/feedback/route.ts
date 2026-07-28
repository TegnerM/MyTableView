import { NextResponse } from "next/server";
import { saveSessionRating } from "@/lib/guest/save-rating";

/**
 * POST /api/guest/feedback
 *
 * The satisfaction rating asked at the bill. Like /api/guest/request,
 * this is a guarded server route over the service client — the guest's
 * browser never talks to Postgres.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tagId?: unknown;
  food?: unknown;
  service?: unknown;
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

  const tagId = typeof body.tagId === "string" ? body.tagId : "";
  const food = Number(body.food);
  const service = Number(body.service);

  const result = await saveSessionRating(tagId, food, service);

  if (result.ok) {
    return NextResponse.json(result, { status: 201 });
  }

  const status =
    result.reason === "invalid_input"
      ? 400
      : result.reason === "unknown_tag" || result.reason === "tag_not_assigned"
        ? 404
        : result.reason === "venue_unavailable" ||
            result.reason === "no_session"
          ? 409
          : 500;

  return NextResponse.json(result, { status });
}
