'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import type { SearchResult } from '@/lib/catalogue/search';
import { formatNaira } from '@/lib/money';
import type { ProductType } from '@/lib/catalogue/types';
import { ProductVisual } from '@/components/product/product-visual';

const POPULAR = ['hoodie', 'kingdom', 'couple', 'perfume', 'bracelet', 'frame'];

/** Instant results as you type. Debounced, cancels stale requests. */
export function SearchBox() {
  const initial = useSearchParams().get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const ctl = (abort.current = new AbortController());
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults(((await res.json()) as { results: SearchResult[] }).results);
        setError(false);
        window.history.replaceState(null, '', `/search?q=${encodeURIComponent(term)}`);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setError(true); setResults(null); }
      } finally { if (!ctl.signal.aborted) setLoading(false); }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="site-search" className="sr-only">Search Pemart</label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus autoComplete="off" placeholder="Search tees, hoodies, verses, gifts…"
          className="min-h-14 w-full rounded-btn border-2 border-ink bg-white pl-12 pr-4 text-lg focus-visible:border-denim" />
      </form>

      <div className="mt-6" aria-live="polite">
        {error && <p role="alert" className="rounded-lg border border-ember/40 bg-ember/10 p-4">Search hit a snag. Please try again in a moment.</p>}
        {loading && !results && <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => (<div key={i} className="skeleton h-20" />))}</div>}
        {results && results.length === 0 && (
          <div className="rounded-lg border border-dashed border-line p-8 text-center">
            <p className="display text-3xl">No matches for &ldquo;{q.trim()}&rdquo;</p>
            <p className="mt-2 text-muted">Try a simpler word, or browse everything.</p>
            <Link href="/collections/all" className="mt-4 inline-block font-semibold underline underline-offset-4">Shop all</Link>
          </div>
        )}
        {results && results.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {results.map((r) => (
              <li key={`${r.kind}-${r.slug}`}>
                <Link href={r.href} className="flex min-h-20 items-center gap-4 p-3 hover:bg-sand/40">
                  {r.kind === 'product' && r.type ? (
                    <div className="w-16 shrink-0 overflow-hidden rounded-md"><ProductVisual type={r.type as ProductType} designSlug={r.designSlug} colour="Black" imageUrl={r.imageUrl} alt="" sizes="64px" /></div>
                  ) : (<div className="display grid size-16 shrink-0 place-items-center rounded-md bg-ink text-xl text-paper" aria-hidden>{r.name.slice(0, 1)}</div>)}
                  <div className="min-w-0"><p className="font-semibold">{r.name}</p><p className="text-sm text-muted">{r.kind === 'collection' ? 'Collection' : r.priceKobo !== null ? formatNaira(r.priceKobo) : ''}</p></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!results && !loading && !error && (
          <div><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Popular searches</p>
            <ul className="flex flex-wrap gap-2">{POPULAR.map((t) => (<li key={t}><button type="button" onClick={() => setQ(t)} className="min-h-11 rounded-full bg-sand px-4 text-sm font-semibold hover:bg-line">{t}</button></li>))}</ul></div>
        )}
      </div>
    </div>
  );
}
