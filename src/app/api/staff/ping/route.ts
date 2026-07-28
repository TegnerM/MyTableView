/**
 * GET /api/staff/ping
 *
 * Heartbeat target for the floor's connection watchdog. Touches
 * nothing — no auth, no database — because it answers one question
 * only: can this device reach our server right now? A guest request
 * travelling on the guest's own mobile data doesn't depend on the
 * venue's wifi, but the floor screen does, and a floor that has gone
 * quiet must be able to tell the difference between "calm service"
 * and "disconnected".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(null, { status: 204 });
}
