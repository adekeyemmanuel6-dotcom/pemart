'use client';
import { track as vercelTrack } from '@vercel/analytics';
import { readConsent } from '@/lib/consent';

/**
 * Consent-gated analytics. GA4, Meta Pixel and Vercel Analytics only start once the visitor has opted in,
 * and `track()` is a no-op until then. Prices are sent in naira (kobo / 100), currency NGN.
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...a: unknown[]) => void;
    fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: (...a: unknown[]) => void };
    _fbq?: unknown;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || '';
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';

export type TrackItem = { id: string; name: string; priceKobo: number; quantity: number; category?: string };
export type TrackEvent = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';
type Payload = { items: TrackItem[]; valueKobo: number; transactionId?: string };

const META_NAME: Record<TrackEvent, string> = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' };
const naira = (kobo: number) => Math.round(kobo) / 100;

function loadScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement('script');
  s.async = true; s.src = src;
  document.head.appendChild(s);
}

function initGa() {
  if (!GA_ID || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
}

function initPixel() {
  if (!PIXEL_ID || window.fbq) return;
  type Fbq = NonNullable<Window['fbq']>;
  // Same queue-then-flush stub Meta's own snippet installs; fbevents.js replaces callMethod once loaded.
  const fbq: Fbq = Object.assign((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args); }, { queue: [] as unknown[], loaded: true });
  window.fbq = fbq; window._fbq = fbq;
  loadScript('https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
}

/** Start whichever tools the visitor has agreed to. Safe to call repeatedly. */
export function bootAnalytics() {
  if (typeof window === 'undefined') return;
  const c = readConsent();
  if (c?.analytics) initGa();
  if (c?.marketing) initPixel();
}

export function track(event: TrackEvent, p: Payload) {
  if (typeof window === 'undefined') return;
  const c = readConsent();
  if (!c || (!c.analytics && !c.marketing)) return;
  bootAnalytics();
  const value = naira(p.valueKobo);
  if (c.analytics) {
    window.gtag?.('event', event, {
      currency: 'NGN', value,
      ...(p.transactionId ? { transaction_id: p.transactionId } : {}),
      items: p.items.map((i) => ({ item_id: i.id, item_name: i.name, price: naira(i.priceKobo), quantity: i.quantity, ...(i.category ? { item_category: i.category } : {}) })),
    });
    try { vercelTrack(event, { value, currency: 'NGN', items: p.items.length }); } catch { /* analytics must never break the page */ }
  }
  if (c.marketing) {
    window.fbq?.('track', META_NAME[event], {
      value, currency: 'NGN', content_type: 'product', content_ids: p.items.map((i) => i.id), num_items: p.items.reduce((n, i) => n + i.quantity, 0),
    }, p.transactionId ? { eventID: p.transactionId } : undefined);
  }
}
