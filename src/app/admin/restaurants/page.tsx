import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import { isVenueLocked, trialDaysLeft } from "@/lib/billing/status";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  RestaurantsTable,
  type AdminVenueRow,
} from "@/components/admin/RestaurantsTable";
import "../admin.css";

/**
 * The restaurants control table: every venue, its account, owner,
 * status, last guest activity, notes — and the destructive actions,
 * which run through /api/admin/action with their own re-verification.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type VenueRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  trial_ends_at: string | null;
  account_id: string;
};

type AccountRow = {
  id: string;
  name: string;
  billing_status: string;
  plan: string | null;
  max_venues: number;
  stripe_customer_id: string | null;
  admin_notes: string | null;
  owner_user_id: string | null;
};

type RequestRow = { venue_id: string; created_at: string };

export default async function AdminRestaurantsPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [venuesResult, accountsResult, requestsResult, usersResult] =
    await Promise.all([
      service
        .from("venues")
        .select("id, name, status, created_at, trial_ends_at, account_id")
        .order("created_at", { ascending: false })
        .returns<VenueRow[]>(),
      service
        .from("accounts")
        .select(
          "id, name, billing_status, plan, max_venues, stripe_customer_id, admin_notes, owner_user_id"
        )
        .returns<AccountRow[]>(),
      // Latest guest requests; first row per venue = last activity.
      service
        .from("requests")
        .select("venue_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000)
        .returns<RequestRow[]>(),
      service.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ]);

  const accounts = new Map<string, AccountRow>(
    (accountsResult.data ?? []).map((account) => [account.id, account])
  );

  const emailByUser = new Map<string, string>();
  for (const user of usersResult.data?.users ?? []) {
    if (user.email) emailByUser.set(user.id, user.email);
  }

  const lastActivity = new Map<string, string>();
  for (const request of requestsResult.data ?? []) {
    if (!lastActivity.has(request.venue_id)) {
      lastActivity.set(request.venue_id, request.created_at);
    }
  }

  const rows: AdminVenueRow[] = (venuesResult.data ?? []).map((venue) => {
    const account = accounts.get(venue.account_id);
    const accountStatus = account?.billing_status ?? "none";
    const plan = getPlan(account?.plan);
    const daysLeft = trialDaysLeft(venue.trial_ends_at);
    const locked = isVenueLocked(venue.trial_ends_at, accountStatus);

    let tone: "trial" | "active" | "locked" | "closed";
    let statusLabel: string;

    if (venue.status !== "active") {
      tone = "closed";
      statusLabel = "closed";
    } else if (locked) {
      tone = "locked";
      statusLabel = "locked";
    } else if (accountStatus === "active" && plan) {
      tone = "active";
      statusLabel = plan.label;
    } else if (accountStatus === "active") {
      tone = "active";
      statusLabel = "comped";
    } else if (daysLeft !== null) {
      tone = "trial";
      statusLabel = `trial · ${daysLeft}d left`;
    } else {
      tone = "active";
      statusLabel = "grandfathered";
    }

    return {
      venueId: venue.id,
      venueName: venue.name,
      accountId: venue.account_id,
      accountName: account?.name ?? "",
      ownerEmail: account?.owner_user_id
        ? (emailByUser.get(account.owner_user_id) ?? "")
        : "",
      createdAt: venue.created_at.slice(0, 10),
      statusLabel,
      tone,
      venueStatus: venue.status,
      lastActivity: lastActivity.get(venue.id)?.slice(0, 10) ?? "never",
      notes: account?.admin_notes ?? "",
      stripeCustomerId: account?.stripe_customer_id ?? null,
    };
  });

  return (
    <AdminShell active="restaurants" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Restaurants</h1>
        <p>
          Lock stops guest taps and closes the floor to guests; purge is
          permanent and asks for the restaurant&apos;s name. Every action is
          audited.
        </p>
      </header>

      <div className="mtv-admin-card">
        <RestaurantsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
