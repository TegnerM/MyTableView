"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";

/**
 * Settings → the Venue type card. Restaurant or Bar — same engine,
 * different guest surface. Owner only, like billing.
 */

type Props = {
  edition: string;
  isOwner: boolean;
};

export function EditionCard({ edition, isOwner }: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const options = [
    { key: "restaurant", label: t.edition.restaurant, note: t.edition.restaurantNote },
    { key: "bar", label: t.edition.bar, note: t.edition.barNote },
    { key: "hotel", label: t.edition.hotel, note: t.edition.hotelNote },
  ];

  const switchTo = async (next: string) => {
    const label =
      next === "bar"
        ? t.edition.bar
        : next === "hotel"
          ? t.edition.hotel
          : t.edition.restaurant;
    if (!window.confirm(t.edition.confirm.replace("{name}", label))) {
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/staff/edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition: next }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!response.ok || !payload?.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mtv-settings-card">
      <h2>{t.edition.title}</h2>
      <p className="mtv-settings-intro">{t.edition.desc}</p>

      <div className="mtv-edition-options">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="mtv-edition-option"
            data-active={edition === option.key ? "true" : "false"}
            disabled={busy || !isOwner || edition === option.key}
            onClick={() => void switchTo(option.key)}
          >
            <b>{option.label}</b>
            <span>{option.note}</span>
            {edition === option.key ? (
              <i className="mtv-edition-check" aria-hidden="true">
                ✓
              </i>
            ) : null}
          </button>
        ))}
      </div>

      {!isOwner ? (
        <p className="mtv-settings-help">{t.edition.onlyOwner}</p>
      ) : null}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">
          {t.billing.error}
        </p>
      ) : null}
    </section>
  );
}
