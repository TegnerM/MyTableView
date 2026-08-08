import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { getServerClient } from "@/lib/supabase/server";
import { EscalationSettingsForm } from "@/components/staff/EscalationSettingsForm";
import { TurnSettingsForm } from "@/components/staff/TurnSettingsForm";
import { BillingCard } from "@/components/staff/BillingCard";
import { OrderingCard } from "@/components/staff/OrderingCard";
import { EditionCard } from "@/components/staff/EditionCard";
import { TagsCard, type TagRow } from "@/components/staff/TagsCard";
import {
  TeamCard,
  type TeamMemberRow,
  type TeamInviteRow,
} from "@/components/staff/TeamCard";
import { cookies, headers } from "next/headers";
import { TrialLocked } from "@/components/staff/TrialLocked";
import { StaffShell } from "@/components/staff/StaffShell";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import { getServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_ESCALATION_SETTINGS,
  DEFAULT_TURN_SETTINGS,
} from "@/lib/staff/floor-types";
import "../floor/floor.css";
import "./settings.css";
import "../trial-locked.css";

/**
 * Venue settings.
 *
 * Managers and owners only. A waiter cannot raise the threshold that
 * measures their own response times.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffSettingsPage() {
  const store = await cookies();
  const localeHeaders = await headers();
  const t = getStaffStrings(
    resolveStaffLocale(
      store.get(STAFF_LANG_COOKIE)?.value,
      localeHeaders.get("accept-language")
    )
  );

  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }

  if (identity.role !== "owner" && identity.role !== "manager") {
    redirect("/staff/floor");
  }

  const billing = await getVenueBilling(identity.venueId);

  if (billing.locked) {
    return (
      <TrialLocked
        venueName={identity.venueName}
        isOwner={identity.role === "owner"}
        reason={billing.lockReason}
        venueCount={identity.venues?.length ?? 1}
      />
    );
  }

  const supabase = await getServerClient();

  const { data } = await supabase
    .from("venues")
    .select(
      "escalation_repeat_threshold, escalation_grace_seconds, turn_standard_minutes, turn_large_minutes, turn_large_party_size, edition"
    )
    .eq("id", identity.venueId)
    .maybeSingle<{
      escalation_repeat_threshold: number;
      escalation_grace_seconds: number;
      turn_standard_minutes: number | null;
      turn_large_minutes: number | null;
      turn_large_party_size: number | null;
      edition: string | null;
    }>();

  const current = {
    repeatThreshold:
      data?.escalation_repeat_threshold ??
      DEFAULT_ESCALATION_SETTINGS.repeatThreshold,
    graceSeconds:
      data?.escalation_grace_seconds ??
      DEFAULT_ESCALATION_SETTINGS.graceSeconds,
  };

  const currentTurns = {
    standardMinutes:
      data?.turn_standard_minutes ?? DEFAULT_TURN_SETTINGS.standardMinutes,
    largeMinutes:
      data?.turn_large_minutes ?? DEFAULT_TURN_SETTINGS.largeMinutes,
    largePartySize:
      data?.turn_large_party_size ?? DEFAULT_TURN_SETTINGS.largePartySize,
  };

  // Tag list (service client: tags aren't exposed to staff via RLS;
  // the owner/manager gate above is the authorization).
  const service = getServiceClient();
  const [tagsResult, tablesResult, teamResult, invitesResult] =
    await Promise.all([
    service
      .from("tags")
      .select("id, printed_ref, batch, status, table_id")
      .eq("venue_id", identity.venueId)
      .not("status", "in", '("lost","retired")')
      .returns<
        {
          id: string;
          printed_ref: string | null;
          batch: string | null;
          status: string;
          table_id: string | null;
        }[]
      >(),
    service
      .from("tables")
      .select("id, label")
      .eq("venue_id", identity.venueId)
      .returns<{ id: string; label: string }[]>(),
    service
      .from("staff")
      .select("id, display_name, role")
      .eq("venue_id", identity.venueId)
      .eq("active", true)
      .returns<{ id: string; display_name: string; role: string }[]>(),
    service
      .from("staff_invites")
      .select("id, email, role, token, expires_at")
      .eq("venue_id", identity.venueId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .returns<
        {
          id: string;
          email: string;
          role: "waiter" | "manager";
          token: string;
          expires_at: string;
        }[]
      >(),
  ]);

  const labelByTable = new Map(
    (tablesResult.data ?? []).map((table) => [table.id, table.label])
  );

  const tagRows: TagRow[] = (tagsResult.data ?? [])
    .map((tag) => ({
      tagId: tag.id,
      printedRef: tag.printed_ref,
      batch: tag.batch,
      status: tag.status,
      tableLabel: tag.table_id
        ? (labelByTable.get(tag.table_id) ?? null)
        : null,
    }))
    .sort((a, b) => (a.tableLabel ?? "zz").localeCompare(b.tableLabel ?? "zz"));

  const roleRank = { owner: 0, manager: 1, waiter: 2 } as const;
  const teamMembers: TeamMemberRow[] = (teamResult.data ?? [])
    .map((row) => ({
      staffId: row.id,
      displayName: row.display_name,
      role: (row.role === "owner" || row.role === "manager"
        ? row.role
        : "waiter") as TeamMemberRow["role"],
      isSelf: row.id === identity.staffId,
    }))
    .sort(
      (a, b) =>
        roleRank[a.role] - roleRank[b.role] ||
        a.displayName.localeCompare(b.displayName)
    );

  // Invite links carry the site origin the OWNER is browsing on, so
  // preview deployments hand out preview links and production hands
  // out production links.
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "www.mytableview.com";
  const teamInvites: TeamInviteRow[] = (invitesResult.data ?? []).map(
    (row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
      link: `${proto}://${host}/staff/join?token=${row.token}`,
    })
  );

  return (
    <StaffShell
      active="settings"
      displayName={identity.displayName}
      role={identity.role}
      venueId={identity.venueId}
      venues={identity.venues}
    >
      <main className="mtv-settings">
        <header className="mtv-settings-header">
          <div>
            <h1>{t.shell.settings}</h1>
            <p>{identity.venueName}</p>
          </div>
        </header>

        <BillingCard
          accountStatus={billing.accountStatus}
          plan={billing.plan}
          trialDaysLeft={billing.trialDaysLeft}
          venueCount={identity.venues?.length ?? 1}
          maxVenues={billing.maxVenues}
          isOwner={identity.role === "owner"}
        />

        <OrderingCard
          orderingActive={billing.orderingActive}
          orderingLive={billing.orderingLive}
          serviceChargePct={billing.serviceChargePct}
          trialEndsAt={billing.trialEndsAt}
          accountStatus={billing.accountStatus}
          isOwner={identity.role === "owner"}
        />

        <EditionCard
          edition={data?.edition ?? "restaurant"}
          isOwner={identity.role === "owner"}
        />

        <TeamCard
          members={teamMembers}
          invites={teamInvites}
          viewerRole={identity.role === "owner" ? "owner" : "manager"}
        />

        <TagsCard rows={tagRows} />

        <EscalationSettingsForm current={current} />
        <TurnSettingsForm current={currentTurns} />
      </main>
    </StaffShell>
  );
}
