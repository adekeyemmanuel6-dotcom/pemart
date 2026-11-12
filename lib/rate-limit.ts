import 'server-only';
import { createHash } from 'node:crypto';
import { getRpc } from '@/lib/db';

/**
 * Fixed-window rate limiter for forms, auth, checkout and uploads.
 *
 * Serverless functions run as many separate instances, so an in-memory counter alone can be bypassed
 * by landing on a different instance. When the database has the rate_limit_hit function
 * (migration 0015) every instance shares one counter. Until that migration is applied, or if the
 * database call fails, it falls back to the per-instance counter so legitimate customers are never
 * locked out by an outage. Keys are SHA-256 hashed before leaving the process: no IP or email is stored.
 */
export type RateLimitResult = { ok: boolean; retryAfterSec: number };

const hits = new Map<string, { count: number; resetAt: number }>();
let sharedUnavailableUntil = 0;

export function memoryRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  return entry.count <= limit ? { ok: true, retryAfterSec: 0 } : { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // The local counter always runs too: it is free and still stops a burst on one instance.
  const local = memoryRateLimit(key, limit, windowMs);
  if (Date.now() < sharedUnavailableUntil) return local;
  const rpc = await getRpc();
  if (!rpc) return local;
  const { data, error } = await rpc<{ ok: boolean; retry_after_sec: number }>('rate_limit_hit', {
    key: hashKey(key),
    limit,
    window_ms: Math.max(1000, Math.round(windowMs)),
  });
  if (error || !data) {
    // Missing function (migration not applied) or a transient failure: back off for a minute.
    sharedUnavailableUntil = Date.now() + 60_000;
    return local;
  }
  if (!data.ok || !local.ok) return { ok: false, retryAfterSec: Math.max(data.retry_after_sec ?? 0, local.retryAfterSec) };
  return { ok: true, retryAfterSec: 0 };
}

/** Test hook: forget local counters and any shared-store back-off. */
export function __resetRateLimitsForTests() {
  hits.clear();
  sharedUnavailableUntil = 0;
}
