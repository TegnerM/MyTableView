import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { resolveStaff } from "@/lib/staff/venue-context";
import { loadPropertyOverview } from "@/lib/staff/overview";
import { OverviewDashboard } from "@/components/staff/OverviewDashboard";
import { resolveStaffLocale, STAFF_LANG_COOKIE } from "@/lib/i18n/staff";
import "./overview.css";

/**
 * /staff/overview — the Property Overview.
 *
 * The screen every owner and manager lands on after signing in: one
 * card per venue with its live numbers, the property-wide strip,
 * what needs attention, and the cross-venue activity feed. The SAME
 * layout whether the account runs one restaurant or a hotel with
 * three venues — only the information varies.
 *
 * Waiters go straight to the floor: this screen is for whoever runs
 * the property.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffOverviewPage() {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }
  if (identity.role === "waiter") {
    redirect("/staff/floor");
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    redirect("/staff/sign-in");
  }

  const store = await cookies();
  const headerList = await headers();
  const locale = resolveStaffLocale(
    store.get(STAFF_LANG_COOKIE)?.value,
    headerList.get("accept-language")
  );

  // Only venues this person RUNS. Being a waiter somewhere else does
  // not put that venue's revenue on their dashboard.
  const memberships = resolved.memberships
    .filter((m) => m.role === "owner" || m.role === "manager")
    .map((m) => ({
      venueId: m.venueId,
      venueName: m.venueName,
      edition: m.edition,
    }));

  const overview = await loadPropertyOverview(memberships);

  return (
    <OverviewDashboard
      identity={identity}
      currentVenueId={identity.venueId}
      overview={overview}
      initialLocale={locale}
    />
  );
}
