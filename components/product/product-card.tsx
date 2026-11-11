'use client';
import Link from 'next/link';
import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { CardProduct } from '@/lib/catalogue/types';
import { colourHex } from '@/lib/colours';
import { formatNaira } from '@/lib/money';
import { ProductVisual } from './product-visual';

export function ProductCard({ p, colour, priority }: { p: CardProduct; colour?: string | null; priority?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const [backMounted, setBackMounted] = useState(false); // the back view is only rendered once someone asks for it (halves the DOM on listing pages)
  const flip = (v: boolean) => { if (v) setBackMounted(true); setFlipped(v); };
  const garment = p.type === 'tee' || p.type === 'hoodie';
  const shownColour = colour && p.colours.includes(colour) ? colour : p.colours.includes('Black') ? 'Black' : p.colours[0] ?? null;
  const common = { type: p.type, designSlug: p.designSlug, colour: shownColour, imageUrl: p.imageUrl, alt: p.name, priority } as const;
  return (
    <article className="group relative">
      <Link href={`/products/${p.slug}`} className="block" onMouseLeave={() => setFlipped(false)} onFocus={() => flip(true)} onBlur={() => setFlipped(false)}>
        <div className="relative overflow-hidden rounded-lg border border-line" onMouseEnter={() => garment && flip(true)}>
          <ProductVisual {...common} view="front" />
          {garment && backMounted && (
            <div className={`absolute inset-0 transition-opacity duration-200 ${flipped ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
              <ProductVisual {...common} view="back" />
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col items-start gap-1">
            {p.soldOut && <span className="rounded bg-ink px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-paper">Sold out</span>}
            {p.bundleable && !p.soldOut && <span className="rounded bg-mocha px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Bundle and save</span>}
          </div>
        </div>
        <h3 className="mt-3 text-base font-semibold leading-snug">{p.name}</h3>
        <p className="mt-0.5 text-base">
          {p.hasRange && <span className="text-muted">From </span>}
          <span className="font-semibold">{formatNaira(p.priceKobo)}</span>
          {p.compareAtKobo && p.compareAtKobo > p.priceKobo && <span className="ml-2 text-muted line-through">{formatNaira(p.compareAtKobo)}</span>}
        </p>
      </Link>
      {p.colours.length > 0 && (
        <ul className="mt-2 flex items-center gap-1.5" aria-label={`Colours: ${p.colours.join(', ')}`}>
          {p.colours.map((c) => (<li key={c} className="size-4 rounded-full border border-ink/20" style={{ background: colourHex(c) }} title={c} />))}
        </ul>
      )}
      {garment && (
        // Touch devices have no hover, so offer a tap target to flip between front and back.
        <button type="button" onClick={() => flip(!flipped)} aria-label={flipped ? 'Show front view' : 'Show back view'} aria-pressed={flipped}
          className="absolute right-2 top-2 hidden size-11 place-items-center rounded-full bg-paper/90 shadow [@media(hover:none)]:grid">
          <RotateCw className="size-5" aria-hidden />
        </button>
      )}
    </article>
  );
}
