import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  CampaignsPanel,
  type CampaignRow,
  type PromoRow,
} from "@/components/admin/CampaignsPanel";
import "../admin.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
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

export default async function AdminCampaignsPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [campaignsResult, promosResult] = await Promise.all([
    service
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: true })
      .returns<Campaign[]>(),
    service
      .from("promos")
      .select("id, campaign_id, position, name, caption, link")
      .order("position", { ascending: true })
      .returns<Promo[]>(),
  ]);

  const promosByCampaign = new Map<string, PromoRow[]>();
  for (const promo of promosResult.data ?? []) {
    const list = promosByCampaign.get(promo.campaign_id) ?? [];
    list.push({
      id: promo.id,
      position: promo.position,
      name: promo.name,
      caption: promo.caption ?? "",
      link: promo.link ?? "",
    });
    promosByCampaign.set(promo.campaign_id, list);
  }

  const rows: CampaignRow[] = (campaignsResult.data ?? []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    promos: promosByCampaign.get(campaign.id) ?? [],
  }));

  return (
    <AdminShell active="campaigns" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Campaign planner</h1>
        <p>
          A campaign is an ordered sequence of promos. Each group walks the
          sequence at its own pace — Post Now always serves the right one.
        </p>
      </header>

      <div className="mtv-admin-card">
        <CampaignsPanel campaigns={rows} />
      </div>
    </AdminShell>
  );
}
