"use client";

import { useState } from "react";

/**
 * Team — the owner/manager crew panel on Settings.
 *
 * Invite by email (waiter for everyone with access here; manager only
 * when the viewer is the owner), see pending invites with copyable
 * links, remove people. All authority checks are re-enforced
 * server-side in /api/staff/team — this panel only mirrors them.
 */

export type TeamMemberRow = {
  staffId: string;
  displayName: string;
  role: "owner" | "manager" | "waiter";
  isSelf: boolean;
};

export type TeamInviteRow = {
  id: string;
  email: string;
  role: "waiter" | "manager";
  expiresAt: string;
  link: string;
};

type Props = {
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  viewerRole: "owner" | "manager";
};

export function TeamCard({ members, invites, viewerRole }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"waiter" | "manager">("waiter");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const call = async (body: object, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/staff/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        detail?: string;
        link?: string;
        emailSent?: boolean;
        emailConfigured?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.detail ?? "That didn't work. Please try again.");
        return null;
      }
      return payload;
    } catch {
      setError("That didn't work. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const payload = await call(
      { action: "invite", email, displayName: name, role },
      "invite"
    );
    if (!payload) return;

    if (payload.emailSent) {
      setNotice(`Invite emailed to ${email.trim()}.`);
      window.location.reload();
    } else if (payload.link) {
      // Email not configured or failed — surface the link for manual
      // sending rather than losing the invite.
      try {
        await navigator.clipboard.writeText(payload.link);
        setNotice(
          `Invite created and link copied — the email couldn't be sent automatically, so paste it to ${email.trim()} yourself.`
        );
      } catch {
        setNotice(`Invite created. Send this link yourself: ${payload.link}`);
      }
    }
    setEmail("");
    setName("");
  };

  const copy = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy — open the invite link manually.");
    }
  };

  const act = async (body: object, key: string) => {
    const payload = await call(body, key);
    if (payload) window.location.reload();
  };

  return (
    <section className="mtv-settings-card">
      <h2>Team</h2>
      <p className="mtv-settings-intro">
        Waiters see the live floor only. Managers also get Layout,
        Insights and Settings.
        {viewerRole === "owner" ? "" : " Only the owner can invite managers."}
      </p>

      <form className="mtv-team-form" onSubmit={(e) => void invite(e)}>
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value === "manager" ? "manager" : "waiter")}
        >
          <option value="waiter">Waiter</option>
          {viewerRole === "owner" ? (
            <option value="manager">Manager</option>
          ) : null}
        </select>
        <button type="submit" className="mtv-btn mtv-btn-primary" disabled={busy !== null}>
          {busy === "invite" ? "Inviting…" : "Invite"}
        </button>
      </form>

      {error ? <p className="mtv-settings-status-error">{error}</p> : null}
      {notice ? <p className="mtv-settings-status">{notice}</p> : null}

      <table className="mtv-tags-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.staffId}>
              <td>
                {member.displayName}
                {member.isSelf ? " (you)" : ""}
              </td>
              <td>{member.role}</td>
              <td>
                {member.role !== "owner" &&
                !member.isSelf &&
                (viewerRole === "owner" || member.role === "waiter") ? (
                  <button
                    type="button"
                    className="mtv-btn"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        { action: "remove", staffId: member.staffId },
                        `remove-${member.staffId}`
                      )
                    }
                  >
                    {busy === `remove-${member.staffId}` ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {invites.length > 0 ? (
        <>
          <h3 className="mtv-team-subhead">Pending invites</h3>
          <table className="mtv-tags-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inviteRow) => (
                <tr key={inviteRow.id}>
                  <td>{inviteRow.email}</td>
                  <td>{inviteRow.role}</td>
                  <td>{inviteRow.expiresAt.slice(0, 10)}</td>
                  <td>
                    <div className="mtv-team-actions">
                      <button
                        type="button"
                        className="mtv-btn"
                        onClick={() => void copy(inviteRow.link, inviteRow.id)}
                      >
                        {copied === inviteRow.id ? "Copied ✓" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        className="mtv-btn"
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            { action: "revoke", inviteId: inviteRow.id },
                            `revoke-${inviteRow.id}`
                          )
                        }
                      >
                        {busy === `revoke-${inviteRow.id}` ? "…" : "Revoke"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
