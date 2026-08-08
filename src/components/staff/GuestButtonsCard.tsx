"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";
import { pickLocale, type LocaleMap } from "@/lib/i18n/guest";

/**
 * Settings → Guest buttons. Every guest-facing request button with an
 * on/off switch. Off = hidden from the guest page instantly; nothing
 * is deleted. Works for all three editions — a hotel hides Late
 * check-out, a restaurant hides a button it never uses.
 */

export type GuestButtonRow = {
  id: string;
  code: string;
  label: LocaleMap;
  sublabel: LocaleMap;
  closesSession: boolean;
  active: boolean;
};

type Props = {
  rows: GuestButtonRow[];
  defaultLocale: string;
};

export function GuestButtonsCard({ rows, defaultLocale }: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // Optimistic switch state so the toggle answers the finger.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isOn = (row: GuestButtonRow) => overrides[row.id] ?? row.active;

  const toggle = async (row: GuestButtonRow) => {
    const next = !isOn(row);
    setBusy(row.id);
    setError(false);
    setOverrides((prev) => ({ ...prev, [row.id]: next }));
    try {
      const response = await fetch("/api/staff/request-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, active: next }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!response.ok || !payload?.ok) {
        setOverrides((prev) => ({ ...prev, [row.id]: !next }));
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setOverrides((prev) => ({ ...prev, [row.id]: !next }));
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const groups: { key: string; title: string; rows: GuestButtonRow[] }[] = [
    {
      key: "housekeeping",
      title: t.guestButtons.housekeeping,
      rows: rows.filter((row) => row.code.startsWith("hotel_hk_")),
    },
    {
      key: "service",
      title: t.guestButtons.service,
      rows: rows.filter(
        (row) => !row.code.startsWith("hotel_hk_") && !row.closesSession
      ),
    },
    {
      key: "bill",
      title: t.guestButtons.bill,
      rows: rows.filter((row) => row.closesSession),
    },
  ].filter((group) => group.rows.length > 0);

  return (
    <section className="mtv-settings-card">
      <h2>{t.guestButtons.title}</h2>
      <p className="mtv-settings-intro">{t.guestButtons.desc}</p>

      {groups.map((group) => (
        <div key={group.key} className="mtv-gb-group">
          <p className="mtv-gb-grouphead">{group.title}</p>
          {group.rows.map((row) => (
            <div key={row.id} className="mtv-gb-row">
              <span className="mtv-gb-text">
                <b>{pickLocale(row.label, locale, defaultLocale) || row.code}</b>
                {pickLocale(row.sublabel, locale, defaultLocale) ? (
                  <span>{pickLocale(row.sublabel, locale, defaultLocale)}</span>
                ) : null}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isOn(row)}
                className="mtv-gb-switch"
                data-on={isOn(row) ? "true" : "false"}
                disabled={busy === row.id}
                onClick={() => void toggle(row)}
              >
                <span className="mtv-gb-knob" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ))}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">
          {t.billing.error}
        </p>
      ) : null}
    </section>
  );
}
