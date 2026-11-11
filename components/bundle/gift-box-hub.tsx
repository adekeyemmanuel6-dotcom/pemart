'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cutoffInstant, cutoffStatus } from '@/lib/countdown';
import { Countdown } from './countdown';
import { Button } from '@/components/ui/button';

export type HubZone = { name: string; states: string[]; cutoff: string | null };

const fmt = (iso: string) => new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(cutoffInstant(iso));

/**
 * Countdown to the Christmas delivery cutoff for the visitor's area. After the cutoff it says so plainly
 * and points to ready-stock items and gift cards (passed in as server-rendered `suggestions`).
 */
export function GiftBoxHub({ zones, boxes, suggestions }: { zones: HubZone[]; boxes: React.ReactNode; suggestions: React.ReactNode }) {
  const [state, setState] = useState('Lagos');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    try { const s = localStorage.getItem('pemart-state'); if (s) setState(s); } catch { /* ignore */ }
  }, []);
  const choose = (s: string) => { setState(s); try { localStorage.setItem('pemart-state', s); } catch { /* ignore */ } };

  const zone = zones.find((z) => z.states.includes(state)) ?? zones[zones.length - 1]!;
  const passed = !!now && !!zone.cutoff && cutoffStatus(zone.cutoff, now).state === 'passed';

  return (
    <div>
      <section className="mb-10 rounded-lg border-2 border-ink p-5 sm:p-8" aria-labelledby="cut-h">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 id="cut-h" className="display text-3xl sm:text-4xl">{passed ? `The ${zone.name} Christmas cutoff has passed` : `Order for Christmas delivery in ${zone.name}`}</h2>
            {zone.cutoff && <p className="mt-1 text-muted">{passed ? `The cutoff was ${fmt(zone.cutoff)}.` : `Order by the end of ${fmt(zone.cutoff)} and we will get it to you by Christmas.`}</p>}
            <div className="mt-4 max-w-xs">
              <label htmlFor="hub-state" className="mb-1 block text-sm font-semibold">Where are we delivering?</label>
              <select id="hub-state" value={state} onChange={(e) => choose(e.target.value)} className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base">
                {zones.flatMap((z) => z.states).sort((a, b) => a.localeCompare(b)).map((s) => (<option key={s}>{s}</option>))}
              </select>
            </div>
          </div>
          {zone.cutoff && !passed && <Countdown isoDate={zone.cutoff} />}
        </div>
        {passed && (
          <div role="alert" className="mt-5 rounded-md bg-ember/15 p-4">
            <p className="font-semibold">Gift boxes ordered now will not arrive before Christmas in {zone.name}.</p>
            <p className="mt-1 text-sm">You can still order a box as an early New Year gift, or choose something that is ready to ship below and add a digital gift card for an instant present.</p>
          </div>
        )}
        <ul className="mt-6 grid gap-2 border-t border-line pt-4 text-sm sm:grid-cols-3" aria-label="Cutoff dates by area">
          {zones.map((z) => (<li key={z.name}><span className="font-semibold">{z.name}:</span> {z.cutoff ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).format(cutoffInstant(z.cutoff)) : 'no cutoff'}</li>))}
        </ul>
      </section>

      {passed && (
        <section className="mb-12" aria-labelledby="ready-h">
          <h2 id="ready-h" className="display mb-2 text-3xl sm:text-4xl">Ready to ship instead</h2>
          <p className="mb-5 text-muted">In stock and quick to send. Or give a digital gift card and let them choose.</p>
          {suggestions}
          <Button asChild className="mt-6"><Link href="/gift-cards">Buy a digital gift card</Link></Button>
        </section>
      )}
      {boxes}
    </div>
  );
}
