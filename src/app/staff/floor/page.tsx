import { redirect } from "next/navigation";
import { getStaffIdentity, loadFloorState } from "@/lib/staff/floor-state";
import { LiveFloor } from "@/components/staff/LiveFloor";
import "./floor.css";

/**
 * The staff floor view.
 *
 * Server-rendered so the first paint already has real state — a waiter
 * opening this mid-shift should not watch a spinner. Realtime takes
 * over from there.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffFloorPage() {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  const state = await loadFloorState(identity);

  // The clock is stamped ONCE, here, and handed to the client. Letting
  // the client component call Date.now() during render meant the server
  // HTML and the hydrating browser disagreed by a second ("30s" vs
  // "29s") and React reported a hydration mismatch on every load.
  return <LiveFloor initialState={state} locale="en" initialNow={Date.now()} />;
}
