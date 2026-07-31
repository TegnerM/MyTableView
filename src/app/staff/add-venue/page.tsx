import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { AddVenueForm } from "@/components/staff/AddVenueForm";
import { BrandMark } from "@/components/BrandMark";
import "../sign-in/sign-in.css";

/**
 * Add a restaurant to an existing account. Owners only — reached from
 * Settings → Billing and the sidebar's venue switcher. Each restaurant
 * added while unsubscribed starts its own 14-day trial (max 3 on
 * trial); subscribed accounts can fill their tier.
 */

export const dynamic = "force-dynamic";

export default async function AddVenuePage() {
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

        <h1 className="mtv-signin-title">Add a restaurant</h1>
        <p className="mtv-signin-sub">
          It gets its own floor, its own QR codes and its own 14-day free
          trial. You currently run {venueCount}{" "}
          {venueCount === 1 ? "restaurant" : "restaurants"}.
        </p>

        <AddVenueForm />

        <p className="mtv-signin-alt">
          <Link href="/staff/floor">Back to the floor</Link>
        </p>
      </div>
    </main>
  );
}
