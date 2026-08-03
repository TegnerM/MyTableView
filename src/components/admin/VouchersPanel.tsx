"use client";

import { useState } from "react";

/**
 * Vouchers — Stripe promotion codes managed from admin. Restaurants
 * type the code at checkout (the checkout already accepts promo
 * codes); Stripe does the discount math and counts redemptions.
 */

export type VoucherRow = {
  id: string;
  code: string;
  percentOff: number | null;
  durationLabel: string;
  redeemed: number;
  maxRedemptions: number | null;
  active: boolean;
  created: string;
};

export function VouchersPanel({ rows }: { rows: VoucherRow[] }) {
  const [percentOff, setPercentOff] = useState("50");
  const [duration, setDuration] = useState("3");
  const [code, setCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const act = async (body: object, key: string, reload = true) => {
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
      if (reload) window.location.reload();
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy — select the code manually.");
    }
  };

  return (
    <>
      <div className="mtv-admin-form">
        <input
          className="mtv-notes-input"
          type="number"
          min={1}
          max={100}
          value={percentOff}
          onChange={(e) => setPercentOff(e.target.value)}
          title="% off"
          style={{ maxWidth: "5.5rem" }}
        />
        <select
          className="mtv-notes-input"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={{ maxWidth: "11rem" }}
        >
          <option value="1">first payment only</option>
          <option value="3">3 months</option>
          <option value="6">6 months</option>
          <option value="12">12 months</option>
          <option value="0">forever</option>
        </select>
        <input
          className="mtv-notes-input"
          placeholder="code (optional, e.g. FRIENDS50)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={32}
          style={{ maxWidth: "13rem" }}
        />
        <input
          className="mtv-notes-input"
          type="number"
          min={1}
          placeholder="max uses"
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          style={{ maxWidth: "7rem" }}
        />
        <button
          type="button"
          className="mtv-admin-btn"
          disabled={busy !== null}
          onClick={() =>
            void act(
              {
                action: "create_voucher",
                percentOff: Number(percentOff),
                durationMonths: Number(duration),
                code: code.trim() || undefined,
                maxRedemptions: maxRedemptions
                  ? Number(maxRedemptions)
                  : undefined,
              },
              "create"
            )
          }
        >
          {busy === "create" ? "Creating…" : "Create voucher"}
        </button>
      </div>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Duration</th>
            <th>Redeemed</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7}>No vouchers yet.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} style={row.active ? {} : { opacity: 0.55 }}>
                <td>
                  <code className="mtv-cell-title">{row.code}</code>
                </td>
                <td>{row.percentOff !== null ? `${row.percentOff}% off` : "—"}</td>
                <td>{row.durationLabel}</td>
                <td>
                  {row.redeemed}
                  {row.maxRedemptions ? ` / ${row.maxRedemptions}` : ""}
                </td>
                <td>{row.created}</td>
                <td>
                  <span
                    className="mtv-chip-status"
                    data-tone={row.active ? "active" : "closed"}
                  >
                    {row.active ? "active" : "off"}
                  </span>
                </td>
                <td>
                  <div className="mtv-admin-actions">
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      onClick={() => void copy(row.code)}
                    >
                      {copied === row.code ? "Copied ✓" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(
                          {
                            action: "toggle_voucher",
                            promoCodeId: row.id,
                            active: !row.active,
                          },
                          `toggle-${row.id}`
                        )
                      }
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
