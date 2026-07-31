import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=... — PKCE code exchange.
 *
 * Supabase's DEFAULT confirmation-email link verifies at Supabase and
 * then redirects to the Site URL with ?code=...; the landing page
 * forwards that here. Exchanging the code writes the session into
 * cookies, then the user continues signup. The branded template's
 * /auth/confirm path doesn't produce a code — this route exists so
 * confirmation works whichever template is live in the dashboard.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/staff/sign-up";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/staff/sign-up";

  if (code) {
    const supabase = await getServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }

    console.error("auth/callback: code exchange failed", error.message);
  }

  return NextResponse.redirect(
    new URL("/staff/sign-in?error=confirm", url.origin)
  );
}
