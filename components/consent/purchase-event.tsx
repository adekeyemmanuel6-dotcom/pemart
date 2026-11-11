'use client';
import { useEffect } from 'react';
import { track, type TrackItem } from '@/lib/analytics';
import { useConsent } from '@/lib/consent';

const KEY = 'pemart-tracked-orders';

/** Fires the purchase event once per order on this device (a refresh must not double-count revenue). */
export function PurchaseEvent({ orderNumber, valueKobo, items }: { orderNumber: string; valueKobo: number; items: TrackItem[] }) {
  const consent = useConsent();
  useEffect(() => {
    if (!consent || (!consent.analytics && !consent.marketing)) return;
    try {
      const seen: string[] = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
      if (seen.includes(orderNumber)) return;
      track('purchase', { transactionId: orderNumber, valueKobo, items });
      window.localStorage.setItem(KEY, JSON.stringify([...seen.slice(-49), orderNumber]));
    } catch { /* storage unavailable: skip rather than risk double counting */ }
  }, [consent, orderNumber, valueKobo, items]);
  return null;
}
