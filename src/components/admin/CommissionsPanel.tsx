"use client";

import { useState } from "react";

/**
 * Commissions — what each influencer has earned (50% of referred
 * restaurants' first 3 months, computed server-side from paid Stripe
 * invoices), what's been paid out, and what's still due. "Record
 * payout" appends to the payout ledger; due = earned − paid out.
 */

export type CommissionRow = {
  influencerId: string;
  name: string;
  code: string;
  referred: number;
  paying: number;
  earnedCents: number;
  paidOutCents: number;
};

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function CommissionsPanel({ rows }: { rows: CommissionRow[] }) {
  const [payoutFor, setPayoutFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = async (influencerId: string) => {
    const eurAmount = Number(amount);
    if (!Number.isFinite(eurAmount) || eurAmount <= 0) {
      setError("Enter the amount you paid, in euros.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payout",
          influencerId,
          amountEur: eurAmount,
          note: note.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setError(payload?.detail ?? "Could not record the payout.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not record the payout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Influencer</th>
            <th>Referred</th>
            <th>Paying</th>
            <th>Earned</th>
            <th>Paid out</th>
            <th>Due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7}>
                No influencers yet — create a link above and share it.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const due = row.earnedCents - row.paidOutCents;
              return (
                <tr key={row.influencerId}>
                  <td>
                    <span className="mtv-cell-title">{row.name}</span>{" "}
                    <code>{row.code}</code>
                  </td>
                  <td>{row.referred}</td>
                  <td>{row.paying}</td>
                  <td>{eur(row.earnedCents)}</td>
                  <td>{eur(row.paidOutCents)}</td>
                  <td>
                    <strong
                      style={due > 0 ? { color: "#b57c0b" } : undefined}
                    >
                      {eur(due)}
                    </strong>
                  </td>
                  <td>
                    {payoutFor === row.influencerId ? (
                      <div className="mtv-admin-actions">
                        <input
                          className="mtv-notes-input"
                          type="number"
                          min={0.01}
                          step="0.01"
                          placeholder="€"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          style={{ maxWidth: "6rem" }}
                        />
                        <input
                          className="mtv-notes-input"
                          placeholder="note (optional)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={120}
                          style={{ maxWidth: "10rem" }}
                        />
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          disabled={busy}
                          onClick={() => void record(row.influencerId)}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          onClick={() => {
                            setPayoutFor(null);
                            setAmount("");
                            setNote("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        onClick={() => {
                          setPayoutFor(row.influencerId);
                          setAmount(due > 0 ? (due / 100).toFixed(2) : "");
                          setNote("");
                          setError(null);
                        }}
                      >
                        Record payout
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </>
  );
}
