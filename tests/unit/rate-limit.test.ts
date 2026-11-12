import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/db', () => ({ getRpc: async () => rpc }));

const { rateLimit, memoryRateLimit, hashKey, __resetRateLimitsForTests } = await import('@/lib/rate-limit');
const { pickClientIp } = await import('@/lib/client-ip');

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

beforeEach(() => { rpc.mockReset(); __resetRateLimitsForTests(); });

describe('memoryRateLimit', () => {
  it('allows up to the limit, blocks after, and resets when the window passes', () => {
    const t = 1_000_000;
    expect(memoryRateLimit('k', 2, 60_000, t).ok).toBe(true);
    expect(memoryRateLimit('k', 2, 60_000, t).ok).toBe(true);
    const blocked = memoryRateLimit('k', 2, 60_000, t + 1000);
    expect(blocked).toEqual({ ok: false, retryAfterSec: 59 });
    expect(memoryRateLimit('k', 2, 60_000, t + 60_000).ok).toBe(true);
  });
});

describe('rateLimit (shared store)', () => {
  it('sends only a SHA-256 hash of the key, never the IP or email', async () => {
    rpc.mockResolvedValue({ data: { ok: true, retry_after_sec: 0 }, error: null });
    await rateLimit('auth-reset:ada@example.com', 3, 600_000);
    const [fn, arg] = rpc.mock.calls[0]!;
    expect(fn).toBe('rate_limit_hit');
    expect(arg).toEqual({ key: hashKey('auth-reset:ada@example.com'), limit: 3, window_ms: 600_000 });
    expect(JSON.stringify(arg)).not.toContain('ada@example.com');
    expect(arg.key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('blocks when the shared counter says so, even if this instance has seen few requests', async () => {
    rpc.mockResolvedValue({ data: { ok: false, retry_after_sec: 42 }, error: null });
    expect(await rateLimit('checkout:1.2.3.4', 15, 600_000)).toEqual({ ok: false, retryAfterSec: 42 });
  });

  it('falls back to the per-instance limit when the migration is not applied', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.rate_limit_hit' } });
    expect((await rateLimit('track:9.9.9.9', 1, 60_000)).ok).toBe(true);
    expect((await rateLimit('track:9.9.9.9', 1, 60_000)).ok).toBe(false);
    // backs off rather than hammering a missing function on every request
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('pickClientIp', () => {
  it('prefers headers set by the Vercel edge over a client-supplied x-forwarded-for', () => {
    expect(pickClientIp(headers({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(pickClientIp(headers({ 'x-forwarded-for': '6.6.6.6', 'x-vercel-forwarded-for': '5.5.5.5', 'x-real-ip': '1.2.3.4' }))).toBe('5.5.5.5');
  });
  it('falls back to the first forwarded address, then a constant', () => {
    expect(pickClientIp(headers({ 'x-forwarded-for': '7.7.7.7, 10.0.0.1' }))).toBe('7.7.7.7');
    expect(pickClientIp(headers({}))).toBe('unknown');
  });
});
