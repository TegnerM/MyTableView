/**
 * Transactional email via Resend's HTTP API (the domain is already
 * verified for auth emails). Optional: without RESEND_API_KEY the
 * caller gets { configured: false } and offers the copy-link path.
 */

export async function sendInviteEmail(options: {
  to: string;
  inviteLink: string;
  note: string | null;
  trialDays: number;
}): Promise<{ configured: boolean; sent: boolean; detail?: string }> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    return { configured: false, sent: false };
  }

  const { to, inviteLink, note, trialDays } = options;

  const noteBlock = note
    ? `<p style="margin:0 0 24px;padding:12px 16px;font-size:14px;line-height:1.6;color:#24405c;background:#fbf9f5;border-left:3px solid #12a89a;border-radius:6px;">${escapeHtml(note)}</p>`
    : "";

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f4ef;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e0dace;border-radius:12px;">
      <tr><td style="padding:32px 36px 28px;">
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#16293d;">mytable<span style="color:#12a89a;">view</span></p>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f1c2a;">You're invited</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c6b7a;">
          Michael invited you to try MyTableView — see every table, miss
          nothing. Guests tap a code on the table; your floor sees who
          needs what before anyone feels forgotten.
        </p>
        ${noteBlock}
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c6b7a;">
          Your invite includes a <strong>${trialDays}-day free trial</strong> — no credit card.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background-color:#0b5f56;border-radius:8px;">
            <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Set up your restaurant</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a97a5;">
          Or copy this link: <a href="${inviteLink}" style="color:#0d8478;word-break:break-all;">${inviteLink}</a>
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a97a5;">© MyTableView · mytableview.com</p>
  </td></tr>
</table>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MyTableView <no-reply@mytableview.com>",
        to: [to],
        subject: "You're invited to MyTableView — free trial inside",
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("resend: send failed", response.status, detail.slice(0, 200));
      return { configured: true, sent: false, detail: `resend ${response.status}` };
    }

    return { configured: true, sent: true };
  } catch (error) {
    console.error("resend: request failed", error);
    return { configured: true, sent: false, detail: "network error" };
  }
}


export async function sendStaffInviteEmail(options: {
  to: string;
  venueName: string;
  inviterName: string;
  role: "waiter" | "manager";
  inviteLink: string;
}): Promise<{ configured: boolean; sent: boolean; detail?: string }> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    return { configured: false, sent: false };
  }

  const { to, venueName, inviterName, role, inviteLink } = options;
  const roleLabel = role === "manager" ? "a manager" : "a waiter";

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f4ef;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e0dace;border-radius:12px;">
      <tr><td style="padding:32px 36px 28px;">
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#16293d;">mytable<span style="color:#12a89a;">view</span></p>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f1c2a;">Join ${escapeHtml(venueName)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c6b7a;">
          ${escapeHtml(inviterName)} added you to <strong>${escapeHtml(venueName)}</strong>'s
          team on MyTableView as ${roleLabel}. Set up your login and you'll
          see the live floor — which tables need what, the moment a guest asks.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background-color:#0b5f56;border-radius:8px;">
            <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Join the team</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a97a5;">
          Or copy this link: <a href="${inviteLink}" style="color:#0d8478;word-break:break-all;">${inviteLink}</a>
        </p>
      </td></tr>
      <tr><td style="padding:16px 36px;border-top:1px solid #e0dace;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8a97a5;">
          Not expecting this? You can ignore this email — nothing happens without you.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a97a5;">© MyTableView · mytableview.com</p>
  </td></tr>
</table>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MyTableView <no-reply@mytableview.com>",
        to: [to],
        subject: `Join ${venueName} on MyTableView`,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("resend: staff invite failed", response.status, detail.slice(0, 200));
      return { configured: true, sent: false, detail: `resend ${response.status}` };
    }

    return { configured: true, sent: true };
  } catch (error) {
    console.error("resend: staff invite request failed", error);
    return { configured: true, sent: false, detail: "network error" };
  }
}


export async function sendTrialReminderEmail(options: {
  to: string;
  venueName: string;
  kind: "3d" | "1d" | "ended";
}): Promise<{ configured: boolean; sent: boolean; detail?: string }> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    return { configured: false, sent: false };
  }

  const { to, venueName, kind } = options;
  const link = "https://www.mytableview.com/staff/settings";

  const copy =
    kind === "3d"
      ? {
          subject: `3 days left on ${venueName}'s free trial`,
          heading: "3 days left on your trial",
          body: `Your free trial for <strong>${escapeHtml(venueName)}</strong> ends in 3 days. Everything keeps running until then — and subscribing takes about a minute, so your floor never misses a request.`,
          button: "Choose a plan",
        }
      : kind === "1d"
        ? {
            subject: `Last day of ${venueName}'s free trial`,
            heading: "Your trial ends tomorrow",
            body: `Tomorrow is the last day of <strong>${escapeHtml(venueName)}</strong>'s free trial. Subscribe today and service continues without a single missed tap.`,
            button: "Subscribe now",
          }
        : {
            subject: `${venueName}'s trial has ended`,
            heading: "Your trial has ended",
            body: `The free trial for <strong>${escapeHtml(venueName)}</strong> ended today, so the live floor is paused. Everything is exactly as you left it — tables, zones, tags — and subscribing switches it back on instantly.`,
            button: "Reactivate your floor",
          };

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f4ef;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e0dace;border-radius:12px;">
      <tr><td style="padding:32px 36px 28px;">
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#16293d;">mytable<span style="color:#12a89a;">view</span></p>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f1c2a;">${copy.heading}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c6b7a;">${copy.body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background-color:#0b5f56;border-radius:8px;">
            <a href="${link}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${copy.button}</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a97a5;">
          Plans start at &euro;49/month, cancel anytime. Questions? Just reply to this email.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a97a5;">&copy; MyTableView &middot; mytableview.com</p>
  </td></tr>
</table>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MyTableView <no-reply@mytableview.com>",
        to: [to],
        subject: copy.subject,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("resend: trial reminder failed", response.status, detail.slice(0, 200));
      return { configured: true, sent: false, detail: `resend ${response.status}` };
    }

    return { configured: true, sent: true };
  } catch (error) {
    console.error("resend: trial reminder request failed", error);
    return { configured: true, sent: false, detail: "network error" };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
