import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { ProductVisual } from '@/components/product/product-visual';
import { getCatalogue } from '@/lib/catalogue/load';
import { listWords } from '@/lib/catalogue/words';
import { publicEnv } from '@/lib/env';
import { formatNaira } from '@/lib/money';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Shop by Word',
  description: 'Choose the Word you want to wear. Every word comes as a T-shirt, sweatshirt and hoodie, in every colour and size.',
  alternates: { canonical: '/words' },
};

export default async function WordsPage() {
  const words = listWords(await getCatalogue());
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name: 'Shop by Word', url: `${base}/words` }])} />
      <header className="mb-8 max-w-2xl">
        <h1 className="display text-5xl sm:text-7xl">Shop by Word</h1>
        <p className="mt-3 text-lg text-muted">Choose the Word you want to wear. Each one comes as a T-shirt, sweatshirt and hoodie, in every colour and size.</p>
      </header>
      {words.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-muted">Our words are coming soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
          {words.map(({ design, count, fromKobo, cover }) => (
            <li key={design.id}>
              <Link href={`/words/${design.slug}`} className="block">
                <div className="overflow-hidden rounded-lg border border-line">
                  <ProductVisual type={cover.type} designSlug={cover.designSlug} colour={cover.colours[0] ?? null} imageUrl={cover.imageUrl} alt={`${design.name}`} />
                </div>
                <h2 className="mt-3 text-base font-semibold leading-snug">{design.name}</h2>
                {design.verse_reference && <p className="text-sm text-muted">{design.verse_reference}</p>}
                <p className="mt-0.5 text-sm">{count} {count === 1 ? 'garment' : 'garments'} · from <span className="font-semibold">{formatNaira(fromKobo)}</span></p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
