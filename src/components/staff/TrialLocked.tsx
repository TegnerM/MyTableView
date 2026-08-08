"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PlanPicker } from "@/components/staff/PlanPicker";
import { getBrowserClient } from "@/lib/supabase/browser";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * The trial-ended / subscription-cancelled wall.
 *
 * Rendered by every staff page in place of its content when the venue
 * is locked. Data is kept, nothing is deleted — this screen's only job
 * is to say so and offer the owner a way back in. Non-owners get a
 * calm explanation instead of a checkout they can't complete.
 */

type Props = {
  venueName: string;
  isOwner: boolean;
  /** "trial" = this venue's trial ran out; "canceled" = the account's
   *  subscription ended. */
  reason: "trial" | "canceled";
  /** Venues on the account — filters which tiers make sense. */
  venueCount: number;
  /** Account runs a hotel → show the bundle plans. */
  hasHotel?: boolean;
};

export function TrialLocked({ venueName, isOwner, reason, venueCount, hasHotel = false }: Props) {
  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const signOut = async () => {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/staff/sign-in";
  };

  return (
    <main className="mtv-locked">
      <div className="mtv-locked-card">
        <BrandMark className="mtv-brand mtv-locked-brand" />

        <h1>
          {reason === "trial"
            ? t.trial.trialEndedTitle
            : t.trial.subscriptionEndedTitle}
        </h1>

        <p className="mtv-locked-body">
          {isOwner
            ? t.trial.ownerBody.replace("{venue}", venueName)
            : t.trial.staffBody.replace("{venue}", venueName)}
        </p>

        {isOwner ? (
          <>
            <PlanPicker venueCount={venueCount} hasHotel={hasHotel} />
            <p className="mtv-locked-note">{t.trial.note}</p>
          </>
        ) : null}

        <button
          type="button"
          className="mtv-locked-signout"
          onClick={() => void signOut()}
        >
          {t.shell.logOut}
        </button>
      </div>
    </main>
  );
}
