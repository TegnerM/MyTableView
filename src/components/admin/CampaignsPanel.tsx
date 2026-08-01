"use client";

import { useState } from "react";

/**
 * Campaign planner — campaigns hold an ordered sequence of promos
 * (name, caption, link). Groups walk this sequence step by step; Post
 * Now serves whichever promo a group is due for.
 */

export type PromoRow = {
  id: string;
  position: number;
  name: string;
  caption: string;
  link: string;
};

export type CampaignRow = {
  id: string;
  name: string;
  promos: PromoRow[];
};

export function CampaignsPanel({ campaigns }: { campaigns: CampaignRow[] }) {
  const [selected, setSelected] = useState<string>(campaigns[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState("");
  const [promoName, setPromoName] = useState("");
  const [promoCaption, setPromoCaption] = useState("");
  const [promoLink, setPromoLink] = useState("");
  const [editing, setEditing] = useState<PromoRow | null>(null);

  const campaign = campaigns.find((c) => c.id === selected) ?? null;

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
        return false;
      }
      if (reload) window.location.reload();
      return true;
    } catch {
      setError("Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mtv-admin-form">
        <select
          className="mtv-notes-input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ maxWidth: "16rem" }}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {campaign ? (
          <button
            type="button"
            className="mtv-admin-btn"
            data-tone="danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Delete campaign "${campaign.name}" and its promos? Groups keep their history.`
                )
              ) {
                void act({ action: "delete_campaign", campaignId: campaign.id });
              }
            }}
          >
            Delete campaign
          </button>
        ) : null}
        <span style={{ flex: 1 }} />
        <input
          className="mtv-notes-input"
          placeholder="new campaign name"
          value={newCampaign}
          onChange={(e) => setNewCampaign(e.target.value)}
          maxLength={80}
          style={{ maxWidth: "14rem" }}
        />
        <button
          type="button"
          className="mtv-admin-btn"
          disabled={busy || newCampaign.trim().length < 1}
          onClick={() =>
            void act({ action: "create_campaign", name: newCampaign.trim() })
          }
        >
          Add campaign
        </button>
      </div>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      {campaign ? (
        <>
          <table className="mtv-admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Promo</th>
                <th>Caption</th>
                <th>Link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaign.promos.length === 0 ? (
                <tr>
                  <td colSpan={5}>No promos yet — add the first below.</td>
                </tr>
              ) : (
                campaign.promos.map((promo, index) => (
                  <tr key={promo.id}>
                    <td>{index + 1}</td>
                    <td className="mtv-cell-title">{promo.name}</td>
                    <td className="mtv-caption-cell">{promo.caption}</td>
                    <td>
                      {promo.link ? (
                        <a
                          href={promo.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mtv-billing-link"
                        >
                          link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="mtv-admin-actions">
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              action: "move_promo",
                              promoId: promo.id,
                              dir: "up",
                            })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              action: "move_promo",
                              promoId: promo.id,
                              dir: "down",
                            })
                          }
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="mtv-admin-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditing(promo);
                            setPromoName(promo.name);
                            setPromoCaption(promo.caption);
                            setPromoLink(promo.link);
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
                            if (window.confirm(`Delete promo "${promo.name}"?`)) {
                              void act({
                                action: "delete_promo",
                                promoId: promo.id,
                              });
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

          <h3 className="mtv-admin-card-title" style={{ marginTop: "1.25rem" }}>
            {editing ? `Edit promo: ${editing.name}` : "Add promo"}
          </h3>
          <div className="mtv-admin-form" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <input
              className="mtv-notes-input"
              placeholder="promo name (e.g. Couples)"
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              maxLength={120}
            />
            <textarea
              className="mtv-notes-input"
              placeholder="caption — the text you'll paste into the group"
              value={promoCaption}
              onChange={(e) => setPromoCaption(e.target.value)}
              rows={3}
              maxLength={4000}
            />
            <input
              className="mtv-notes-input"
              placeholder="landing link with UTM (optional — the tracking link is generated at post time)"
              value={promoLink}
              onChange={(e) => setPromoLink(e.target.value)}
              maxLength={500}
            />
            <div className="mtv-admin-actions">
              <button
                type="button"
                className="mtv-admin-btn"
                disabled={busy || promoName.trim().length < 1}
                onClick={() =>
                  void act(
                    editing
                      ? {
                          action: "update_promo",
                          promoId: editing.id,
                          name: promoName.trim(),
                          caption: promoCaption,
                          link: promoLink.trim(),
                        }
                      : {
                          action: "create_promo",
                          campaignId: campaign.id,
                          name: promoName.trim(),
                          caption: promoCaption,
                          link: promoLink.trim(),
                        }
                  )
                }
              >
                {editing ? "Save changes" : "Add promo"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="mtv-admin-btn"
                  onClick={() => {
                    setEditing(null);
                    setPromoName("");
                    setPromoCaption("");
                    setPromoLink("");
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="mtv-kpi-sub">Create your first campaign above.</p>
      )}
    </>
  );
}
