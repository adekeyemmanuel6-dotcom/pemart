/**
 * Small fixed-window rate limiter for forms and auth endpoints.
 * In-memory: it works per server instance, which is fine for development and
 * as a first line of defence. Before heavy traffic, swap the store for
 * Upstash/Vercel KV (the signature stays the same). Tracked in PROGRESS.md.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  return entry.count <= limit ? { ok: true, retryAfterSec: 0 } : { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}
