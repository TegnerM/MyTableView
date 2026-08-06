"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlan, type PlanKey } from "@/lib/billing/plans";
import { PlanPicker } from "@/components/staff/PlanPicker";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

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

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const openPortal = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) {
        setError(t.billing.somethingWrong);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError(t.billing.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  const planInfo = getPlan(plan);
  const subscribed = accountStatus === "active" || accountStatus === "past_due";

  const headline = subscribed
    ? `${t.billing.subscribed} — ${planInfo ? `${planInfo.label}, ${planInfo.priceLabel}` : t.billing.active} · ${t.billing.restaurantsUsed
        .replace("{count}", String(venueCount))
        .replace("{max}", String(maxVenues))}${accountStatus === "past_due" ? ` · ${t.billing.paymentProblem}` : ""}`
    : accountStatus === "canceled"
      ? t.billing.subscriptionEnded
      : trialDaysLeft !== null
        ? trialDaysLeft === 1
          ? t.billing.trialDayLeft
          : t.billing.trialDaysLeft.replace("{days}", String(trialDaysLeft))
        : t.billing.trialEnding;

  return (
    <section className="mtv-settings-card">
      <h2>{t.billing.title}</h2>
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
              {busy ? t.billing.opening : t.billing.manageBilling}
            </button>
          </div>
        ) : (
          <PlanPicker venueCount={venueCount} />
        )
      ) : (
        <p className="mtv-settings-help">{t.billing.onlyOwner}</p>
      )}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
      ) : null}

      {isOwner ? (
        <p className="mtv-settings-help">
          <Link href="/staff/add-venue" className="mtv-billing-link">
            {t.billing.addRestaurantLink}
          </Link>{" "}
          · {t.billing.tierNote}
        </p>
      ) : null}

      <p className="mtv-settings-help">
        {t.billing.needTags}{" "}
        <Link href="/staff/qr" className="mtv-billing-link">
          {t.billing.printQrLink}
        </Link>
        .
      </p>
    </section>
  );
}
