import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the staff auth session on every request.
 *
 * Supabase access tokens are short-lived. Without this, a waiter who
 * leaves the floor view open through a shift finds their session dead
 * and their realtime subscription silently stopped. The middleware
 * refreshes the token and writes the new cookies back on the response.
 *
 * Guest routes are excluded — guests are never authenticated, and
 * running auth on the tap path would add latency to the one page that
 * has to be instant.
 */

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh. Do not remove.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   - /t/*        guest tap pages (never authenticated)
     *   - /api/guest  guest actions (service-role, server-side)
     *   - static assets
     */
    "/((?!t/|api/guest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
