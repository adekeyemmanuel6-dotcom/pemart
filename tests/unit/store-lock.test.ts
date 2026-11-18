// The pre-sale lock: until launch every public store page sends visitors to /presale.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const req = (path: string, cookie?: string) => new NextRequest(`https://shop.test${path}`, { headers: cookie ? { cookie } : {} });
async function load(unlocked?: string) {
  vi.resetModules();
  if (unlocked === undefined) vi.stubEnv('E2E_STORE_UNLOCKED', ''); else vi.stubEnv('E2E_STORE_UNLOCKED', unlocked);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  return (await import('@/middleware')).middleware;
}
beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe('store lock (default: locked)', () => {
  it.each(['/', '/collections/all', '/products/seek-first-tee', '/bundles/couples-christmas-box', '/combos', '/combos/behold', '/bag', '/checkout', '/gift-boxes'])('redirects %s to /presale', async (path) => {
    const res = await (await load())(req(path));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/presale');
  });

  it.each(['/presale', '/admin', '/admin/combos', '/api/combos', '/auth/sign-in', '/account', '/privacy', '/terms', '/robots.txt', '/sitemap.xml'])('lets %s through', async (path) => {
    const res = await (await load())(req(path));
    expect(res.headers.get('location')).toBeNull();
  });

  it('a staff preview cookie opens the whole store', async () => {
    const res = await (await load())(req('/collections/all', 'wtw_preview=1'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('a wrong preview cookie value does not', async () => {
    const res = await (await load())(req('/collections/all', 'wtw_preview=0'));
    expect(res.status).toBe(307);
  });

  it('?preview=1 sets a secure httpOnly cookie and removes itself from the URL; ?preview=0 clears it', async () => {
    const on = await (await load())(req('/products/x?preview=1&size=M'));
    expect(on.status).toBe(307);
    expect(new URL(on.headers.get('location')!).search).toBe('?size=M');
    const cookie = on.headers.get('set-cookie')!;
    expect(cookie).toMatch(/wtw_preview=1/); expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/Secure/i);
    const off = await (await load())(req('/products/x?preview=0', 'wtw_preview=1'));
    expect(off.headers.get('set-cookie')).toMatch(/wtw_preview=;|Max-Age=0|Expires=/i);
  });

  it('the redirect drops the query string and never leaks the original path', async () => {
    const res = await (await load())(req('/products/x?code=SECRET'));
    expect(res.headers.get('location')).toBe('https://shop.test/presale');
  });
});

describe('the test-only unlock', () => {
  it('only E2E_STORE_UNLOCKED=1 unlocks; any other value keeps the lock', async () => {
    expect((await (await load('1'))(req('/collections/all'))).headers.get('location')).toBeNull();
    for (const v of ['0', 'true', 'yes']) expect((await (await load(v))(req('/collections/all'))).status).toBe(307);
  });
});

describe('the unlock stays test-only', () => {
  it('is set in playwright.config.ts and nowhere that ships (env examples, vercel, package scripts, Next config)', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const files = ['.env.example', '.env.local.example', '.env.production', 'vercel.json', 'package.json', 'next.config.ts', 'next.config.mjs', 'next.config.js'];
    for (const f of files) if (existsSync(f)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/E2E_STORE_UNLOCKED/);
    expect(readFileSync('playwright.config.ts', 'utf8')).toMatch(/E2E_STORE_UNLOCKED/);
  });
});
