import { describe, expect, it } from 'vitest';
import { PUBLIC_PATH_SOURCE, SENSITIVE_PREFIXES, isSensitivePath, nonceCsp, publicCsp } from '@/lib/csp';

const directive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('content security policy', () => {
  it('sensitive routes get a nonce and strict-dynamic, and no inline scripts', () => {
    const script = directive(nonceCsp('abc123'), 'script-src');
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
  });
  it('public static pages allow inline scripts for hydration but nothing beyond the listed hosts', () => {
    expect(directive(publicCsp, 'script-src')).toContain("'unsafe-inline'");
    for (const csp of [publicCsp, nonceCsp('x')]) {
      expect(directive(csp, 'object-src')).toBe("object-src 'none'");
      expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
      expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
      expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    }
  });
  it('knows which paths are sensitive', () => {
    for (const p of ['/admin', '/admin/orders', '/account', '/checkout', '/order/PM-10001', '/auth/sign-in']) expect(isSensitivePath(p), p).toBe(true);
    for (const p of ['/', '/products/seek-first-tee', '/orders-info', '/checkout-tips', '/bag']) expect(isSensitivePath(p), p).toBe(false);
  });
  it('the header rule for the static policy matches exactly the non-sensitive paths', () => {
    const re = new RegExp(`^${PUBLIC_PATH_SOURCE.replace('/:path', '/').replace(/^\//, '')}$`.replace('^/(', '^('));
    for (const p of ['products/seek-first-tee', 'bag', 'orders-info']) expect(re.test(p), p).toBe(true);
    for (const prefix of SENSITIVE_PREFIXES) { expect(re.test(prefix.slice(1)), prefix).toBe(false); expect(re.test(`${prefix.slice(1)}/x`), prefix).toBe(false); }
  });
});
