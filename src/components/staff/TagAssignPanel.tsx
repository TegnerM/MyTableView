"use client";

import { useEffect, useState } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/**
 * Tap-to-assign: shown when an owner/manager opens an UNASSIGNED tag's
 * URL (i.e. taps a fresh chip with their own phone). Pick a table, the
 * tag goes live, and the page reloads into the real guest view of that
 * table — instant proof it worked.
 */

type TableOption = { id: string; label: string };

type Props = {
  tagId: string;
  venueName: string;
  tables: TableOption[];
};

export function TagAssignPanel({ tagId, venueName, tables }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const assign = async (table: TableOption) => {
    setBusy(table.id);
    setError(null);

    try {
      const response = await fetch("/api/staff/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", tagId, tableId: table.id }),
      });

      if (!response.ok) {
        setError(t.tags.assignFailed);
        return;
      }

      setDone(table.label);
      // Reload into the live guest page for this table — the proof.
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setError(t.tags.assignFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mtv-tagassign">
      <div className="mtv-tagassign-card">
        <p className="mtv-tagassign-brand">
          mytable<span>view</span>
        </p>

        {done ? (
          <>
            <h1>{t.tags.assignedTitle.replace("{label}", done)}</h1>
            <p className="mtv-tagassign-sub">{t.tags.loadingGuestPage}</p>
          </>
        ) : (
          <>
            <h1>{t.tags.newTagTitle}</h1>
            <p className="mtv-tagassign-sub">
              {t.tags.newTagBefore} <strong>{venueName}</strong>
              {t.tags.newTagAfter}
            </p>

            <div className="mtv-tagassign-grid">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className="mtv-tagassign-table"
                  disabled={busy !== null}
                  onClick={() => void assign(table)}
                >
                  {busy === table.id ? "…" : table.label}
                </button>
              ))}
            </div>

            {tables.length === 0 ? (
              <p className="mtv-tagassign-sub">{t.tags.noTablesYet}</p>
            ) : null}

            {error ? <p className="mtv-tagassign-error">{error}</p> : null}

            <p className="mtv-tagassign-note">{t.tags.wrongRestaurant}</p>
          </>
        )}
      </div>
    </main>
  );
}
