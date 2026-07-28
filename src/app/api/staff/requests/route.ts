import { NextResponse } from "next/server";
import {
  acknowledgeRequest,
  fulfilRequest,
  fulfilTableRequests,
  closeSessionManually,
  seatTable,
  setGuestCount,
} from "@/lib/staff/request-actions";
import {
  combineTables,
  uncombineTables,
} from "@/lib/staff/combine-tables";

/**
 * POST /api/staff/requests
 *
 * Every staff action on a request or session. Runs as the signed-in
 * staff member — RLS scopes it to their venue, and no venue ID is
 * accepted from the client.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  requestId?: unknown;
  sessionId?: unknown;
  tableId?: unknown;
  tableIds?: unknown;
  guestCount?: unknown;
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

  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "acknowledge": {
      if (typeof body.requestId !== "string") {
        return bad();
      }
      const result = await acknowledgeRequest(body.requestId);
      return respond(result);
    }

    case "fulfil": {
      if (typeof body.requestId !== "string") {
        return bad();
      }
      const result = await fulfilRequest(body.requestId);
      return respond(result);
    }

    case "fulfil_table": {
      if (typeof body.tableId !== "string") {
        return bad();
      }
      const result = await fulfilTableRequests(body.tableId);
      return respond(result);
    }

    case "seat_table": {
      if (typeof body.tableId !== "string") {
        return bad();
      }
      const result = await seatTable(body.tableId);
      return respond(result);
    }

    case "close_session": {
      if (typeof body.sessionId !== "string") {
        return bad();
      }
      const result = await closeSessionManually(body.sessionId);
      return respond(result);
    }

    case "set_guest_count": {
      if (typeof body.sessionId !== "string") {
        return bad();
      }
      const count =
        body.guestCount === null
          ? null
          : typeof body.guestCount === "number"
            ? body.guestCount
            : undefined;

      if (count === undefined) {
        return bad();
      }

      const result = await setGuestCount(body.sessionId, count);
      return respond(result);
    }

    case "combine": {
      if (
        !Array.isArray(body.tableIds) ||
        !body.tableIds.every((id) => typeof id === "string")
      ) {
        return bad();
      }
      const result = await combineTables(body.tableIds as string[]);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    case "uncombine": {
      if (typeof body.sessionId !== "string") {
        return bad();
      }
      const result = await uncombineTables(body.sessionId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    default:
      return bad();
  }
}

function bad() {
  return NextResponse.json(
    { ok: false, reason: "invalid_input" },
    { status: 400 }
  );
}

function respond(result: { ok: boolean; reason?: string }) {
  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }

  const status =
    result.reason === "not_staff" || result.reason === "not_signed_in"
      ? 401
      : result.reason === "not_found"
        ? 404
        : result.reason === "invalid_state"
          ? 409
          : 500;

  return NextResponse.json(result, { status });
}
