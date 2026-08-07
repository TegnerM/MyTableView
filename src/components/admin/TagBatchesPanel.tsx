"use client";

import { useState } from "react";

/**
 * Tag batches — mint stock NFC tag IDs for a manufacturing run.
 * Generate → the new IDs download as a CSV (ref, id, url) ready for
 * the NFC writing app; chips get written, posted, and claimed by the
 * restaurant with tap-to-assign.
 */

export type BatchSummary = {
  batch: string;
  stock: number;
  assigned: number;
};

type CreatedTag = { id: string; printed_ref: string | null };

export function TagBatchesPanel({
  batches,
  siteUrl,
}: {
  batches: BatchSummary[];
  siteUrl: string;
}) {
  const [batch, setBatch] = useState("");
  const [count, setCount] = useState("50");
  const [refPrefix, setRefPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTag[]>([]);

  const csvHref = () => {
    const lines = ["printed_ref,tag_id,url"].concat(
      created.map(
        (tag) => `${tag.printed_ref ?? ""},${tag.id},${siteUrl}/t/${tag.id}`
      )
    );
    return (
      "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"))
    );
  };

  const generate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_tag_batch",
          batch: batch.trim().toLowerCase(),
          count: Number(count),
          refPrefix: refPrefix.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        detail?: string;
        tags?: CreatedTag[];
      } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.detail ?? "Generation failed.");
        return;
      }
      setCreated(payload.tags ?? []);
    } catch {
      setError("Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="mtv-admin-form" onSubmit={(e) => void generate(e)}>
        <input
          className="mtv-notes-input"
          placeholder="batch (e.g. run-2026-08)"
          value={batch}
          onChange={(e) => setBatch(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]{2,40}"
          required
        />
        <input
          className="mtv-notes-input"
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          style={{ maxWidth: "6rem" }}
          title="How many tags"
        />
        <input
          className="mtv-notes-input"
          placeholder="ref prefix (e.g. A)"
          value={refPrefix}
          onChange={(e) => setRefPrefix(e.target.value.toUpperCase())}
          maxLength={8}
          style={{ maxWidth: "9rem" }}
        />
        <button type="submit" className="mtv-admin-btn" disabled={busy}>
          {busy ? "Generating…" : "Generate batch"}
        </button>
      </form>

      {error ? <p className="mtv-admin-error">{error}</p> : null}

      {created.length > 0 ? (
        <div style={{ margin: "0.75rem 0" }}>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 650 }}>
            {created.length} tags minted — write these to the chips:
          </p>
          <a
            className="mtv-admin-btn"
            href={csvHref()}
            download={`mytableview-tags-${batch || "batch"}.csv`}
          >
            Download CSV (ref, id, url)
          </a>
        </div>
      ) : null}

      <table className="mtv-admin-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>In stock</th>
            <th>Assigned</th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 ? (
            <tr>
              <td colSpan={3}>No batches yet.</td>
            </tr>
          ) : (
            batches.map((row) => (
              <tr key={row.batch}>
                <td className="mtv-cell-title">{row.batch}</td>
                <td>{row.stock}</td>
                <td>{row.assigned}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
