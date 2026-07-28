import { redirect } from "next/navigation";
import { getStaffIdentity, loadFloorState } from "@/lib/staff/floor-state";
import { LayoutEditor } from "@/components/staff/LayoutEditor";
import "./layout-editor.css";

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

  const state = await loadFloorState(identity);

  return <LayoutEditor initialState={state} locale="en" />;
}
