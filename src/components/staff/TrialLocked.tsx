"use client";

import { BrandMark } from "@/components/BrandMark";
import { PlanPicker } from "@/components/staff/PlanPicker";
import { getBrowserClient } from "@/lib/supabase/browser";

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
};

export function TrialLocked({ venueName, isOwner, reason, venueCount }: Props) {
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
            ? "Your free trial has ended"
            : "Your subscription has ended"}
        </h1>

        <p className="mtv-locked-body">
          {isOwner
            ? `Everything ${venueName} set up — tables, layout, history and insights — is saved and waiting. Subscribe and the floor is live again in seconds.`
            : `${venueName}'s subscription needs attention. Ask the owner to reactivate it — nothing has been lost.`}
        </p>

        {isOwner ? (
          <>
            <PlanPicker venueCount={venueCount} />
            <p className="mtv-locked-note">
              One subscription covers all restaurants in its tier. Cancel
              anytime. Guest taps resume the moment payment completes.
            </p>
          </>
        ) : null}

        <button
          type="button"
          className="mtv-locked-signout"
          onClick={() => void signOut()}
        >
          Log out
        </button>
      </div>
    </main>
  );
}
