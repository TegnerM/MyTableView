"use client";

import { useState } from "react";

/**
 * Post Now — the whole posting job in one place, per group: open the
 * group, copy the caption of whichever promo this group is due for,
 * mark posted, and get the post's unique tracking link to include.
 */

export type PostNowRow = {
  groupId: string;
  groupName: string;
  url: string;
  campaignName: string | null;
  step: number;
  dueLabel: "overdue" | "due" | "upcoming" | "posted-today" | "no-campaign";
  dueDate: string;
  promoName: string | null;
  caption: string;
  promoLink: string;
};

export function PostNowPanel({ rows }: { rows: PostNowRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [trackLinks, setTrackLinks] = useState<Record<string, string>>({});

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy — select the text manually.");
    }
  };

  const markPosted = async (row: PostNowRow) => {
    setBusy(row.groupId);
    setError(null);

    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_posted", groupId: row.groupId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        trackLink?: string;
        detail?: string;
      } | null;

      if (!response.ok || !payload?.trackLink) {
        setError(payload?.detail ?? "Could not mark as posted.");
        return;
      }

      setTrackLinks((prev) => ({ ...prev, [row.groupId]: payload.trackLink! }));
    } catch {
      setError("Could not mark as posted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Due</th>
            <th>Promo (up next)</th>
            <th>Caption</th>
            <th>Post &amp; get link</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                No groups with campaigns yet — set them up under Groups.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const track = trackLinks[row.groupId];
              return (
                <tr key={row.groupId}>
                  <td>
                    <span className="mtv-cell-title">{row.groupName}</span>
                    <span className="mtv-cell-sub">
                      {row.campaignName ?? "no campaign"} · step {row.step}
                      {row.url ? (
                        <>
                          {" · "}
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mtv-billing-link"
                          >
                            open ↗
                          </a>
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span
                      className="mtv-chip-status"
                      data-tone={
                        row.dueLabel === "overdue"
                          ? "locked"
                          : row.dueLabel === "due"
                            ? "trial"
                            : row.dueLabel === "posted-today"
                              ? "active"
                              : "closed"
                      }
                    >
                      {row.dueLabel === "overdue"
                        ? `overdue ${row.dueDate}`
                        : row.dueLabel === "due"
                          ? "due today"
                          : row.dueLabel === "posted-today"
                            ? "posted today"
                            : row.dueLabel === "no-campaign"
                              ? "no campaign"
                              : row.dueDate}
                    </span>
                  </td>
                  <td>{row.promoName ?? "—"}</td>
                  <td className="mtv-caption-cell">
                    {row.caption ? (
                      <>
                        {row.caption}
                        <div style={{ marginTop: "0.35rem" }}>
                          <button
                            type="button"
                            className="mtv-admin-btn"
                            onClick={() =>
                              void copy(
                                row.promoLink
                                  ? `${row.caption}\n${row.promoLink}`
                                  : row.caption,
                                `cap-${row.groupId}`
                              )
                            }
                          >
                            {copied === `cap-${row.groupId}`
                              ? "Copied ✓"
                              : "Copy caption"}
                          </button>
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {track ? (
                      <div>
                        <code style={{ fontSize: "0.71875rem", wordBreak: "break-all" }}>
                          {track}
                        </code>
                        <div style={{ marginTop: "0.35rem" }}>
                          <button
                            type="button"
                            className="mtv-admin-btn"
                            onClick={() => void copy(track, `trk-${row.groupId}`)}
                          >
                            {copied === `trk-${row.groupId}`
                              ? "Copied ✓"
                              : "Copy link"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        disabled={busy !== null || row.dueLabel === "no-campaign"}
                        onClick={() => void markPosted(row)}
                      >
                        {busy === row.groupId
                          ? "…"
                          : "Mark posted & get link"}
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
