'use client';
import type { ReactNode } from 'react';
import { useCalculator } from '@/lib/combos/calculator-store';

/** Opens the combo calculator (optionally on one collection). A button, because it opens a dialog; it is not a link. */
export function ComboTrigger({ slug, className, children }: { slug?: string; className?: string; children: ReactNode }) {
  const show = useCalculator((s) => s.show);
  return (<button type="button" aria-haspopup="dialog" onClick={() => show(slug ?? null)} className={className}>{children}</button>);
}
