import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCatalogue } from '@/lib/catalogue/load';
import { collectionProducts, toCard } from '@/lib/catalogue/helpers';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { publicEnv } from '@/lib/env';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const cat = await getCatalogue();
  return [{ slug: 'all' }, ...cat.collections.map((c) => ({ slug: c.slug }))];
}
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { collection } = collectionProducts(await getCatalogue(), slug);
  const title = slug === 'all' ? 'Shop all' : collection?.name ?? 'Collection';
  const description = collection?.intro ?? 'Faith-inspired tees, hoodies, frames, accessories and gift boxes from Pemart. Made to order in Nigeria.';
  return { title, description, alternates: { canonical: `/collections/${slug}` }, openGraph: { title: `${title} | Pemart`, description, images: [{ url: '/og/pemart', width: 1200, height: 630, alt: title }] } };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCatalogue();
  const { collection, products } = collectionProducts(cat, slug);
  if (slug !== 'all' && !collection) notFound();
  const name = collection?.name ?? 'Shop all';
  const intro = collection?.intro ?? 'Everything Pemart, in one place. Ready designs, accessories and gifts. Filter by type, colour, size or price.';
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name, url: `${base}/collections/${slug}` }])} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/" className="hover:underline">Home</Link> / <span aria-current="page" className="text-ink">{name}</span></nav>
      <header className="mb-8 max-w-2xl">
        {collection?.is_seasonal && <p className="font-script text-2xl text-mocha">limited season</p>}
        <h1 className="display text-5xl sm:text-7xl">{name}</h1>
        <p className="mt-3 text-lg text-muted">{intro}</p>
      </header>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid products={products.map((p) => toCard(cat, p))} />
      </Suspense>
    </div>
  );
}
