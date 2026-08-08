"use client";

import { useEffect, useState } from "react";
import { plansForAccount, type Plan, type PlanKey } from "@/lib/billing/plans";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * The tier picker — shared by the lock screen and the Settings billing
 * card. Shows only tiers big enough for the venues the account already
 * runs, grouped monthly/yearly by a toggle, and hands the chosen plan
 * to /api/billing/checkout.
 */

type Props = {
  venueCount: number;
  /** Account runs a hotel → show the bundle plans. */
  hasHotel?: boolean;
};

export function PlanPicker({ venueCount, hasHotel = false }: Props) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const plans = plansForAccount(venueCount, hasHotel).filter(
    (plan) => plan.interval === interval
  );

  const checkout = async (plan: Plan) => {
    setBusy(plan.key);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.key }),
      });

      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) {
        setError(t.billing.checkoutFailed);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError(t.billing.checkoutFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mtv-plans">
      <div className="mtv-plans-toggle" role="tablist" aria-label={t.billing.intervalAria}>
        <button
          type="button"
          role="tab"
          aria-selected={interval === "monthly"}
          data-active={interval === "monthly"}
          onClick={() => setInterval("monthly")}
        >
          {t.billing.monthly}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={interval === "yearly"}
          data-active={interval === "yearly"}
          onClick={() => setInterval("yearly")}
        >
          {t.billing.yearly}
        </button>
      </div>

      <div className="mtv-plans-list">
        {plans.map((plan) => (
          <button
            key={plan.key}
            type="button"
            className="mtv-plans-option"
            onClick={() => void checkout(plan)}
            disabled={busy !== null}
          >
            <span className="mtv-plans-label">{plan.label}</span>
            <span className="mtv-plans-price">
              {busy === plan.key ? t.billing.openingCheckout : plan.priceLabel}
            </span>
          </button>
        ))}
      </div>

      {error ? <p className="mtv-plans-error">{error}</p> : null}
    </div>
  );
}
