import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  InfluencersPanel,
  type InfluencerRow,
} from "@/components/admin/InfluencersPanel";
import {
  CommissionsPanel,
  type CommissionRow,
} from "@/components/admin/CommissionsPanel";
import {
  computeReferredCommissions,
  formatEur,
  type ReferredAccountCommission,
} from "@/lib/admin/commissions";
import { getStripe } from "@/lib/billing/stripe";
import "../admin.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Influencer = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type Visit = { source_key: string };
type Account = {
  id: string;
  name: string;
  created_at: string;
  acquired_source_kind: string | null;
  acquired_source_key: string | null;
  stripe_customer_id: string | null;
  plan: string | null;
};

type PayoutRow = { influencer_id: string; amount_cents: number };

export default async function AdminInfluencersPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [influencersResult, visitsResult, accountsResult, payoutsResult] =
    await Promise.all([
    service
      .from("influencers")
      .select("id, name, code, active")
      .order("created_at", { ascending: true })
      .returns<Influencer[]>(),
    service
      .from("visits")
      .select("source_key")
      .eq("source_kind", "ref")
      .limit(50000)
      .returns<Visit[]>(),
    service
      .from("accounts")
      .select(
        "id, name, created_at, acquired_source_kind, acquired_source_key, stripe_customer_id, plan"
      )
      .eq("acquired_source_kind", "ref")
      .order("created_at", { ascending: false })
      .returns<Account[]>(),
    service
      .from("influencer_payouts")
      .select("influencer_id, amount_cents")
      .returns<PayoutRow[]>(),
  ]);

  const visitCounts = new Map<string, number>();
  for (const visit of visitsResult.data ?? []) {
    visitCounts.set(visit.source_key, (visitCounts.get(visit.source_key) ?? 0) + 1);
  }

  const signupCounts = new Map<string, number>();
  for (const account of accountsResult.data ?? []) {
    const key = account.acquired_source_key ?? "";
    signupCounts.set(key, (signupCounts.get(key) ?? 0) + 1);
  }

  const rows: InfluencerRow[] = (influencersResult.data ?? []).map((inf) => ({
    id: inf.id,
    name: inf.name,
    code: inf.code,
    active: inf.active,
    visits: visitCounts.get(inf.code) ?? 0,
    signups: signupCounts.get(inf.code) ?? 0,
  }));

  const referred = accountsResult.data ?? [];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";

  // Commission math — 50% of paid Stripe invoices in each referred
  // restaurant's first 90 paying days, capped at 3 months' plan value.
  let commissions: ReferredAccountCommission[] = [];
  let stripeError: string | null = null;
  try {
    commissions = await computeReferredCommissions(referred, getStripe());
  } catch (error) {
    stripeError = error instanceof Error ? error.message : "Stripe unavailable";
  }

  const paidOutByInfluencer = new Map<string, number>();
  for (const payout of payoutsResult.data ?? []) {
    paidOutByInfluencer.set(
      payout.influencer_id,
      (paidOutByInfluencer.get(payout.influencer_id) ?? 0) + payout.amount_cents
    );
  }

  const byCode = new Map<string, typeof commissions>();
  for (const commission of commissions) {
    const list = byCode.get(commission.influencerCode) ?? [];
    list.push(commission);
    byCode.set(commission.influencerCode, list);
  }

  const commissionRows: CommissionRow[] = (influencersResult.data ?? []).map(
    (inf) => {
      const accounts = byCode.get(inf.code) ?? [];
      return {
        influencerId: inf.id,
        name: inf.name,
        code: inf.code,
        referred: accounts.length,
        paying: accounts.filter((a) => a.paidInWindowCents > 0).length,
        earnedCents: accounts.reduce((sum, a) => sum + a.commissionCents, 0),
        paidOutCents: paidOutByInfluencer.get(inf.id) ?? 0,
      };
    }
  );

  const commissionByAccount = new Map(
    commissions.map((c) => [c.accountName + c.registeredAt, c])
  );

  return (
    <AdminShell active="influencers" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Influencers</h1>
        <p>
          Each link is remembered 30 days, first touch wins. Visits are
          deduped per visitor per day; pay on signups, not visits.
        </p>
      </header>

      <div className="mtv-admin-card">
        <InfluencersPanel rows={rows} siteUrl={site} />
      </div>

      <div className="mtv-admin-card" style={{ marginTop: "1rem" }}>
        <h2 className="mtv-admin-card-title">
          Commissions — 50% of the first 3 months
        </h2>
        {stripeError ? (
          <p className="mtv-admin-error">Stripe error: {stripeError}</p>
        ) : (
          <CommissionsPanel rows={commissionRows} />
        )}
      </div>

      <div className="mtv-admin-card" style={{ marginTop: "1rem" }}>
        <h2 className="mtv-admin-card-title">Referred signups</h2>
        <table className="mtv-admin-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Influencer</th>
              <th>Registered</th>
              <th>First payment</th>
              <th>Paid (first 3 mo)</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {referred.length === 0 ? (
              <tr>
                <td colSpan={6}>No referred signups yet.</td>
              </tr>
            ) : (
              referred.map((account, index) => {
                const c = commissionByAccount.get(
                  account.name + account.created_at
                );
                return (
                  <tr key={index}>
                    <td className="mtv-cell-title">{account.name}</td>
                    <td>{account.acquired_source_key}</td>
                    <td>{account.created_at.slice(0, 10)}</td>
                    <td>{c?.firstPaidAt ? c.firstPaidAt.slice(0, 10) : "—"}</td>
                    <td>{c ? formatEur(c.paidInWindowCents) : "—"}</td>
                    <td>{c ? formatEur(c.commissionCents) : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
