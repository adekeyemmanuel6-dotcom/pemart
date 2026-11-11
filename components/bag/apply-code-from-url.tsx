'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBag } from '@/lib/cart-store';

/** Applies `?code=XXXX` (from the welcome email) to the bag. */
export function ApplyCodeFromUrl() {
  const code = useSearchParams().get('code');
  useEffect(() => { if (code && /^[A-Za-z0-9-]{3,32}$/.test(code)) useBag.getState().setCodes(code.toUpperCase(), useBag.getState().giftCode); }, [code]);
  return null;
}
