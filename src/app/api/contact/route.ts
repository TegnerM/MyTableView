import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email/resend";

/**
 * POST /api/contact — the landing page's contact form.
 *
 * No auth (it's the public site); defenses are validation, a honeypot
 * field, and a hard size cap. Delivery goes through Resend to info@,
 * with Reply-To set to the sender so answering is one click.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const business =
    typeof body.business === "string" && body.business.trim()
      ? body.business.trim().slice(0, 120)
      : null;
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  // Honeypot: a hidden field humans never fill. Bots that do get a
  // polite 200 and nothing else.
  const honeypot = typeof body.website === "string" ? body.website.trim() : "";

  if (honeypot !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (name.length < 1 || !EMAIL.test(email) || message.length < 5) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const result = await sendContactEmail({
    fromName: name,
    fromEmail: email,
    business,
    message,
  });

  if (!result.sent) {
    console.error("contact: delivery failed", result.detail ?? "not configured");
    return NextResponse.json({ ok: false, reason: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
