import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import "../admin.css";

/**
 * Post history — every marked post with the traffic its tracking link
 * drove (visits deduped per visitor/day) and the signups attributed to
 * it, plus per-campaign totals.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Post = {
  id: number;
  group_id: string;
  promo_id: string;
  campaign_id: string | null;
  posted_at: string;
  week_label: string | null;
};

type Named = { id: string; name: string };
type Visit = { source_key: string };
type Account = { acquired_source_key: string | null };

export default async function AdminHistoryPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [postsResult, groupsResult, promosResult, campaignsResult, visitsResult, accountsResult] =
    await Promise.all([
      service
        .from("posts")
        .select("id, group_id, promo_id, campaign_id, posted_at, week_label")
        .order("id", { ascending: false })
        .limit(500)
        .returns<Post[]>(),
      service.from("fb_groups").select("id, name").returns<Named[]>(),
      service.from("promos").select("id, name").returns<Named[]>(),
      service.from("campaigns").select("id, name").returns<Named[]>(),
      service
        .from("visits")
        .select("source_key")
        .eq("source_kind", "rmc")
        .limit(50000)
        .returns<Visit[]>(),
      service
        .from("accounts")
        .select("acquired_source_key")
        .eq("acquired_source_kind", "rmc")
        .returns<Account[]>(),
    ]);

  const groupNames = new Map((groupsResult.data ?? []).map((g) => [g.id, g.name]));
  const promoNames = new Map((promosResult.data ?? []).map((p) => [p.id, p.name]));
  const campaignNames = new Map(
    (campaignsResult.data ?? []).map((c) => [c.id, c.name])
  );

  const visitsByKey = new Map<string, number>();
  for (const visit of visitsResult.data ?? []) {
    visitsByKey.set(visit.source_key, (visitsByKey.get(visit.source_key) ?? 0) + 1);
  }
  const signupsByKey = new Map<string, number>();
  for (const account of accountsResult.data ?? []) {
    const key = account.acquired_source_key ?? "";
    signupsByKey.set(key, (signupsByKey.get(key) ?? 0) + 1);
  }

  const posts = postsResult.data ?? [];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";

  // Totals, overall and per campaign.
  let totalVisits = 0;
  let totalSignups = 0;
  const byCampaign = new Map<string, { visits: number; signups: number }>();
  for (const post of posts) {
    const key = String(post.id);
    const visits = visitsByKey.get(key) ?? 0;
    const signups = signupsByKey.get(key) ?? 0;
    totalVisits += visits;
    totalSignups += signups;
    if (post.campaign_id) {
      const entry = byCampaign.get(post.campaign_id) ?? { visits: 0, signups: 0 };
      entry.visits += visits;
      entry.signups += signups;
      byCampaign.set(post.campaign_id, entry);
    }
  }

  return (
    <AdminShell active="history" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Post history</h1>
        <p>
          Visits are landings from each post&apos;s tracking link, deduped per
          visitor per day. Signups are accounts whose first touch was that
          post.
        </p>
      </header>

      <div className="mtv-kpis">
        <div className="mtv-kpi">
          <p className="mtv-kpi-label">All campaigns</p>
          <p className="mtv-kpi-value">{totalVisits}</p>
          <p className="mtv-kpi-sub">{totalSignups} signups</p>
        </div>
        {Array.from(byCampaign.entries()).map(([campaignId, entry]) => (
          <div key={campaignId} className="mtv-kpi">
            <p className="mtv-kpi-label">
              {campaignNames.get(campaignId) ?? "campaign"}
            </p>
            <p className="mtv-kpi-value">{entry.visits}</p>
            <p className="mtv-kpi-sub">{entry.signups} signups</p>
          </div>
        ))}
      </div>

      <div className="mtv-admin-card">
        <table className="mtv-admin-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Promo</th>
              <th>Posted</th>
              <th>Week</th>
              <th>Visits</th>
              <th>Signups</th>
              <th>Track link</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={7}>Nothing posted yet.</td>
              </tr>
            ) : (
              posts.map((post) => {
                const key = String(post.id);
                return (
                  <tr key={post.id}>
                    <td className="mtv-cell-title">
                      {groupNames.get(post.group_id) ?? "—"}
                    </td>
                    <td>{promoNames.get(post.promo_id) ?? "—"}</td>
                    <td>{post.posted_at}</td>
                    <td>{post.week_label ?? "—"}</td>
                    <td>{visitsByKey.get(key) ?? 0}</td>
                    <td>{signupsByKey.get(key) ?? 0}</td>
                    <td>
                      <code style={{ fontSize: "0.71875rem" }}>
                        {site}/?rmc={post.id}
                      </code>
                    </td>
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
