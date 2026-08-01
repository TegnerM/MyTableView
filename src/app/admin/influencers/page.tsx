import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  InfluencersPanel,
  type InfluencerRow,
} from "@/components/admin/InfluencersPanel";
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
  name: string;
  created_at: string;
  acquired_source_kind: string | null;
  acquired_source_key: string | null;
};

export default async function AdminInfluencersPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [influencersResult, visitsResult, accountsResult] = await Promise.all([
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
      .select("name, created_at, acquired_source_kind, acquired_source_key")
      .eq("acquired_source_kind", "ref")
      .order("created_at", { ascending: false })
      .returns<Account[]>(),
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
        <h2 className="mtv-admin-card-title">Referred signups</h2>
        <table className="mtv-admin-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Influencer</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {referred.length === 0 ? (
              <tr>
                <td colSpan={3}>No referred signups yet.</td>
              </tr>
            ) : (
              referred.map((account, index) => (
                <tr key={index}>
                  <td className="mtv-cell-title">{account.name}</td>
                  <td>{account.acquired_source_key}</td>
                  <td>{account.created_at.slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
