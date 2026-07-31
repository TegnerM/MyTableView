import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import { isVenueLocked, trialDaysLeft } from "@/lib/billing/status";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

/**
 * Admin dashboard — the numbers Michael checks daily. All reads go
 * through the service client AFTER requireAdmin() has passed; nothing
 * here is reachable by anyone else (404, not 403).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type VenueRow = {
  id: string;
  created_at: string;
  trial_ends_at: string | null;
  accounts: { billing_status: string | null } | null;
};

type AccountRow = {
  billing_status: string;
  plan: string | null;
};

export default async function AdminDashboardPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [venuesResult, accountsResult] = await Promise.all([
    service
      .from("venues")
      .select("id, created_at, trial_ends_at, accounts:account_id ( billing_status )")
      .returns<VenueRow[]>(),
    service
      .from("accounts")
      .select("billing_status, plan")
      .returns<AccountRow[]>(),
  ]);

  const venues = venuesResult.data ?? [];
  const accounts = accountsResult.data ?? [];

  let trialing = 0;
  let covered = 0;
  let locked = 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  let newThisWeek = 0;

  for (const venue of venues) {
    const status = venue.accounts?.billing_status ?? "none";
    if (isVenueLocked(venue.trial_ends_at, status)) {
      locked += 1;
    } else if (status === "active" || status === "past_due") {
      covered += 1;
    } else if (trialDaysLeft(venue.trial_ends_at) !== null) {
      trialing += 1;
    } else {
      covered += 1; // long-trial grandfathered
    }
    if (Date.parse(venue.created_at) > weekAgo) {
      newThisWeek += 1;
    }
  }

  // MRR: monthly plans at face value, yearly divided by 12.
  let mrr = 0;
  let subscribedAccounts = 0;
  for (const account of accounts) {
    if (account.billing_status !== "active" || !account.plan) continue;
    const plan = getPlan(account.plan);
    if (!plan) continue;
    subscribedAccounts += 1;
    mrr += plan.interval === "monthly" ? plan.amount : plan.amount / 12;
  }

  const kpis = [
    { label: "Restaurants", value: String(venues.length), sub: `${newThisWeek} new this week` },
    { label: "On trial", value: String(trialing), sub: "own clock running" },
    { label: "Covered", value: String(covered), sub: "subscription or comped" },
    { label: "Locked", value: String(locked), sub: "trial over, unpaid" },
    { label: "Subscriptions", value: String(subscribedAccounts), sub: "paying accounts" },
    { label: "MRR", value: `€${Math.round(mrr)}`, sub: "yearly plans /12" },
  ];

  return (
    <AdminShell active="dashboard" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Dashboard</h1>
        <p>MyTableView at a glance.</p>
      </header>

      <div className="mtv-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="mtv-kpi">
            <p className="mtv-kpi-label">{kpi.label}</p>
            <p className="mtv-kpi-value">{kpi.value}</p>
            <p className="mtv-kpi-sub">{kpi.sub}</p>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
