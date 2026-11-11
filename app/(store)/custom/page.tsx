import type { Metadata } from 'next';
import { Studio } from '@/components/studio/studio';
import { getCatalogue } from '@/lib/catalogue/load';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Design Your Own',
  description: 'Make it yours: personalise a Pemart design, type your own words, or send us a full custom idea. Live preview, proof in 12 to 48 hours.',
  alternates: { canonical: '/custom' },
};

export default async function CustomPage() {
  const cat = await getCatalogue();
  const designs = cat.designs.filter((d) => d.is_customisable).map((d) => ({ slug: d.slug, name: d.name, fields: d.customisable_fields ?? ['name'] }));
  const base = (t: string) => cat.products.find((p) => p.type === t)?.base_price_kobo ?? 0;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <p className="font-script text-3xl text-mocha">make it yours</p>
        <h1 className="display text-5xl sm:text-7xl">Design your own</h1>
        <p className="mt-3 text-lg text-muted">Pick a lane, watch it come to life on the garment, and pay upfront. We send a proof to approve before anything is printed. <strong className="text-ink">Your 5-day delivery clock starts when you approve it.</strong></p>
      </header>
      <Studio designs={designs} basePrices={{ tee: base('tee'), hoodie: base('hoodie') }} />
    </div>
  );
}
