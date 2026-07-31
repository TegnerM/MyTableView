"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The billing card on Settings — the owner's one place to see and act
 * on the subscription while the venue is still open (the locked state
 * has its own full-screen treatment in TrialLocked).
 */

type Props = {
  status: "trialing" | "active" | "past_due" | "canceled";
  plan: "monthly" | "yearly" | null;
  trialDaysLeft: number | null;
  isOwner: boolean;
};

export function BillingCard({ status, plan, trialDaysLeft, isOwner }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const post = async (path: string, body?: object, label?: string) => {
    setBusy(label ?? path);
    setError(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) {
        setError("Something went wrong. Please try again.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const headline =
    status === "trialing"
      ? trialDaysLeft !== null && trialDaysLeft > 0
        ? `Free trial — ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left`
        : "Free trial ending"
      : status === "active"
        ? plan === "yearly"
          ? "Subscribed — yearly (€490/year)"
          : "Subscribed — monthly (€49/month)"
        : status === "past_due"
          ? "Payment problem — please update your card"
          : "Subscription ended";

  return (
    <section className="mtv-settings-card">
      <h2>Billing</h2>
      <p className="mtv-settings-intro">{headline}</p>

      {isOwner ? (
        <div className="mtv-billing-actions">
          {status === "trialing" || status === "canceled" ? (
            <>
              <button
                type="button"
                className="mtv-btn mtv-btn-primary"
                onClick={() =>
                  void post("/api/billing/checkout", { plan: "monthly" }, "m")
                }
                disabled={busy !== null}
              >
                {busy === "m" ? "Opening…" : "Subscribe monthly — €49"}
              </button>
              <button
                type="button"
                className="mtv-btn"
                onClick={() =>
                  void post("/api/billing/checkout", { plan: "yearly" }, "y")
                }
                disabled={busy !== null}
              >
                {busy === "y" ? "Opening…" : "Yearly — €490 (2 months free)"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="mtv-btn"
              onClick={() => void post("/api/billing/portal", undefined, "p")}
              disabled={busy !== null}
            >
              {busy === "p" ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      ) : (
        <p className="mtv-settings-help">
          Only the owner can change billing.
        </p>
      )}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
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
