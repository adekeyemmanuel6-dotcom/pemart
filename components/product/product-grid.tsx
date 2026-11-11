'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { CardProduct, ProductType } from '@/lib/catalogue/types';
import { PRICE_BANDS, PRODUCT_TYPE_LABELS, filterCards, sortCards, sortSizes, type PriceBand, type SortKey } from '@/lib/catalogue/helpers';
import { colourHex } from '@/lib/colours';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ProductCard } from './product-card';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' }, { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' }, { value: 'price-desc', label: 'Price: high to low' },
];
const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 8 }, (_, i) => (<div key={i}><div className="skeleton aspect-[4/5]" /><div className="skeleton mt-3 h-5 w-3/4" /><div className="skeleton mt-2 h-5 w-1/3" /></div>))}
    </div>
  );
}

/** Filters and sort live in the URL (shareable, back-button friendly) while the page itself stays statically generated. */
export function ProductGrid({ products }: { products: CardProduct[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = csv(sp.get('type')) as ProductType[];
  const colour = csv(sp.get('colour'));
  const size = csv(sp.get('size'));
  const price = (sp.get('price') as PriceBand | null) ?? null;
  const sort = (SORTS.some((s) => s.value === sp.get('sort')) ? sp.get('sort') : 'featured') as SortKey;

  const facets = useMemo(() => ({
    types: [...new Set(products.map((p) => p.type))],
    colours: [...new Set(products.flatMap((p) => p.colours))],
    sizes: sortSizes([...new Set(products.flatMap((p) => p.sizes))]),
  }), [products]);

  const visible = useMemo(() => sortCards(filterCards(products, { type, colour, size, price }), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, sp]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const toggle = (key: string, current: string[], v: string) => setParam(key, (current.includes(v) ? current.filter((x) => x !== v) : [...current, v]).join(',') || null);
  const clear = () => router.replace(pathname, { scroll: false });
  const activeCount = type.length + colour.length + size.length + (price ? 1 : 0);

  const chip = (on: boolean) => `inline-flex min-h-11 items-center gap-2 rounded-btn border px-3 text-sm font-semibold transition-colors ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink'}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 border-y border-line py-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm"><SlidersHorizontal className="size-4" aria-hidden />Filter{activeCount ? ` (${activeCount})` : ''}</Button>
          </SheetTrigger>
          <SheetContent title="Filter">
            <div className="space-y-7 p-5">
              <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Product type</legend>
                <div className="flex flex-wrap gap-2">{facets.types.map((t) => (<button key={t} type="button" aria-pressed={type.includes(t)} className={chip(type.includes(t))} onClick={() => toggle('type', type, t)}>{PRODUCT_TYPE_LABELS[t]}</button>))}</div></fieldset>
              {facets.colours.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Colour</legend>
                <div className="flex flex-wrap gap-2">{facets.colours.map((c) => (<button key={c} type="button" aria-pressed={colour.includes(c)} className={chip(colour.includes(c))} onClick={() => toggle('colour', colour, c)}><span className="size-4 rounded-full border border-paper/40" style={{ background: colourHex(c) }} aria-hidden />{c}</button>))}</div></fieldset>}
              {facets.sizes.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Size</legend>
                <div className="flex flex-wrap gap-2">{facets.sizes.map((s) => (<button key={s} type="button" aria-pressed={size.includes(s)} className={`${chip(size.includes(s))} min-w-12 justify-center`} onClick={() => toggle('size', size, s)}>{s}</button>))}</div></fieldset>}
              <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Price</legend>
                <div className="flex flex-wrap gap-2">{(Object.keys(PRICE_BANDS) as PriceBand[]).map((b) => (<button key={b} type="button" aria-pressed={price === b} className={chip(price === b)} onClick={() => setParam('price', price === b ? null : b)}>{PRICE_BANDS[b].label}</button>))}</div></fieldset>
            </div>
            <div className="sticky bottom-0 flex gap-3 border-t border-line bg-paper p-4">
              <Button variant="secondary" className="flex-1" onClick={clear} disabled={!activeCount}>Clear all</Button>
              <SheetClose asChild><Button className="flex-1">Show {visible.length} {visible.length === 1 ? 'item' : 'items'}</Button></SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'featured' ? null : e.target.value)} className="min-h-11 rounded-btn border border-line bg-white px-3 text-base">
            {SORTS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </label>
        <p className="w-full text-sm text-muted sm:w-auto" role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'product' : 'products'}</p>
      </div>

      {activeCount > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2" aria-label="Active filters">
          {[...type.map((t) => ({ k: 'type', cur: type, v: t, label: PRODUCT_TYPE_LABELS[t] })), ...colour.map((v) => ({ k: 'colour', cur: colour, v, label: v })), ...size.map((v) => ({ k: 'size', cur: size, v, label: `Size ${v}` }))].map((f) => (
            <li key={`${f.k}-${f.v}`}><button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sand px-3 text-sm font-semibold" onClick={() => toggle(f.k, f.cur, f.v)} aria-label={`Remove filter ${f.label}`}>{f.label}<X className="size-4" aria-hidden /></button></li>
          ))}
          {price && <li><button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sand px-3 text-sm font-semibold" onClick={() => setParam('price', null)} aria-label="Remove price filter">{PRICE_BANDS[price].label}<X className="size-4" aria-hidden /></button></li>}
        </ul>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center">
          <p className="display text-3xl">Nothing matches that</p>
          <p className="mt-2 text-muted">Try removing a filter or two.</p>
          <Button className="mt-6" onClick={clear}>Clear filters</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p, i) => (<li key={p.slug}><ProductCard p={p} colour={colour[0]} priority={i < 4} /></li>))}
        </ul>
      )}
    </div>
  );
}
