'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { COOKIE_BANNER, OPEN_EVENT, saveConsent, useConsent } from '@/lib/consent';
import { bootAnalytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';

/** Cookie banner plus the "Cookie settings" re-open hook. Essential storage is always on; the rest is opt-in. */
export function ConsentBanner() {
  const consent = useConsent();
  const [forced, setForced] = useState(false);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => { setForced(true); setCustomise(true); };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  useEffect(() => { if (consent) { setAnalytics(consent.analytics); setMarketing(consent.marketing); } }, [consent]);
  useEffect(() => { if (forced) ref.current?.focus(); }, [forced]);

  const visible = consent === null || forced;
  if (!COOKIE_BANNER || consent === undefined || !visible) return null;

  const choose = (a: boolean, m: boolean) => {
    const hadTracking = !!consent && (consent.analytics || consent.marketing);
    saveConsent({ analytics: a, marketing: m });
    setForced(false); setCustomise(false);
    // Withdrawing consent must also stop already-loaded scripts, so reload without them.
    if (hadTracking && (!a && consent!.analytics || !m && consent!.marketing)) window.location.reload();
    else bootAnalytics();
  };

  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label="Cookie preferences" aria-modal="false"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-lg border border-line bg-paper p-4 shadow-xl outline-none sm:left-auto sm:right-4 sm:mx-0">
      <p className="font-semibold">Cookies on Pemart</p>
      <p className="mt-1 text-sm text-muted">We use essential storage to keep your bag and sign-in working. With your OK we also use analytics and marketing tools to see what helps and to show our ads to the right people. See our <Link href="/privacy" className="font-semibold underline">privacy policy</Link>.</p>
      {customise && (
        <fieldset className="mt-3 space-y-2 text-sm">
          <legend className="sr-only">Choose which cookies to allow</legend>
          <label className="flex items-start gap-3"><input type="checkbox" checked disabled className="mt-1 size-5" /><span><strong>Essential</strong> (always on): bag, sign-in, security.</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 size-5" /><span><strong>Analytics</strong>: Google Analytics and Vercel Analytics, to see which pages and products work.</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 size-5" /><span><strong>Marketing</strong>: Meta Pixel, to measure and improve our ads.</span></label>
        </fieldset>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {customise ? (
          <Button onClick={() => choose(analytics, marketing)}>Save choices</Button>
        ) : (
          <>
            <Button onClick={() => choose(true, true)}>Accept all</Button>
            <Button variant="secondary" onClick={() => choose(false, false)}>Essential only</Button>
            <Button variant="ghost" onClick={() => setCustomise(true)}>Customise</Button>
          </>
        )}
        {forced && <Button variant="ghost" onClick={() => { setForced(false); setCustomise(false); }}>Close</Button>}
      </div>
    </div>
  );
}
