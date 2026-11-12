'use client';
import { useEffect, useRef, useState } from 'react';
import { quoteBag } from '@/lib/actions/checkout';
import type { BundleSelection } from '@/lib/bundles/selection';
import { useBag, type BagLine } from '@/lib/cart-store';
import type { CartLineInput, Extras, PublicQuote } from './types';

/** What the bag stores -> what the server is asked to price. Only intent, never prices. */
export function toInputLines(lines: BagLine[]): CartLineInput[] {
  return lines.map((l): CartLineInput => {
    if (l.kind === 'bundle') return { id: l.id, kind: 'bundle', refId: l.refId, quantity: l.quantity, selection: l.selection as unknown as BundleSelection };
    if (l.kind === 'custom') return { id: l.id, kind: 'custom', refId: l.refId, quantity: 1 };
    if (l.kind === 'revision') return { id: l.id, kind: 'revision', refId: l.refId, quantity: 1 };
    return { id: l.id, kind: 'variant', refId: l.refId, quantity: l.quantity, upsell: l.upsell, giftCard: l.giftCard };
  });
}

export type QuoteOptions = { state?: string; city?: string; shippingRateId?: string; extras?: Extras; useCredit?: boolean; acceptFinalSale?: boolean; giftMessage?: string };

/** Live server quote for the current bag. Debounced; stale responses are dropped. */
export function useQuote(opts: QuoteOptions = {}) {
  const lines = useBag((s) => s.lines);
  const code = useBag((s) => s.code);
  const giftCode = useBag((s) => s.giftCode);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const payload = { lines: toInputLines(lines), code: code || undefined, giftCode: giftCode || undefined, state: opts.state, city: opts.city, shippingRateId: opts.shippingRateId, extras: opts.extras, useCredit: opts.useCredit, acceptFinalSale: opts.acceptFinalSale ?? true, giftMessage: opts.giftMessage };
  const key = JSON.stringify(payload);

  useEffect(() => {
    if (!payload.lines.length) { setQuote(null); setLoading(false); setError(null); return; }
    const mine = ++seq.current;
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await quoteBag(payload);
        if (cancelled || mine !== seq.current) return;
        if (res.ok) { setQuote(res.quote); setError(null); } else setError(res.message);
      } catch { if (!cancelled && mine === seq.current) setError('We could not update your bag. Please check your connection.'); }
      finally { if (!cancelled && mine === seq.current) setLoading(false); }
    }, 250);
    return () => { window.clearTimeout(t); cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error, hasLines: lines.length > 0 };
}

const STATE_KEY = 'pemart-state';
/** The visitor's chosen delivery state (shared with product pages and the gift box hub). */
export function useDeliveryState(): [string, (s: string) => void] {
  const [state, setState] = useState('');
  useEffect(() => { try { const s = localStorage.getItem(STATE_KEY); if (s) setState(s); } catch { /* ignore */ } }, []);
  return [state, (s) => { setState(s); try { localStorage.setItem(STATE_KEY, s); } catch { /* ignore */ } }];
}
