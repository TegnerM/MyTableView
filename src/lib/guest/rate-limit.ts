import { createHash } from "node:crypto";

/**
 * Per-IP guard for the guest endpoints — the only routes an anonymous
 * stranger can POST to.
 *
 * Sliding window over in-process memory. On serverless this protects
 * each warm instance, which is exactly where a hammering client lands
 * (keep-alive pins them to the instance they're abusing). It is a
 * cost/noise shield, not the business rule — the real per-table limits
 * (burst cap, duplicate suppression, hourly tap ceiling, one rating
 * per visit) live in the DB layer and hold across instances.
 *
 * Limits are deliberately generous because restaurant guests share the
 * venue wifi's single public IP: a full house tapping normally must
 * never trip this; a script in a loop must.
 */

const buckets = new Map<string, number[]>();

/** Hard cap on tracked keys so spoofed IPs can't grow memory forever. */
const MAX_KEYS = 10_000;

export function clientIpKey(request: Request): string {
  // First hop of x-forwarded-for is set by the platform edge, not the
  // client, so it is safe to key on.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Key convention: callers prefix a route namespace ("req:", "fb:") so
 * each endpoint budgets independently — a busy minute of service
 * requests must never eat the ratings budget.
 */
export function allowHit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let hits = buckets.get(key);

  if (!hits) {
    if (buckets.size >= MAX_KEYS) {
      // Evict the oldest-inserted key rather than failing open forever.
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    hits = [];
    buckets.set(key, hits);
  }

  // Prune expired hits in place.
  while (hits.length > 0 && hits[0] < cutoff) {
    hits.shift();
  }

  if (hits.length >= limit) {
    return false;
  }

  hits.push(now);
  return true;
}
