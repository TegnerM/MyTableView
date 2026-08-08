import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { loadBoardTickets } from "@/lib/staff/order-actions";
import { OrdersBoard } from "@/components/staff/OrdersBoard";
import { TrialLocked } from "@/components/staff/TrialLocked";
import "../floor/floor.css";
import "./orders.css";
import "../trial-locked.css";

/**
 * /staff/orders — the kitchen/bar station board. Every active role:
 * the kitchen iPad and the bar iPad sign in like any staff device and
 * pick their station on screen (remembered per device).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffOrdersPage() {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  const billing = await getVenueBilling(identity.venueId);

  if (billing.locked) {
    return (
      <TrialLocked
        venueName={identity.venueName}
        isOwner={identity.role === "owner"}
        reason={billing.lockReason}
        venueCount={identity.venues?.length ?? 1}
      />
    );
  }

  const tickets = await loadBoardTickets(identity.venueId);

  return (
    <OrdersBoard
      identity={identity}
      initialTickets={tickets}
      initialNow={Date.now()}
    />
  );
}
