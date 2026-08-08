import { NextResponse } from "next/server";
import {
  startTicket,
  readyTicket,
  deliverTicket,
  cancelTicket,
} from "@/lib/staff/order-actions";

/**
 * POST /api/staff/orders — ticket transitions from the Orders board.
 * Any active staff role: the kitchen iPad signs in like a waiter.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { action?: unknown; ticketId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad();
  }

  if (typeof body.ticketId !== "string") {
    return bad();
  }

  const action = typeof body.action === "string" ? body.action : "";

  const result =
    action === "start"
      ? await startTicket(body.ticketId)
      : action === "ready"
        ? await readyTicket(body.ticketId)
        : action === "delivered"
          ? await deliverTicket(body.ticketId)
          : action === "cancel"
            ? await cancelTicket(body.ticketId)
            : null;

  if (result === null) {
    return bad();
  }

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }

  const status =
    result.reason === "not_staff"
      ? 401
      : result.reason === "invalid_state"
        ? 409
        : result.reason === "not_found"
          ? 404
          : 500;

  return NextResponse.json(result, { status });
}

function bad() {
  return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
}
