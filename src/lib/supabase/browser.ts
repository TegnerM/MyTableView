"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for staff.
 *
 * Unlike the guest side, staff ARE authenticated against Postgres. Their
 * queries run under the `authenticated` role and are scoped by the RLS
 * policies from migration 002 — a waiter can only ever see rows for
 * venues they belong to.
 *
 * This is also what carries the realtime subscription: a request insert
 * pushes straight to every staff device watching that venue, with RLS
 * filtering what each subscriber actually receives.
 */

let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (cached) {
    return cached;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
