import type { Metadata } from 'next';
import { BundleCard } from '@/components/product/bundle-card';
import { CoupleStarter } from '@/components/bundle/couple-starter';
import { bundleSeparateTotal, isBundleAvailable } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';
import Image from 'next/image';
import Link from 'next/link';
import { ComboTrigger } from '@/components/combos/combo-trigger';
import { startingPrice } from '@/lib/combos/pricing';
import { getComboCatalogue, getComboSettings } from '@/lib/combos/server';
import { UNAVAILABLE_PRICE } from '@/lib/combos/types';
import { formatNaira } from '@/lib/money';

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const s = await getComboSettings();
  return {
    title: s.collections.couplesName,
    description: 'The Couples Collection: two garments, one for each of you, with the frames and tools of Behold, Abide and The Doer’s. Choose each person’s garment, colour and size.',
    alternates: { canonical: '/couples' },
  };
}
const typeName: Record<string, string> = { tee: 'Tee', hoodie: 'Hoodie', frame: 'Frame', perfume: 'Perfume', jewellery: 'Necklace', bracelet: 'Bracelet', glasses: 'Glasses', fun: 'Orb ball' };

export default async function CouplesPage() {
  const [cat, combos, settings] = await Promise.all([getCatalogue(), getComboCatalogue(), getComboSettings()]);
  const editions = combos.collections.filter((c) => c.pair_of);
  const off = new Set(combos.unavailable);
  const collection = cat.collections.find((c) => c.slug === 'two-of-us');
  const designs = cat.designs.filter((d) => d.collection_id === collection?.id).map((d) => ({ slug: d.slug, name: d.name }));
  const bundles = cat.bundles.filter((b) => (b.kind === 'couple' || b.slug === 'couples-christmas-box') && isBundleAvailable(b));
  const packages = bundles.filter((b) => b.kind === 'couple').map((b) => ({
    slug: b.slug, name: b.name, priceKobo: b.price_kobo, garment: (b.bundle_slots.some((s) => s.product_type === 'hoodie') ? 'hoodie' : 'tee') as 'tee' | 'hoodie',
    blurb: b.bundle_slots.map((s) => typeName[s.product_type] ?? s.label).join(' + '),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <h1 className="display text-5xl sm:text-7xl">{editions.length > 0 ? settings.collections.couplesName : 'Two of Us'}</h1>
        <p className="mt-3 text-lg text-muted">{editions.length > 0 ? settings.collections.couplesTagline : 'Matching pieces for the two of you. Pick a design, set his and hers sizes separately, and we pack the pair together.'}</p>
      </header>
      {editions.length > 0 && (
        <section className="mb-16" aria-labelledby="couples-editions-h">
          <h2 id="couples-editions-h" className="sr-only">The couples editions</h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {editions.map((c) => { const from = startingPrice(c, off); return (
              <li key={c.id} className="flex flex-col rounded-lg border border-line bg-sand/40">
                {c.image_url && <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg"><Image src={c.image_url} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" /></div>}
                <div className="flex flex-1 flex-col p-5">
                  {c.label && <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{c.label}</p>}
                  <h3 className="display text-3xl"><Link href={`/combos/${c.slug}`} className="hover:underline">{c.name}</Link></h3>
                  {c.tagline && <p className="mt-1 text-muted">{c.tagline}</p>}
                  <p className="mt-2 text-sm text-muted">2 garments, one for each of you</p>
                  <p className="mt-2 font-bold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <ComboTrigger slug={c.slug} className="inline-flex min-h-11 items-center rounded-btn bg-ink px-5 text-sm font-semibold uppercase tracking-[0.08em] text-paper hover:bg-ink/85">Customize &amp; Calculate Price</ComboTrigger>
                    <Link href={`/combos/${c.slug}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4">Details</Link></div>
                </div></li>); })}
          </ul>
        </section>
      )}
      {designs.length > 0 && packages.length > 0 && (
        <section className="mb-16" aria-labelledby="start-h"><h2 id="start-h" className="display mb-6 text-3xl sm:text-4xl">Start here</h2><CoupleStarter designs={designs} packages={packages} /></section>
      )}
      <section aria-labelledby="pk-h">
        <h2 id="pk-h" className="display mb-6 text-3xl sm:text-4xl">{editions.length > 0 ? 'More for couples' : 'All couple packages'}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((b) => (<li key={b.slug}><BundleCard bundle={b} separateKobo={bundleSeparateTotal(cat, b)} contents={b.bundle_slots.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ''}${typeName[s.product_type] ?? s.label}`).join(' · ')} /></li>))}
        </ul>
      </section>
    </div>
  );
}
