import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity, loadFloorState } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { LiveFloor } from "@/components/staff/LiveFloor";
import { TrialLocked } from "@/components/staff/TrialLocked";
import { resolveStaffLocale, STAFF_LANG_COOKIE } from "@/lib/i18n/staff";
import "./floor.css";
import "../trial-locked.css";

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

  const store = await cookies();
  const headerList = await headers();
  const locale = resolveStaffLocale(
    store.get(STAFF_LANG_COOKIE)?.value,
    headerList.get("accept-language")
  );

  // The clock is stamped ONCE, here, and handed to the client. Letting
  // the client component call Date.now() during render meant the server
  // HTML and the hydrating browser disagreed by a second ("30s" vs
  // "29s") and React reported a hydration mismatch on every load.
  return (
    <LiveFloor initialState={state} locale={locale} initialNow={Date.now()} />
  );
}
