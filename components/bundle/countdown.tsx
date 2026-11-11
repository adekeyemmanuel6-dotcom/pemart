'use client';
import { useEffect, useState } from 'react';
import { cutoffStatus } from '@/lib/countdown';

/** Ticking countdown to a cutoff date (end of that day, Lagos time). Renders after mount so server and browser never disagree. */
export function Countdown({ isoDate, now: fixedNow }: { isoDate: string; now?: Date }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(fixedNow ?? new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [fixedNow]);
  if (!now) return <div className="skeleton h-20 max-w-md" aria-hidden />;
  const s = cutoffStatus(isoDate, now);
  if (s.state === 'passed') return <p className="display text-3xl" role="status">Cutoff passed</p>;
  const cells: [number, string][] = [[s.days, 'days'], [s.hours, 'hrs'], [s.minutes, 'min'], [s.seconds, 'sec']];
  return (
    <div className="flex gap-2" role="timer" aria-label={`${s.days} days, ${s.hours} hours and ${s.minutes} minutes left`}>
      {cells.map(([n, l]) => (<div key={l} className="min-w-16 rounded-lg bg-ink px-3 py-2 text-center text-paper"><span className="display block text-4xl tabular-nums">{String(n).padStart(2, '0')}</span><span className="text-xs uppercase tracking-widest text-sand">{l}</span></div>))}
    </div>
  );
}
