import type { Metadata } from 'next';
import { BundleCard } from '@/components/product/bundle-card';
import { CoupleStarter } from '@/components/bundle/couple-starter';
import { bundleSeparateTotal, isBundleAvailable } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Couples',
  description: 'Two of Us: matching tees, hoodies and gift sets for couples. Choose his and hers sizes and a matching Pemart design.',
  alternates: { canonical: '/couples' },
};
const typeName: Record<string, string> = { tee: 'Tee', hoodie: 'Hoodie', frame: 'Frame', perfume: 'Perfume', jewellery: 'Necklace', bracelet: 'Bracelet', glasses: 'Glasses', fun: 'Orb ball' };

export default async function CouplesPage() {
  const cat = await getCatalogue();
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
        <p className="font-script text-3xl text-mocha">two are better than one</p>
        <h1 className="display text-5xl sm:text-7xl">Two of Us</h1>
        <p className="mt-3 text-lg text-muted">Matching pieces for the two of you. Pick a design, set his and hers sizes separately, and we pack the pair together.</p>
      </header>
      {designs.length > 0 && packages.length > 0 && (
        <section className="mb-16" aria-labelledby="start-h"><h2 id="start-h" className="display mb-6 text-3xl sm:text-4xl">Start here</h2><CoupleStarter designs={designs} packages={packages} /></section>
      )}
      <section aria-labelledby="pk-h">
        <h2 id="pk-h" className="display mb-6 text-3xl sm:text-4xl">All couple packages</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((b) => (<li key={b.slug}><BundleCard bundle={b} separateKobo={bundleSeparateTotal(cat, b)} contents={b.bundle_slots.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ''}${typeName[s.product_type] ?? s.label}`).join(' · ')} /></li>))}
        </ul>
      </section>
    </div>
  );
}
