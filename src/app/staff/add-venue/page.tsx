import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { AddVenueForm } from "@/components/staff/AddVenueForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import "../sign-in/sign-in.css";

/**
 * Add a restaurant to an existing account. Owners only — reached from
 * Settings → Billing and the sidebar's venue switcher. Each restaurant
 * added while unsubscribed starts its own 14-day trial (max 3 on
 * trial); subscribed accounts can fill their tier.
 */

export const dynamic = "force-dynamic";

export default async function AddVenuePage() {
  const store = await cookies();
  const headerList = await headers();
  const t = getStaffStrings(
    resolveStaffLocale(
      store.get(STAFF_LANG_COOKIE)?.value,
      headerList.get("accept-language")
    )
  );

  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  if (identity.role !== "owner") {
    redirect("/staff/floor");
  }

  const venueCount = identity.venues?.length ?? 1;

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">{t.venue.addTitle}</h1>
        <p className="mtv-signin-sub">
          {t.venue.addSub}{" "}
          {(venueCount === 1 ? t.venue.youRunOne : t.venue.youRunMany).replace(
            "{count}",
            String(venueCount)
          )}
        </p>

        <AddVenueForm />

        <p className="mtv-signin-alt">
          <Link href="/staff/floor">{t.venue.backToFloor}</Link>
        </p>
      </div>
    </main>
  );
}
