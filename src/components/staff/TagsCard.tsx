"use client";

import { useState } from "react";
import Link from "next/link";

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

export function TagsCard({ rows }: { rows: TagRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unassign = async (tagId: string) => {
    if (!window.confirm("Return this tag to stock? Guests can no longer use it until it's assigned again.")) {
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
        setError("Could not unassign the tag.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Could not unassign the tag.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mtv-settings-card">
      <h2>Table tags</h2>
      <p className="mtv-settings-intro">
        NFC chips and QR codes linked to your tables. To add a new chip:
        stick it on the table, tap it with your phone while signed in, and
        pick the table. Paper codes:{" "}
        <Link href="/staff/qr" className="mtv-billing-link">
          print QR codes
        </Link>
        .
      </p>

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">{error}</p>
      ) : null}

      <table className="mtv-tags-table">
        <thead>
          <tr>
            <th>Table</th>
            <th>Tag</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No tags yet.</td>
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
                    {busy === row.tagId ? "…" : "Unassign"}
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
