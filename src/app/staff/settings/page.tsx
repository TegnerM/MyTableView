import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { getServerClient } from "@/lib/supabase/server";
import { EscalationSettingsForm } from "@/components/staff/EscalationSettingsForm";
import { TurnSettingsForm } from "@/components/staff/TurnSettingsForm";
import { BillingCard } from "@/components/staff/BillingCard";
import { TrialLocked } from "@/components/staff/TrialLocked";
import { StaffShell } from "@/components/staff/StaffShell";
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
      "escalation_repeat_threshold, escalation_grace_seconds, turn_standard_minutes, turn_large_minutes, turn_large_party_size"
    )
    .eq("id", identity.venueId)
    .maybeSingle<{
      escalation_repeat_threshold: number;
      escalation_grace_seconds: number;
      turn_standard_minutes: number | null;
      turn_large_minutes: number | null;
      turn_large_party_size: number | null;
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
            <h1>Settings</h1>
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

        <EscalationSettingsForm current={current} />
        <TurnSettingsForm current={currentTurns} />
      </main>
    </StaffShell>
  );
}
