import { NextResponse } from "next/server";
import { placeGuestOrder } from "@/lib/guest/place-order";

/**
 * POST /api/guest/order
 * { tagId, lines: [{ itemId, quantity, optionIds }], note? }
 *
 * Guest-facing, unauthenticated by design (like /api/guest/request).
 * Everything is re-validated and re-priced server-side.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { tagId?: unknown; lines?: unknown; note?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_input" },
      { status: 400 }
    );
  }

  const result = await placeGuestOrder(
    typeof body.tagId === "string" ? body.tagId : "",
    body.lines,
    body.note
  );

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }

  const status =
    result.reason === "rate_limited"
      ? 429
      : result.reason === "error"
        ? 500
        : 400;

  return NextResponse.json(result, { status });
}
