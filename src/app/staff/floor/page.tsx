import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity, loadFloorState } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { getServiceClient } from "@/lib/supabase/service";
import { LiveFloor } from "@/components/staff/LiveFloor";
import type { GetStartedSteps } from "@/components/staff/GetStarted";
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

  // Get-started card: owners only, and only until it's dismissed. The
  // steps are recomputed on every load, so the realtime refreshes the
  // floor already does tick them off live while the owner watches. The
  // tags/staff tables aren't exposed to staff through RLS (same as the
  // QR page), so the counts run on the service client — the venue ID
  // comes from the resolved identity, never the client.
  let getStarted: GetStartedSteps | null = null;

  if (identity.role === "owner") {
    try {
      const service = getServiceClient();
      const { data: venue, error: venueError } = await service
        .from("venues")
        .select("get_started_dismissed_at")
        .eq("id", identity.venueId)
        .maybeSingle<{ get_started_dismissed_at: string | null }>();

      // A missing column (migration not applied yet) fails closed: no
      // card rather than a broken floor.
      if (!venueError && venue && venue.get_started_dismissed_at === null) {
        const [tagsResult, requestsResult, staffResult] = await Promise.all([
          service
            .from("tags")
            .select("id", { count: "exact", head: true })
            .eq("venue_id", identity.venueId)
            .not("table_id", "is", null),
          service
            .from("requests")
            .select("id", { count: "exact", head: true })
            .eq("venue_id", identity.venueId),
          service
            .from("staff")
            .select("id", { count: "exact", head: true })
            .eq("venue_id", identity.venueId)
            .eq("active", true),
        ]);

        getStarted = {
          tables: state.tables.length > 0,
          codes: (tagsResult.count ?? 0) > 0,
          request: (requestsResult.count ?? 0) > 0,
          team: (staffResult.count ?? 0) > 1,
        };

        // All four done: the card has done its job. Stamp the dismissal
        // now so it renders complete exactly once and then never again.
        if (
          getStarted.tables &&
          getStarted.codes &&
          getStarted.request &&
          getStarted.team
        ) {
          await service
            .from("venues")
            .update({ get_started_dismissed_at: new Date().toISOString() })
            .eq("id", identity.venueId)
            .is("get_started_dismissed_at", null);
        }
      }
    } catch (error) {
      console.error(
        "get-started state failed",
        error instanceof Error ? error.message : error
      );
      getStarted = null;
    }
  }

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
    <LiveFloor
      initialState={state}
      locale={locale}
      initialNow={Date.now()}
      getStarted={getStarted}
    />
  );
}
