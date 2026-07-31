import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";

/**
 * /auth/confirm — email confirmation done properly for a cookie-based
 * SSR app, and hardened against mail scanners.
 *
 * The problem being solved: Supabase's confirmation links are one-shot,
 * and Gmail/Outlook pre-fetch links in emails with GET requests — so a
 * naive "verify on GET" route lets a bot consume the token before the
 * human clicks ("Email link is invalid or has expired").
 *
 * GET  → renders a small branded page with ONE button. Safe for
 *        scanners: nothing is consumed by loading it.
 * POST → (the button) verifies the token server-side via verifyOtp,
 *        which writes the session into cookies — the only session
 *        store this app uses — then redirects to finish signup.
 *
 * The email template (src/emails/supabase-confirm-signup.html) links
 * here with ?token_hash={{ .TokenHash }}&type=email. Site URL must be
 * https://mytableview.com in Supabase Auth → URL Configuration.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token hashes are URL-safe; anything else is dropped, which also
 *  keeps the value safe to embed in the HTML below. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,255}$/;

const OTP_TYPES: EmailOtpType[] = [
  "email",
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

function sanitize(url: URL): {
  tokenHash: string | null;
  type: EmailOtpType | null;
  next: string;
} {
  const rawToken = url.searchParams.get("token_hash") ?? "";
  const rawType = url.searchParams.get("type") ?? "";
  const rawNext = url.searchParams.get("next") ?? "/staff/sign-up";

  return {
    tokenHash: TOKEN_PATTERN.test(rawToken) ? rawToken : null,
    type: (OTP_TYPES as string[]).includes(rawType)
      ? (rawType as EmailOtpType)
      : null,
    // Same-origin paths only — the email can never become an open redirect.
    next: rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/staff/sign-up",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { tokenHash, type, next } = sanitize(url);

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/staff/sign-in?error=confirm", url.origin)
    );
  }

  // Values are sanitized to strict character sets above, so embedding
  // them in markup is safe.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Confirm your email — MyTableView</title>
</head>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#f6f4ef;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16293d;">
  <main style="width:100%;max-width:22rem;padding:2rem 1.75rem;background:#ffffff;border:1px solid #e0dace;border-radius:1rem;box-shadow:0 18px 40px rgba(22,41,61,0.08);text-align:center;">
    <p style="margin:0 0 1.25rem;font-size:1.35rem;font-weight:700;letter-spacing:-0.02em;">mytable<span style="color:#12a89a;">view</span></p>
    <h1 style="margin:0 0 0.6rem;font-size:1.0625rem;font-weight:600;color:#5c6b7a;">One last click</h1>
    <p style="margin:0 0 1.5rem;font-size:0.9375rem;line-height:1.55;color:#5c6b7a;">Press the button to confirm your email address and continue setting up your restaurant.</p>
    <form method="post" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${tokenHash}">
      <input type="hidden" name="type" value="${type}">
      <input type="hidden" name="next" value="${next.replace(/"/g, "")}">
      <button type="submit" style="width:100%;padding:0.8125rem;font-size:1rem;font-weight:650;color:#ffffff;background:#0b5f56;border:none;border-radius:0.5rem;cursor:pointer;">Confirm email address</button>
    </form>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  const form = await request.formData();
  const check = new URL(url.origin + "/auth/confirm");
  check.searchParams.set("token_hash", String(form.get("token_hash") ?? ""));
  check.searchParams.set("type", String(form.get("type") ?? ""));
  check.searchParams.set("next", String(form.get("next") ?? ""));

  const { tokenHash, type, next } = sanitize(check);

  if (tokenHash && type) {
    const supabase = await getServerClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      // 303: turn the POST into a GET at the destination.
      return NextResponse.redirect(new URL(next, url.origin), 303);
    }

    console.error("auth/confirm: verify failed", error.message);
  }

  return NextResponse.redirect(
    new URL("/staff/sign-in?error=confirm", url.origin),
    303
  );
}
