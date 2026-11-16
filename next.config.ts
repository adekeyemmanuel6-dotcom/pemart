import type { NextConfig } from 'next';
import { PUBLIC_PATH_SOURCE, publicCsp } from './lib/csp';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The OG image route reads this font from disk at runtime, so make sure Vercel ships it.
  outputFileTracingIncludes: { '/og/[slug]': ['./assets/fonts/**'] },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  async headers() {
    const hardening = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: hardening },
      // Sensitive dynamic routes get their CSP (with a nonce) from middleware; everything else gets the static policy here.
      { source: PUBLIC_PATH_SOURCE, headers: [{ key: 'Content-Security-Policy', value: publicCsp }] },
    ];
  },
};

export default config;
