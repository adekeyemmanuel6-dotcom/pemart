'use client';
import { Analytics } from '@vercel/analytics/next';
import { useEffect } from 'react';
import { bootAnalytics } from '@/lib/analytics';
import { useConsent } from '@/lib/consent';

/** Mounts the analytics tools only for visitors who opted in. */
export function AnalyticsRuntime() {
  const consent = useConsent();
  useEffect(() => { bootAnalytics(); }, [consent]);
  return consent?.analytics ? <Analytics /> : null;
}
