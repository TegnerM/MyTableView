"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * Settings card: the venue's tags — which chip/QR is on which table —
 * with unassign for lost chips or re-sticking.
 */

export type TagRow = {
  tagId: string;
  printedRef: string | null;
  batch: string | null;
  status: string;
  tableLabel: string | null;
};

export function TagsCard({ rows, edition }: { rows: TagRow[]; edition?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale, edition);

  const unassign = async (tagId: string) => {
    if (!window.confirm(t.tags.confirmUnassign)) {
      return;
    }
    setBusy(tagId);
    setError(null);

    try {
      const response = await fetch("/api/staff/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unassign", tagId }),
      });

      if (!response.ok) {
        setError(t.tags.unassignFailed);
        return;
      }

      window.location.reload();
    } catch {
      setError(t.tags.unassignFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mtv-settings-card">
      <h2>{t.tags.title}</h2>
      <p className="mtv-settings-intro">
        {t.tags.intro}{" "}
        <Link href="/staff/qr" className="mtv-billing-link">
          {t.tags.printQrLink}
        </Link>
        .
      </p>

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
      ) : null}

      <table className="mtv-tags-table">
        <thead>
          <tr>
            <th>{t.tags.colTable}</th>
            <th>{t.tags.colTag}</th>
            <th>{t.tags.colType}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>{t.tags.noTags}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.tagId}>
                <td>{row.tableLabel ?? "—"}</td>
                <td>
                  <code>{row.printedRef ?? row.tagId.slice(0, 6)}</code>
                </td>
                <td>{row.batch === "qr-web" ? "QR" : "NFC"}</td>
                <td>
                  <button
                    type="button"
                    className="mtv-btn"
                    disabled={busy !== null}
                    onClick={() => void unassign(row.tagId)}
                  >
                    {busy === row.tagId ? "…" : t.tags.unassign}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
