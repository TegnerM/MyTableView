import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS. NEVER import this into a client component, a route that
 * runs on the edge without auth checks, or anything reachable from the
 * browser. Guest actions are the only reason this exists: guests are not
 * authenticated against Postgres, so every read and write on their behalf
 * happens here, server-side, after the tag has been validated.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) {
    return cached;
  }

  cached = createClient(url!, serviceKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "x-mytableview-context": "service",
      },
    },
  });

  return cached;
}
