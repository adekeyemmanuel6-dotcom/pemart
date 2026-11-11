/**
 * Content Security Policy.
 *
 * Sensitive, always-dynamic routes (admin, account, checkout, order pages, auth) get a strict per-request
 * nonce policy from middleware: no 'unsafe-inline' scripts, and 'strict-dynamic' so only scripts our own
 * nonced bundles load can run. Public catalogue pages are statically generated and cached, so they cannot
 * carry a per-request nonce; they keep a policy that allows inline scripts (Next.js hydration data) but is
 * otherwise locked down. Do not put anything user-controlled on those pages without escaping.
 * This file has no imports so next.config.ts can read it too.
 */
const supabaseHost = (() => {
  try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : '*.supabase.co'; } catch { return '*.supabase.co'; }
})();
const isDev = process.env.NODE_ENV !== 'production';

const THIRD_PARTY_SCRIPTS = 'https://js.paystack.co https://www.googletagmanager.com https://connect.facebook.net https://va.vercel-scripts.com';

const common = (scriptSrc: string) => [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost} https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.paystack.co https://www.google-analytics.com https://*.google-analytics.com https://www.facebook.com https://connect.facebook.net https://vitals.vercel-insights.com https://va.vercel-scripts.com`,
  'frame-src https://checkout.paystack.com https://js.paystack.co',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** Static public pages. */
export const publicCsp = common(`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${THIRD_PARTY_SCRIPTS}`);

/** Dynamic sensitive pages: nonce + strict-dynamic. */
export const nonceCsp = (nonce: string) => common(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`);

/** Path prefixes that always render per request and therefore get the strict policy. */
export const SENSITIVE_PREFIXES = ['/admin', '/account', '/checkout', '/order', '/auth'];
export const isSensitivePath = (pathname: string) => SENSITIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Regex (path-to-regexp) matching everything that is NOT a sensitive prefix, for next.config header rules. */
export const PUBLIC_PATH_SOURCE = `/:path((?!(?:${SENSITIVE_PREFIXES.map((p) => p.slice(1)).join('|')})(?:/|$)).*)`;
