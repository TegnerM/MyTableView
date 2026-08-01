import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  GroupsPanel,
  type GroupRow,
  type CampaignOption,
} from "@/components/admin/GroupsPanel";
import "../admin.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Group = {
  id: string;
  name: string;
  url: string | null;
  members: number | null;
  country: string | null;
  lang: string | null;
  campaign_id: string | null;
  step: number;
  freq_days: number;
  last_posted_at: string | null;
};

export default async function AdminGroupsPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [groupsResult, campaignsResult] = await Promise.all([
    service
      .from("fb_groups")
      .select(
        "id, name, url, members, country, lang, campaign_id, step, freq_days, last_posted_at"
      )
      .order("name", { ascending: true })
      .returns<Group[]>(),
    service
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: true })
      .returns<CampaignOption[]>(),
  ]);

  const campaigns = campaignsResult.data ?? [];
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));
  const today = new Date().toISOString().slice(0, 10);

  const rows: GroupRow[] = (groupsResult.data ?? []).map((group) => {
    const nextDue = group.last_posted_at
      ? new Date(
          Date.parse(group.last_posted_at) + group.freq_days * 86_400_000
        )
          .toISOString()
          .slice(0, 10)
      : today;

    return {
      id: group.id,
      name: group.name,
      url: group.url ?? "",
      members: group.members ?? 0,
      country: group.country ?? "",
      lang: group.lang ?? "",
      campaignId: group.campaign_id,
      campaignName: group.campaign_id
        ? (campaignNames.get(group.campaign_id) ?? null)
        : null,
      step: group.step,
      freqDays: group.freq_days,
      lastPostedAt: group.last_posted_at,
      nextDueAt: nextDue,
      overdue: nextDue < today,
    };
  });

  return (
    <AdminShell active="groups" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Groups</h1>
        <p>
          Every group carries its campaign, its step in the promo sequence,
          and how often you post there. Red due date = overdue.
        </p>
      </header>

      <div className="mtv-admin-card">
        <GroupsPanel rows={rows} campaigns={campaigns} />
      </div>
    </AdminShell>
  );
}
