import { NextResponse } from "next/server";
import { createGuestRequest } from "@/lib/guest/create-request";

/**
 * POST /api/guest/request
 *
 * The only write a guest can make. Runs on the server with the
 * service-role client; the browser never talks to Postgres directly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tagId?: unknown;
  requestTypeId?: unknown;
  note?: unknown;
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
  const requestTypeId =
    typeof body.requestTypeId === "string" ? body.requestTypeId : "";
  const note = typeof body.note === "string" ? body.note : undefined;

  const result = await createGuestRequest(tagId, requestTypeId, note);

  if (result.ok) {
    return NextResponse.json(result, { status: 201 });
  }

  const status = statusFor(result.reason);
  return NextResponse.json(result, { status });
}

function statusFor(reason: string): number {
  switch (reason) {
    case "invalid_input":
      return 400;
    case "unknown_tag":
    case "tag_not_assigned":
    case "unknown_request_type":
      return 404;
    case "venue_unavailable":
    case "no_open_session":
      return 409;
    case "duplicate":
      // Not an error from the guest's point of view: what they asked for
      // is already on its way.
      return 200;
    case "rate_limited":
      return 429;
    default:
      return 500;
  }
}
