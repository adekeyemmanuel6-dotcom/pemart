/** The cookie banner is off by default. Set NEXT_PUBLIC_COOKIE_BANNER=1 (and redeploy) to show it. With no banner nobody consents, so GA4, Meta Pixel and Vercel Analytics never load. */
export const COOKIE_BANNER = process.env.NEXT_PUBLIC_COOKIE_BANNER === '1';
