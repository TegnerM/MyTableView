"use client";

import { useState } from "react";
import Link from "next/link";
import { getPlan, type PlanKey } from "@/lib/billing/plans";
import { PlanPicker } from "@/components/staff/PlanPicker";

/**
 * The billing card on Settings — the owner's one place to see and act
 * on the account subscription while the venue is open (the locked
 * state has its own full-screen treatment in TrialLocked).
 */

type Props = {
  accountStatus: "none" | "active" | "past_due" | "canceled";
  plan: PlanKey | null;
  /** This venue's own trial days left (null = trial over or n/a). */
  trialDaysLeft: number | null;
  /** Venues on the account / the tier's limit. */
  venueCount: number;
  maxVenues: number;
  isOwner: boolean;
};

export function BillingCard({
  accountStatus,
  plan,
  trialDaysLeft,
  venueCount,
  maxVenues,
  isOwner,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) {
        setError("Something went wrong. Please try again.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const planInfo = getPlan(plan);
  const subscribed = accountStatus === "active" || accountStatus === "past_due";

  const headline = subscribed
    ? `Subscribed — ${planInfo ? `${planInfo.label}, ${planInfo.priceLabel}` : "active"} · ${venueCount}/${maxVenues} restaurants used${accountStatus === "past_due" ? " · payment problem, please update your card" : ""}`
    : accountStatus === "canceled"
      ? "Subscription ended — your data is safe"
      : trialDaysLeft !== null
        ? `Free trial — ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left for this restaurant`
        : "Free trial ending";

  return (
    <section className="mtv-settings-card">
      <h2>Billing</h2>
      <p className="mtv-settings-intro">{headline}</p>

      {isOwner ? (
        subscribed ? (
          <div className="mtv-billing-actions">
            <button
              type="button"
              className="mtv-btn"
              onClick={() => void openPortal()}
              disabled={busy}
            >
              {busy ? "Opening…" : "Manage billing / change tier"}
            </button>
          </div>
        ) : (
          <PlanPicker venueCount={venueCount} />
        )
      ) : (
        <p className="mtv-settings-help">Only the owner can change billing.</p>
      )}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
      ) : null}

      {isOwner ? (
        <p className="mtv-settings-help">
          <Link href="/staff/add-venue" className="mtv-billing-link">
            Add a restaurant
          </Link>{" "}
          · up to 3 on trial, then your tier's size.
        </p>
      ) : null}

      <p className="mtv-settings-help">
        Need tags on tables tonight?{" "}
        <Link href="/staff/qr" className="mtv-billing-link">
          Print your table QR codes
        </Link>
        .
      </p>
    </section>
  );
}
