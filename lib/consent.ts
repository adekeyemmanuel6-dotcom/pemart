'use client';
import { useSyncExternalStore } from 'react';

/**
 * Cookie consent. Nothing beyond essential storage (bag, sign-in) runs until the visitor chooses.
 * `analytics` = GA4 + Vercel Analytics, `marketing` = Meta Pixel. The choice is kept in localStorage
 * with a timestamp so we can show when it was given.
 */
export type Consent = { analytics: boolean; marketing: boolean; ts: string };

const KEY = 'pemart-consent';
const CHANGE = 'pemart:consent';
export const OPEN_EVENT = 'pemart:consent-open';

export function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Consent>;
    return typeof v.analytics === 'boolean' && typeof v.marketing === 'boolean' ? { analytics: v.analytics, marketing: v.marketing, ts: String(v.ts ?? '') } : null;
  } catch { return null; }
}

export function saveConsent(choice: { analytics: boolean; marketing: boolean }): Consent {
  const c: Consent = { ...choice, ts: new Date().toISOString() };
  try { window.localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode: the choice just won't persist */ }
  window.dispatchEvent(new Event(CHANGE));
  return c;
}

let cache: { raw: string | null; value: Consent | null } = { raw: null, value: null };
function snapshot(): Consent | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* ignore */ }
  if (raw !== cache.raw) cache = { raw, value: readConsent() };
  return cache.value;
}
function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(CHANGE, cb); window.removeEventListener('storage', cb); };
}

/** `undefined` until the client has hydrated, then the saved choice or `null` (no decision yet). */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

export function openConsentSettings() { window.dispatchEvent(new Event(OPEN_EVENT)); }
