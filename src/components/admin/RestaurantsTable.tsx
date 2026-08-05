"use client";

import { useState } from "react";

/**
 * The restaurants table with its admin actions. Buttons call
 * /api/admin/action, which independently re-verifies admin + 2FA on
 * every call — this component holds no authority.
 */

export type AdminVenueRow = {
  venueId: string;
  venueName: string;
  accountId: string;
  accountName: string;
  ownerEmail: string;
  createdAt: string;
  statusLabel: string;
  tone: "trial" | "active" | "locked" | "closed";
  venueStatus: string;
  lastActivity: string;
  notes: string;
  stripeCustomerId: string | null;
  /** Influencer code when acquired via ref; null otherwise. */
  referrerCode: string | null;
  /** Raw acquisition kind (ref / invite / rmc / utm / null). */
  acquiredVia: string | null;
};

export function RestaurantsTable({ rows }: { rows: AdminVenueRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.accountId, row.notes]))
  );
  const [referrers, setReferrers] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.map((row) => [row.accountId, row.referrerCode ?? ""])
    )
  );

  const act = async (body: object, key: string, reloadAfter = true) => {
    setBusy(key);
    setError(null);

    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setError(payload?.detail ?? "Action failed.");
        return;
      }

      if (reloadAfter) {
        window.location.reload();
      }
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const extendTrial = (row: AdminVenueRow) => {
    const input = window.prompt(
      `Extend trial for "${row.venueName}" — days from today:`,
      "14"
    );
    if (!input) return;
    const days = Number(input);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError("Days must be a whole number between 1 and 365.");
      return;
    }
    void act(
      { action: "extend_trial", venueId: row.venueId, days },
      `trial-${row.venueId}`
    );
  };

  const purge = (row: AdminVenueRow) => {
    const typed = window.prompt(
      `PERMANENTLY delete "${row.venueName}" and all its data — tables, sessions, requests, ratings, staff. This cannot be undone.\n\nType the restaurant's name to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== row.venueName) {
      setError("Name did not match — nothing was deleted.");
      return;
    }
    void act(
      { action: "purge_venue", venueId: row.venueId, confirmName: typed.trim() },
      `purge-${row.venueId}`
    );
  };

  return (
    <>
      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Restaurant</th>
            <th>Owner</th>
            <th>Signed up</th>
            <th>Status</th>
            <th>Last activity</th>
            <th>Referrer</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.venueId}>
              <td>
                <span className="mtv-cell-title">{row.venueName}</span>
                <span className="mtv-cell-sub">{row.accountName}</span>
              </td>
              <td>{row.ownerEmail}</td>
              <td>{row.createdAt}</td>
              <td>
                <span className="mtv-chip-status" data-tone={row.tone}>
                  {row.statusLabel}
                </span>
              </td>
              <td>{row.lastActivity}</td>
              <td>
                {/* Influencer code, editable: settles "that one was
                    mine" claims after a verbal pitch. Blank = clear.
                    Non-ref acquisitions (invite/campaign) show their
                    kind and stay read-only here. */}
                {row.acquiredVia && row.acquiredVia !== "ref" ? (
                  <span className="mtv-cell-sub">{row.acquiredVia}</span>
                ) : (
                  <input
                    className="mtv-notes-input"
                    style={{ maxWidth: "7rem" }}
                    value={referrers[row.accountId] ?? ""}
                    onChange={(e) =>
                      setReferrers((prev) => ({
                        ...prev,
                        [row.accountId]: e.target.value.toLowerCase(),
                      }))
                    }
                    onBlur={() => {
                      const next = (referrers[row.accountId] ?? "").trim();
                      if (next === (row.referrerCode ?? "")) return;
                      void act(
                        {
                          action: "set_attribution",
                          accountId: row.accountId,
                          code: next,
                        },
                        `ref-${row.accountId}`
                      );
                    }}
                    placeholder="code…"
                  />
                )}
              </td>
              <td>
                <input
                  className="mtv-notes-input"
                  value={notes[row.accountId] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      [row.accountId]: e.target.value,
                    }))
                  }
                  onBlur={() =>
                    void act(
                      {
                        action: "save_note",
                        accountId: row.accountId,
                        note: notes[row.accountId] ?? "",
                      },
                      `note-${row.accountId}`,
                      false
                    )
                  }
                  placeholder="notes…"
                />
              </td>
              <td>
                <div className="mtv-admin-actions">
                  {row.venueStatus === "active" ? (
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          { action: "lock_venue", venueId: row.venueId },
                          `lock-${row.venueId}`
                        )
                      }
                    >
                      Lock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          { action: "unlock_venue", venueId: row.venueId },
                          `unlock-${row.venueId}`
                        )
                      }
                    >
                      Unlock
                    </button>
                  )}
                  <button
                    type="button"
                    className="mtv-admin-btn"
                    disabled={busy !== null}
                    onClick={() => extendTrial(row)}
                  >
                    Trial…
                  </button>
                  {row.stripeCustomerId ? (
                    <a
                      className="mtv-admin-btn"
                      href={`https://dashboard.stripe.com/customers/${row.stripeCustomerId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      Stripe
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="mtv-admin-btn"
                    data-tone="danger"
                    disabled={busy !== null}
                    onClick={() => purge(row)}
                  >
                    Purge…
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
