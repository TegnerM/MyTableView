import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  PostNowPanel,
  type PostNowRow,
} from "@/components/admin/PostNowPanel";
import "../admin.css";

/**
 * Post Now — one place to run the whole posting job. Ordering puts
 * overdue first, then due today, then the rest by due date.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Group = {
  id: string;
  name: string;
  url: string | null;
  campaign_id: string | null;
  step: number;
  freq_days: number;
  last_posted_at: string | null;
};

type Campaign = { id: string; name: string };
type Promo = {
  id: string;
  campaign_id: string;
  position: number;
  name: string;
  caption: string | null;
  link: string | null;
};

export default async function AdminPostNowPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [groupsResult, campaignsResult, promosResult] = await Promise.all([
    service
      .from("fb_groups")
      .select("id, name, url, campaign_id, step, freq_days, last_posted_at")
      .order("name", { ascending: true })
      .returns<Group[]>(),
    service.from("campaigns").select("id, name").returns<Campaign[]>(),
    service
      .from("promos")
      .select("id, campaign_id, position, name, caption, link")
      .order("position", { ascending: true })
      .returns<Promo[]>(),
  ]);

  const campaignNames = new Map(
    (campaignsResult.data ?? []).map((c) => [c.id, c.name])
  );
  const promosByCampaign = new Map<string, Promo[]>();
  for (const promo of promosResult.data ?? []) {
    const list = promosByCampaign.get(promo.campaign_id) ?? [];
    list.push(promo);
    promosByCampaign.set(promo.campaign_id, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  let overdueCount = 0;
  let dueCount = 0;
  let postedToday = 0;

  const rows: PostNowRow[] = (groupsResult.data ?? []).map((group) => {
    const promos = group.campaign_id
      ? (promosByCampaign.get(group.campaign_id) ?? [])
      : [];
    const promo =
      promos.length > 0 ? promos[((group.step ?? 1) - 1) % promos.length] : null;

    const nextDue = group.last_posted_at
      ? new Date(
          Date.parse(group.last_posted_at) + group.freq_days * 86_400_000
        )
          .toISOString()
          .slice(0, 10)
      : today;

    let dueLabel: PostNowRow["dueLabel"];
    if (!group.campaign_id || !promo) {
      dueLabel = "no-campaign";
    } else if (group.last_posted_at === today) {
      dueLabel = "posted-today";
      postedToday += 1;
    } else if (nextDue < today) {
      dueLabel = "overdue";
      overdueCount += 1;
    } else if (nextDue === today) {
      dueLabel = "due";
      dueCount += 1;
    } else {
      dueLabel = "upcoming";
    }

    return {
      groupId: group.id,
      groupName: group.name,
      url: group.url ?? "",
      campaignName: group.campaign_id
        ? (campaignNames.get(group.campaign_id) ?? null)
        : null,
      step: group.step,
      dueLabel,
      dueDate: nextDue,
      promoName: promo?.name ?? null,
      caption: promo?.caption ?? "",
      promoLink: promo?.link ?? "",
    };
  });

  const order: Record<PostNowRow["dueLabel"], number> = {
    overdue: 0,
    due: 1,
    upcoming: 2,
    "posted-today": 3,
    "no-campaign": 4,
  };
  rows.sort(
    (a, b) => order[a.dueLabel] - order[b.dueLabel] || a.dueDate.localeCompare(b.dueDate)
  );

  const kpis = [
    { label: "Overdue", value: String(overdueCount) },
    { label: "Due today", value: String(dueCount) },
    { label: "Posted today", value: String(postedToday) },
  ];

  return (
    <AdminShell active="post" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Post Now</h1>
        <p>
          Copy the caption, open the group, paste, then Mark posted — the
          unique tracking link it returns is what you include in the post.
        </p>
      </header>

      <div className="mtv-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="mtv-kpi">
            <p className="mtv-kpi-label">{kpi.label}</p>
            <p className="mtv-kpi-value">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="mtv-admin-card">
        <PostNowPanel rows={rows} />
      </div>
    </AdminShell>
  );
}
