import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  InvitesPanel,
  type InviteRow,
} from "@/components/admin/InvitesPanel";
import "../admin.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Invite = {
  id: string;
  token: string;
  email: string | null;
  note: string | null;
  trial_days: number;
  created_at: string;
  accepted_at: string | null;
  accepted_account_id: string | null;
};

type Account = { id: string; name: string };

export default async function AdminInvitesPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();

  const [invitesResult, accountsResult] = await Promise.all([
    service
      .from("invites")
      .select(
        "id, token, email, note, trial_days, created_at, accepted_at, accepted_account_id"
      )
      .order("created_at", { ascending: false })
      .returns<Invite[]>(),
    service.from("accounts").select("id, name").returns<Account[]>(),
  ]);

  const accountNames = new Map<string, string>(
    (accountsResult.data ?? []).map((account) => [account.id, account.name])
  );

  const rows: InviteRow[] = (invitesResult.data ?? []).map((invite) => ({
    id: invite.id,
    token: invite.token,
    email: invite.email,
    note: invite.note,
    trialDays: invite.trial_days,
    createdAt: invite.created_at.slice(0, 10),
    acceptedAt: invite.accepted_at,
    acceptedAccountName: invite.accepted_account_id
      ? (accountNames.get(invite.accepted_account_id) ?? null)
      : null,
  }));

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytableview.com";

  return (
    <AdminShell active="invites" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Invites</h1>
        <p>
          Personal links for owners you know. Signups through an invite
          are attributed to it, get its trial length, and show as
          &quot;invite&quot; on the Traffic page.
        </p>
      </header>

      <div className="mtv-admin-card">
        <InvitesPanel rows={rows} siteUrl={site} />
      </div>
    </AdminShell>
  );
}
