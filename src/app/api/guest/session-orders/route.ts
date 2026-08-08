import { NextResponse } from "next/server";
import { allowHit, clientIpKey } from "@/lib/guest/rate-limit";
import { loadSessionOrders } from "@/lib/guest/session-orders";

/**
 * GET /api/guest/session-orders?tag=<tagId>
 *
 * The guest's own order status for their table — polled by the bar
 * home chip and the Order Status screen. Unauthenticated like every
 * guest endpoint; the tag is the capability.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Polled every 8s per guest — generous cap, same shield as the
  // request endpoint.
  if (!allowHit(`sord:${clientIpKey(request)}`, 30, 60_000)) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const result = await loadSessionOrders(url.searchParams.get("tag") ?? "");

  if (result.ok) {
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const status = result.reason === "error" ? 500 : 400;
  return NextResponse.json(result, { status });
}
