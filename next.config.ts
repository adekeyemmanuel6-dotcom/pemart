import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co';

// Phase 1 CSP. Next.js needs inline scripts for hydration, so script-src keeps
// 'unsafe-inline' until Phase 7 replaces it with per-request nonces.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.paystack.co https://www.googletagmanager.com https://connect.facebook.net https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost} https://www.google-analytics.com https://www.facebook.com`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.paystack.co https://www.google-analytics.com https://vitals.vercel-insights.com`,
  'frame-src https://checkout.paystack.com https://js.paystack.co',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

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
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
