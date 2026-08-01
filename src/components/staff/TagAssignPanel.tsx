"use client";

import { useState } from "react";

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
        setError("Could not assign the tag. Try again.");
        return;
      }

      setDone(table.label);
      // Reload into the live guest page for this table — the proof.
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setError("Could not assign the tag. Try again.");
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
            <h1>Tag assigned to Table {done} ✓</h1>
            <p className="mtv-tagassign-sub">
              Loading the guest page for this table…
            </p>
          </>
        ) : (
          <>
            <h1>New tag — assign it</h1>
            <p className="mtv-tagassign-sub">
              This tag isn&apos;t linked yet. Stick it on a table at{" "}
              <strong>{venueName}</strong>, then choose which one it is:
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
              <p className="mtv-tagassign-sub">
                No tables yet — draw your floor in the layout editor first.
              </p>
            ) : null}

            {error ? <p className="mtv-tagassign-error">{error}</p> : null}

            <p className="mtv-tagassign-note">
              Wrong restaurant? Switch venue in the staff app first, then
              tap the tag again.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
