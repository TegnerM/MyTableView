"use client";

import { useState } from "react";

/**
 * Personal invites: create with an optional custom trial, copy the
 * link (best for WhatsApp), or send a branded email via Resend.
 */

export type InviteRow = {
  id: string;
  token: string;
  email: string | null;
  note: string | null;
  trialDays: number;
  createdAt: string;
  acceptedAt: string | null;
  acceptedAccountName: string | null;
};

export function InvitesPanel({
  rows,
  siteUrl,
}: {
  rows: InviteRow[];
  siteUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [trialDays, setTrialDays] = useState("14");
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
          void act(
            {
              action: "create_invite",
              email: email.trim(),
              note: note.trim(),
              trialDays: Number(trialDays),
            },
            "create"
          );
        }}
      >
        <input
          className="mtv-notes-input"
          type="email"
          placeholder="owner email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
        />
        <input
          className="mtv-notes-input"
          placeholder="personal note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
        <input
          className="mtv-notes-input"
          type="number"
          min={1}
          max={365}
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          style={{ maxWidth: "5.5rem" }}
          title="Trial days"
        />
        <button
          type="submit"
          className="mtv-admin-btn"
          disabled={busy !== null}
        >
          Create invite
        </button>
      </form>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Invite</th>
            <th>Trial</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No invites yet.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const link = `${siteUrl}/staff/sign-up?invite=${row.token}`;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="mtv-cell-title">
                      {row.email ?? "link-only"}
                    </span>
                    {row.note ? (
                      <span className="mtv-cell-sub">{row.note}</span>
                    ) : null}
                  </td>
                  <td>{row.trialDays}d</td>
                  <td>{row.createdAt}</td>
                  <td>
                    {row.acceptedAt ? (
                      <span className="mtv-chip-status" data-tone="active">
                        accepted{row.acceptedAccountName ? ` · ${row.acceptedAccountName}` : ""}
                      </span>
                    ) : (
                      <span className="mtv-chip-status" data-tone="trial">
                        pending
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="mtv-admin-actions">
                      <button
                        type="button"
                        className="mtv-admin-btn"
                        onClick={() => void copy(link)}
                      >
                        {copied === link ? "Copied ✓" : "Copy link"}
                      </button>
                      {row.email && !row.acceptedAt ? (
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              { action: "email_invite", inviteId: row.id },
                              `mail-${row.id}`,
                              false
                            )
                          }
                        >
                          {busy === `mail-${row.id}` ? "Sending…" : "Email it"}
                        </button>
                      ) : null}
                    </div>
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
