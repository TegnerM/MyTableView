"use client";

import { useState } from "react";

/**
 * Facebook groups — each carries its campaign, its step in the promo
 * sequence, and a posting rhythm. "Posted" here is the quick path;
 * Post Now is the full workflow with captions and tracking links.
 */

export type GroupRow = {
  id: string;
  name: string;
  url: string;
  members: number;
  country: string;
  lang: string;
  campaignId: string | null;
  campaignName: string | null;
  step: number;
  freqDays: number;
  lastPostedAt: string | null;
  nextDueAt: string;
  overdue: boolean;
};

export type CampaignOption = { id: string; name: string };

const EMPTY = {
  name: "",
  url: "",
  members: "",
  country: "",
  lang: "English",
  campaignId: "",
  freqDays: "7",
};

export function GroupsPanel({
  rows,
  campaigns,
}: {
  rows: GroupRow[];
  campaigns: CampaignOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);

  const act = async (body: object) => {
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
      window.location.reload();
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const payload = {
      action: editingId ? "update_group" : "create_group",
      ...(editingId ? { groupId: editingId } : {}),
      name: form.name.trim(),
      url: form.url.trim(),
      members: Number(form.members) || 0,
      country: form.country.trim(),
      lang: form.lang.trim(),
      campaignId: form.campaignId || null,
      freqDays: Number(form.freqDays) || 7,
    };
    void act(payload);
  };

  return (
    <>
      <div className="mtv-admin-form">
        <input
          className="mtv-notes-input"
          placeholder="group name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={160}
        />
        <input
          className="mtv-notes-input"
          placeholder="facebook URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          maxLength={500}
        />
        <input
          className="mtv-notes-input"
          placeholder="members"
          type="number"
          value={form.members}
          onChange={(e) => setForm({ ...form, members: e.target.value })}
          style={{ maxWidth: "6.5rem" }}
        />
        <input
          className="mtv-notes-input"
          placeholder="language"
          value={form.lang}
          onChange={(e) => setForm({ ...form, lang: e.target.value })}
          style={{ maxWidth: "7rem" }}
        />
        <select
          className="mtv-notes-input"
          value={form.campaignId}
          onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
          style={{ maxWidth: "11rem" }}
        >
          <option value="">no campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="mtv-notes-input"
          type="number"
          min={1}
          max={90}
          title="days between posts"
          value={form.freqDays}
          onChange={(e) => setForm({ ...form, freqDays: e.target.value })}
          style={{ maxWidth: "5rem" }}
        />
        <button
          type="button"
          className="mtv-admin-btn"
          disabled={busy || form.name.trim().length < 1}
          onClick={submit}
        >
          {editingId ? "Save group" : "Add group"}
        </button>
        {editingId ? (
          <button
            type="button"
            className="mtv-admin-btn"
            onClick={() => {
              setEditingId(null);
              setForm({ ...EMPTY });
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Members</th>
            <th>Lang</th>
            <th>Campaign</th>
            <th>Step</th>
            <th>Freq</th>
            <th>Last posted</th>
            <th>Next due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9}>No groups yet.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="mtv-cell-title">{row.name}</span>
                  {row.url ? (
                    <a
                      className="mtv-cell-sub mtv-billing-link"
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open ↗
                    </a>
                  ) : null}
                </td>
                <td>{row.members ? row.members.toLocaleString() : "—"}</td>
                <td>{row.lang || "—"}</td>
                <td>{row.campaignName ?? "—"}</td>
                <td>{row.step}</td>
                <td>{row.freqDays}d</td>
                <td>{row.lastPostedAt ?? "never"}</td>
                <td>
                  <span
                    className="mtv-chip-status"
                    data-tone={row.overdue ? "locked" : "active"}
                  >
                    {row.nextDueAt}
                  </span>
                </td>
                <td>
                  <div className="mtv-admin-actions">
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      disabled={busy || !row.campaignId}
                      onClick={() =>
                        void act({ action: "mark_posted", groupId: row.id })
                      }
                    >
                      Posted
                    </button>
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(row.id);
                        setForm({
                          name: row.name,
                          url: row.url,
                          members: String(row.members || ""),
                          country: row.country,
                          lang: row.lang,
                          campaignId: row.campaignId ?? "",
                          freqDays: String(row.freqDays),
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="mtv-admin-btn"
                      data-tone="danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete group "${row.name}"?`)) {
                          void act({ action: "delete_group", groupId: row.id });
                        }
                      }}
                    >
                      Delete
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
