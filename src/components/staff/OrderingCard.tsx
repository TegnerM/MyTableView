"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";
import { isTrialRunning } from "@/lib/billing/status";

/**
 * Settings → the Ordering module card. The owner's switch for the
 * €19-per-restaurant add-on, plus the venue's service-charge setting.
 */

type Props = {
  orderingActive: boolean;
  orderingLive: boolean;
  serviceChargePct: number;
  trialEndsAt: string | null;
  accountStatus: "none" | "active" | "past_due" | "canceled";
  isOwner: boolean;
};

export function OrderingCard({
  orderingActive,
  orderingLive,
  serviceChargePct,
  trialEndsAt,
  accountStatus,
  isOwner,
}: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(String(serviceChargePct));
  const [pctState, setPctState] = useState<"idle" | "saving" | "saved">("idle");

  const inTrial = isTrialRunning(trialEndsAt);
  const subscribed = accountStatus === "active" || accountStatus === "past_due";
  const canActivate = inTrial || subscribed;

  const toggle = async (enable: boolean) => {
    if (!enable && !window.confirm(t.billing.confirmDeactivate)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/ordering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(
          payload?.reason === "subscribe_first"
            ? t.billing.statusBlocked
            : t.billing.error
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t.billing.error);
    } finally {
      setBusy(false);
    }
  };

  const savePct = async () => {
    const value = Number.parseFloat(pct.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 20) {
      setError(t.billing.error);
      return;
    }
    setPctState("saving");
    setError(null);
    try {
      const response = await fetch("/api/billing/ordering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceChargePct: value }),
      });
      if (!response.ok) {
        setError(t.billing.error);
        setPctState("idle");
        return;
      }
      setPctState("saved");
      router.refresh();
    } catch {
      setError(t.billing.error);
      setPctState("idle");
    }
  };

  const statusLine = !orderingActive
    ? t.billing.statusOff
    : orderingLive
      ? inTrial
        ? t.billing.statusTrial
        : t.billing.statusActive
      : t.billing.statusBlocked;

  return (
    <section className="mtv-settings-card">
      <h2>{t.billing.title}</h2>
      <p className="mtv-settings-intro">{t.billing.desc}</p>
      <p className="mtv-settings-help">{t.billing.price}</p>

      <p className="mtv-ordering-status" data-live={orderingLive ? "true" : "false"}>
        {statusLine}
      </p>

      {isOwner ? (
        <div className="mtv-billing-actions">
          {!orderingActive ? (
            <>
              <button
                type="button"
                className="mtv-btn mtv-btn-primary"
                disabled={busy || !canActivate}
                onClick={() => void toggle(true)}
              >
                {busy ? t.billing.working : t.billing.activate}
              </button>
              {subscribed && !inTrial ? (
                <span className="mtv-settings-help">{t.billing.prorationNote}</span>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="mtv-btn"
              disabled={busy}
              onClick={() => void toggle(false)}
            >
              {busy ? t.billing.working : t.billing.deactivate}
            </button>
          )}
        </div>
      ) : (
        <p className="mtv-settings-help">{t.billing.onlyOwner}</p>
      )}

      {orderingActive && isOwner ? (
        <div className="mtv-ordering-service">
          <label>
            <span>{t.billing.serviceCharge}</span>
            <input
              type="text"
              inputMode="decimal"
              value={pct}
              onChange={(event) => {
                setPct(event.target.value);
                setPctState("idle");
              }}
            />
          </label>
          <button
            type="button"
            className="mtv-btn mtv-btn-small"
            disabled={pctState === "saving"}
            onClick={() => void savePct()}
          >
            {pctState === "saving"
              ? t.billing.working
              : pctState === "saved"
                ? t.billing.saved
                : t.billing.save}
          </button>
          <p className="mtv-settings-help">{t.billing.serviceChargeHelp}</p>
        </div>
      ) : null}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
      ) : null}

      <p className="mtv-settings-help">
        <Link href="/staff/menu" className="mtv-billing-link">
          {t.billing.editMenu}
        </Link>{" "}
        ·{" "}
        <Link href="/staff/orders" className="mtv-billing-link">
          {t.billing.openBoard}
        </Link>
      </p>
    </section>
  );
}
