import 'server-only';
import { headers } from 'next/headers';

/**
 * The visitor's IP address for rate limiting. Prefers headers that Vercel's edge sets itself and a
 * client cannot inject (x-vercel-forwarded-for, x-real-ip). Only then falls back to the first
 * x-forwarded-for entry, which is trustworthy on Vercel but spoofable behind other proxies.
 */
export function pickClientIp(h: { get(name: string): string | null }): string {
  const first = (v: string | null) => v?.split(',')[0]?.trim() || null;
  return first(h.get('x-vercel-forwarded-for')) ?? first(h.get('x-real-ip')) ?? first(h.get('x-forwarded-for')) ?? 'unknown';
}

export async function clientIp(): Promise<string> {
  return pickClientIp(await headers());
}
