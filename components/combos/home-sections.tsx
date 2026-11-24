import Image from 'next/image';
import Link from 'next/link';
import type { ComboSettings } from '@/lib/combos/schema';
import { UNAVAILABLE_PRICE, type ComboConfig } from '@/lib/combos/types';
import { listedCollections } from '@/lib/combos/pairs';
import { startingPrice } from '@/lib/combos/pricing';
import { formatNaira } from '@/lib/money';
import type { SiteCollection } from '@/lib/combos/structure';
import { ComboTrigger } from './combo-trigger';

const btn = 'inline-flex min-h-12 items-center justify-center rounded-btn px-7 text-sm font-semibold uppercase tracking-[0.14em] transition-colors';

/** Homepage: "Your Word. Your Style. Your Combo." One clear call to action, nothing that pops up uninvited. */
export function ComboCalculatorSection({ settings, collections, unavailable }: { settings: ComboSettings; collections: ComboConfig[]; unavailable: string[] }) {
  const c = settings.calculator; const off = new Set(unavailable);
  return (
    <section aria-labelledby="combo-calc-title" className="bg-[var(--wtw-ivory)] text-[var(--wtw-coal)]">
      <div className="mx-auto grid w-[min(100%,1400px)] gap-10 px-5 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--wtw-graphite)]">{c.kicker}</p>
          <h2 id="combo-calc-title" className="display mt-4 text-4xl sm:text-6xl">{c.headline}</h2>
          <p className="mt-5 max-w-xl text-lg text-[var(--wtw-graphite)]">{c.body}</p>
          <ComboTrigger className={`${btn} mt-8 bg-[var(--wtw-ember)] text-[var(--wtw-coal)] hover:bg-[var(--wtw-coal)] hover:text-[var(--wtw-ivory)]`}>{c.cta}</ComboTrigger>
        </div>
        {c.imageUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg"><Image src={c.imageUrl} alt={c.imageAlt} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" /></div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="Combo collections">
            {listedCollections(collections).slice(0, 3).map((x) => { const from = startingPrice(x, off); return (
              <li key={x.id} className="rounded-lg border border-[var(--wtw-stone)] bg-white/60 p-4">
                <p className="display text-2xl">{x.name}</p>{x.tagline && <p className="text-sm text-[var(--wtw-graphite)]">{x.tagline}</p>}
                <p className="mt-2 text-sm font-semibold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</p></li>); })}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Homepage: the brand story. */
export function ComboStorySection({ settings }: { settings: ComboSettings }) {
  const s = settings.story;
  return (
    <section aria-labelledby="combo-story-title" className="bg-[var(--wtw-coal)] text-[var(--wtw-ivory)]">
      <div className="mx-auto grid w-[min(100%,1400px)] gap-10 px-5 py-14 sm:px-10 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--wtw-stone)]">{s.kicker}</p>
          <h2 id="combo-story-title" className="display mt-4 max-w-3xl text-4xl sm:text-6xl">{s.headline}</h2>
          <div className="mt-6 max-w-xl space-y-4 text-lg text-[var(--wtw-ivory)]/85">{s.paragraphs.map((p, i) => (<p key={i}>{p}</p>))}</div>
          {s.closing && <p className="display mt-8 text-3xl text-[var(--wtw-ember)]">{s.closing}</p>}
          <Link href="/combos" className={`${btn} mt-8 border-2 border-[var(--wtw-ivory)] text-[var(--wtw-ivory)] hover:bg-[var(--wtw-ivory)] hover:text-[var(--wtw-coal)]`}>{s.cta}</Link>
        </div>
        {s.imageUrl && <div className="relative aspect-[4/5] overflow-hidden rounded-lg"><Image src={s.imageUrl} alt={s.imageAlt} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" /></div>}
      </div>
    </section>
  );
}

/** Homepage: the collections the site is built around (BEHOLD, ABIDE, THE DOER'S, COUPLES). */
export function ComboCollectionsSection({ settings, items }: { settings: ComboSettings; items: SiteCollection[] }) {
  const c = settings.collections;
  return (
    <section aria-labelledby="combo-collections-title" className="bg-white text-[var(--wtw-coal)]">
      <div className="mx-auto w-[min(100%,1400px)] px-5 py-14 sm:px-10 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--wtw-graphite)]">{c.kicker}</p>
        <h2 id="combo-collections-title" className="display mt-4 max-w-3xl text-4xl sm:text-6xl">{c.headline}</h2>
        {c.body && <p className="mt-4 max-w-2xl text-lg text-[var(--wtw-graphite)]">{c.body}</p>}
        <ul className={`mt-10 grid gap-5 ${items.length >= 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : items.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {items.map((x) => (
            <li key={x.key}>
              <Link href={x.href} className="group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--wtw-stone)] bg-[var(--wtw-ivory)] transition-colors hover:border-[var(--wtw-coal)]">
                <div className="relative aspect-[4/3] bg-[var(--wtw-coal)]">
                  {x.image ? <Image src={x.image} alt="" fill sizes="(min-width:1280px) 22vw, (min-width:640px) 45vw, 100vw" className="object-cover" /> : <span aria-hidden className="display absolute inset-0 grid place-items-center p-4 text-center text-3xl text-[var(--wtw-ivory)]">{x.name}</span>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="display text-2xl">{x.name}</h3>
                  {x.tagline && <p className="mt-1 text-sm text-[var(--wtw-graphite)]">{x.tagline}</p>}
                  <p className="mt-auto pt-3 text-sm font-semibold">{x.fromKobo === null ? UNAVAILABLE_PRICE : `From ${formatNaira(x.fromKobo)}`}</p>
                  <span className="mt-1 text-sm font-semibold uppercase tracking-[0.1em] underline-offset-4 group-hover:underline">{c.cta}</span>
                </div>
              </Link>
            </li>))}
        </ul>
      </div>
    </section>
  );
}
