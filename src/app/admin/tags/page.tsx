import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  TagBatchesPanel,
  type BatchSummary,
} from "@/components/admin/TagBatchesPanel";
import "../admin.css";

/**
 * Tags — provisioning for physical NFC chips. Mint a batch of stock
 * IDs for a shop order, download the CSV, write the chips, post them;
 * the restaurant claims each chip with tap-to-assign.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type TagRow = { batch: string | null; status: string };

export default async function AdminTagsPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();
  const { data } = await service
    .from("tags")
    .select("batch, status")
    .limit(10000)
    .returns<TagRow[]>();

  const byBatch = new Map<string, { stock: number; assigned: number }>();
  for (const tag of data ?? []) {
    const key = tag.batch ?? "(no batch)";
    const entry = byBatch.get(key) ?? { stock: 0, assigned: 0 };
    if (tag.status === "stock") entry.stock += 1;
    if (tag.status === "active") entry.assigned += 1;
    byBatch.set(key, entry);
  }

  const batches: BatchSummary[] = Array.from(byBatch.entries())
    .map(([batch, counts]) => ({ batch, ...counts }))
    .sort((a, b) => a.batch.localeCompare(b.batch));

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mytableview.com";

  return (
    <AdminShell active="tags" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Tags</h1>
        <p>
          Mint stock IDs for a manufacturing run, download the CSV, write
          the chips, post them. Restaurants claim chips by tapping them.
        </p>
      </header>

      <div className="mtv-admin-card">
        <TagBatchesPanel batches={batches} siteUrl={site} />
      </div>
    </AdminShell>
  );
}
