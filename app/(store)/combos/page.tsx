import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ComboTrigger } from '@/components/combos/combo-trigger';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { startingPrice } from '@/lib/combos/pricing';
import { getComboCatalogue, getComboSettings } from '@/lib/combos/server';
import { UNAVAILABLE_PRICE } from '@/lib/combos/types';
import { publicEnv } from '@/lib/env';
import { formatNaira } from '@/lib/money';

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  const s = await getComboSettings();
  return { title: s.page.headline, description: s.page.intro, alternates: { canonical: '/combos' } };
}

export default async function CombosPage() {
  const [cat, s] = await Promise.all([getComboCatalogue(), getComboSettings()]);
  const base = publicEnv.NEXT_PUBLIC_SITE_URL; const off = new Set(cat.unavailable);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name: s.page.headline, url: `${base}/combos` }])} />
      <header className="mb-8 max-w-2xl"><h1 className="display text-5xl sm:text-7xl">{s.page.headline}</h1><p className="mt-3 text-lg text-muted">{s.page.intro}</p></header>
      {cat.collections.length === 0 ? (<p className="rounded-lg border border-dashed border-line p-8 text-center text-muted">Our combo collections are coming soon.</p>) : (
        <ul className="grid gap-6 md:grid-cols-3">
          {cat.collections.map((c) => { const from = startingPrice(c, off); return (
            <li key={c.id} className="flex flex-col rounded-lg border border-line bg-sand/40">
              {c.image_url && <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg"><Image src={c.image_url} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" /></div>}
              <div className="flex flex-1 flex-col p-5">
                {c.label && <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{c.label}</p>}
                <h2 className="display text-3xl"><Link href={`/combos/${c.slug}`} className="hover:underline">{c.name}</Link></h2>
                {c.tagline && <p className="mt-1 text-muted">{c.tagline}</p>}
                <p className="mt-3 font-bold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <ComboTrigger slug={c.slug} className="inline-flex min-h-11 items-center rounded-btn bg-ink px-5 text-sm font-semibold uppercase tracking-[0.08em] text-paper hover:bg-ink/85">Customize &amp; Calculate Price</ComboTrigger>
                  <Link href={`/combos/${c.slug}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4">Details</Link></div>
              </div></li>); })}
        </ul>)}
    </div>
  );
}
