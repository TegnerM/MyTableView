"use client";

import { useEffect, useState } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

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

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  const roleLabel = (value: "owner" | "manager" | "waiter") =>
    value === "owner"
      ? t.shell.roleOwner
      : value === "manager"
        ? t.shell.roleManager
        : t.shell.roleWaiter;

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
        setError(payload?.detail ?? t.team.genericError);
        return null;
      }
      return payload;
    } catch {
      setError(t.team.genericError);
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
      setNotice(t.team.inviteEmailed.replace("{email}", email.trim()));
      window.location.reload();
    } else if (payload.link) {
      // Email not configured or failed — surface the link for manual
      // sending rather than losing the invite.
      try {
        await navigator.clipboard.writeText(payload.link);
        setNotice(t.team.inviteCopied.replace("{email}", email.trim()));
      } catch {
        setNotice(t.team.inviteManual.replace("{link}", payload.link));
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
      setError(t.team.copyFailed);
    }
  };

  const act = async (body: object, key: string) => {
    const payload = await call(body, key);
    if (payload) window.location.reload();
  };

  return (
    <section className="mtv-settings-card">
      <h2>{t.team.title}</h2>
      <p className="mtv-settings-intro">
        {t.team.intro}
        {viewerRole === "owner" ? "" : ` ${t.team.onlyOwnerInvites}`}
      </p>

      <form className="mtv-team-form" onSubmit={(e) => void invite(e)}>
        <input
          type="text"
          placeholder={t.team.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <input
          type="email"
          placeholder={t.team.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value === "manager" ? "manager" : "waiter")}
        >
          <option value="waiter">{t.team.waiter}</option>
          {viewerRole === "owner" ? (
            <option value="manager">{t.team.manager}</option>
          ) : null}
        </select>
        <button type="submit" className="mtv-btn mtv-btn-primary" disabled={busy !== null}>
          {busy === "invite" ? t.team.inviting : t.team.invite}
        </button>
      </form>

      {error ? <p className="mtv-settings-status-error">{error}</p> : null}
      {notice ? <p className="mtv-settings-status">{notice}</p> : null}

      <table className="mtv-tags-table">
        <thead>
          <tr>
            <th>{t.team.colName}</th>
            <th>{t.team.colRole}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.staffId}>
              <td>
                {member.displayName}
                {member.isSelf ? ` ${t.team.you}` : ""}
              </td>
              <td>{roleLabel(member.role)}</td>
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
                    {busy === `remove-${member.staffId}` ? t.team.removing : t.team.remove}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {invites.length > 0 ? (
        <>
          <h3 className="mtv-team-subhead">{t.team.pendingInvites}</h3>
          <table className="mtv-tags-table">
            <thead>
              <tr>
                <th>{t.team.colEmail}</th>
                <th>{t.team.colRole}</th>
                <th>{t.team.colExpires}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inviteRow) => (
                <tr key={inviteRow.id}>
                  <td>{inviteRow.email}</td>
                  <td>{roleLabel(inviteRow.role)}</td>
                  <td>{inviteRow.expiresAt.slice(0, 10)}</td>
                  <td>
                    <div className="mtv-team-actions">
                      <button
                        type="button"
                        className="mtv-btn"
                        onClick={() => void copy(inviteRow.link, inviteRow.id)}
                      >
                        {copied === inviteRow.id ? t.team.copied : t.team.copyLink}
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
                        {busy === `revoke-${inviteRow.id}` ? "…" : t.team.revoke}
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
