"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * The trial-ended / subscription-cancelled wall.
 *
 * Rendered by every staff page in place of its content when billing is
 * locked. Data is kept, nothing is deleted — this screen's only job is
 * to say so and offer the owner a way back in. Non-owners get a calm
 * explanation instead of a checkout they can't complete.
 */

type Props = {
  venueName: string;
  isOwner: boolean;
  /** "trial" = trial ran out; "canceled" = subscription ended. */
  reason: "trial" | "canceled";
};

export function TrialLocked({ venueName, isOwner, reason }: Props) {
  const [busy, setBusy] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (plan: "monthly" | "yearly") => {
    setBusy(plan);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) {
        setError("Could not start checkout. Please try again.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setBusy(null);
    }
  };

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
            <div className="mtv-locked-plans">
              <button
                type="button"
                className="mtv-locked-plan"
                onClick={() => void checkout("monthly")}
                disabled={busy !== null}
              >
                {busy === "monthly" ? "Opening checkout…" : "Monthly"}
                <span>€49 / month</span>
              </button>
              <button
                type="button"
                className="mtv-locked-plan"
                data-variant="ghost"
                onClick={() => void checkout("yearly")}
                disabled={busy !== null}
              >
                {busy === "yearly" ? "Opening checkout…" : "Yearly"}
                <span>€490 / year — 2 months free</span>
              </button>
            </div>

            {error ? <p className="mtv-locked-error">{error}</p> : null}

            <p className="mtv-locked-note">
              Cancel anytime. Guest taps resume the moment payment completes.
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
