"use client";

import { useState } from "react";
import QRCode from "qrcode";

/**
 * Influencer links — create, toggle, copy, and read results. First
 * touch wins, remembered 30 days (set by the visit beacon), so credit
 * follows whoever brought the visitor first.
 */

export type InfluencerRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  visits: number;
  signups: number;
};

export function InfluencersPanel({
  rows,
  siteUrl,
}: {
  rows: InfluencerRow[];
  siteUrl: string;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<{ code: string; dataUrl: string } | null>(null);

  const act = async (body: object, reload = true) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  // QR of the influencer's link, for in-person pitches: the influencer
  // shows the code, the restaurant scans, the ?ref cookie does the rest.
  const showQr = async (code: string, link: string) => {
    if (qr?.code === code) {
      setQr(null);
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 480,
        margin: 2,
        color: { dark: "#16293d", light: "#ffffff" },
      });
      setQr({ code, dataUrl });
    } catch {
      setError("Could not generate the QR code.");
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy — select the link text manually.");
    }
  };

  return (
    <>
      <form
        className="mtv-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "create_influencer", name, code });
        }}
      >
        <input
          className="mtv-notes-input"
          placeholder="Name (e.g. Emil)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
        <input
          className="mtv-notes-input"
          placeholder="code (e.g. emil)"
          value={code}
          onChange={(e) => setCode(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]{2,32}"
          maxLength={32}
          required
        />
        <button type="submit" className="mtv-admin-btn" disabled={busy}>
          Add influencer
        </button>
      </form>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Influencer</th>
            <th>Link</th>
            <th>Visits</th>
            <th>Signups</th>
            <th>Conversion</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>No influencers yet.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const link = `${siteUrl}/?ref=${row.code}`;
              return (
                <tr key={row.id} style={row.active ? {} : { opacity: 0.55 }}>
                  <td className="mtv-cell-title">{row.name}</td>
                  <td>
                    <code style={{ fontSize: "0.71875rem" }}>{link}</code>
                  </td>
                  <td>{row.visits}</td>
                  <td>{row.signups}</td>
                  <td>
                    {row.visits > 0
                      ? `${((row.signups / row.visits) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>
                    <div className="mtv-admin-actions">
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        onClick={() => void copy(link)}
                      >
                        {copied === link ? "Copied ✓" : "Copy"}
                      </button>
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        onClick={() => void showQr(row.code, link)}
                      >
                        {qr?.code === row.code ? "Hide QR" : "QR"}
                      </button>
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        disabled={busy}
                        onClick={() =>
                          void act({
                            action: "toggle_influencer",
                            influencerId: row.id,
                            active: !row.active,
                          })
                        }
                      >
                        {row.active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {qr ? (
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.dataUrl}
            alt={`QR link for ${qr.code}`}
            width={200}
            height={200}
            style={{
              border: "1px solid #e0dace",
              borderRadius: "0.6rem",
              background: "#fff",
            }}
          />
          <div>
            <p style={{ margin: "0 0 0.5rem", fontWeight: 650 }}>
              {qr.code}&apos;s pitch QR
            </p>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
              Send this to the influencer — a restaurant that scans it
              lands on the site with their credit attached for 30 days.
            </p>
            <a
              className="mtv-admin-btn"
              href={qr.dataUrl}
              download={`mytableview-${qr.code}-qr.png`}
            >
              Download PNG
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
