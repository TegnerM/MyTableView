import { redirect } from "next/navigation";
import { getStaffIdentity, loadFloorState } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { LayoutEditor } from "@/components/staff/LayoutEditor";
import { TrialLocked } from "@/components/staff/TrialLocked";
import "./layout-editor.css";
import "../trial-locked.css";

/**
 * Floor layout editor.
 *
 * Managers and owners only — a waiter must not be able to rearrange the
 * floor mid-service.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffLayoutPage() {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  if (identity.role !== "owner" && identity.role !== "manager") {
    redirect("/staff/floor");
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

  const state = await loadFloorState(identity);

  return <LayoutEditor initialState={state} locale="en" />;
}
