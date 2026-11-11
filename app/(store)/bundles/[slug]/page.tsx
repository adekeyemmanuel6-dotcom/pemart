import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BundleBuilder } from '@/components/bundle/bundle-builder';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { Button } from '@/components/ui/button';
import { buildBundleContext } from '@/lib/bundles/selection';
import { getCatalogue } from '@/lib/catalogue/load';
import { publicEnv } from '@/lib/env';
import { formatNaira } from '@/lib/money';
import { getSettings } from '@/lib/settings';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 300;

export async function generateStaticParams() {
  return (await getCatalogue()).bundles.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = (await getCatalogue()).bundles.find((x) => x.slug === slug);
  if (!b) return {};
  return { title: b.name, description: b.description ?? undefined, alternates: { canonical: `/bundles/${slug}` }, openGraph: { title: `${b.name} | Pemart`, description: b.description ?? undefined, images: [{ url: `/og/bundle-${slug}`, width: 1200, height: 630 }] } };
}

export default async function BundlePage({ params }: Props) {
  const { slug } = await params;
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const bundle = cat.bundles.find((b) => b.slug === slug);
  if (!bundle) notFound();
  const ctx = buildBundleContext(cat, bundle);
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const saving = ctx.bundle.separateKobo - ctx.bundle.priceKobo;
  const hub = bundle.kind === 'couple' ? { href: '/couples', label: 'Couples' } : bundle.kind === 'gift_box' ? { href: '/gift-boxes', label: 'Gift Boxes' } : { href: '/collections/all', label: 'Shop' };

  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: bundle.name, description: bundle.description ?? undefined, brand: { '@type': 'Brand', name: 'Pemart' },
    offers: { '@type': 'Offer', priceCurrency: 'NGN', price: (bundle.price_kobo / 100).toFixed(2), availability: `https://schema.org/${ctx.bundle.available ? 'InStock' : 'Discontinued'}`, url: `${base}/bundles/${slug}` } };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name: hub.label, url: `${base}${hub.href}` }, { name: bundle.name, url: `${base}/bundles/${slug}` }])} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/" className="hover:underline">Home</Link> / <Link href={hub.href} className="hover:underline">{hub.label}</Link> / <span aria-current="page" className="text-ink">{bundle.name}</span></nav>
      <header className="mb-8 max-w-2xl">
        {bundle.badge && <p className="font-script text-2xl text-mocha">{bundle.badge.toLowerCase()}</p>}
        <h1 className="display text-5xl sm:text-7xl">{bundle.name}</h1>
        <p className="mt-3 text-lg text-muted">{bundle.description}</p>
        <p className="mt-3 text-2xl"><span className="font-bold">{formatNaira(bundle.price_kobo)}</span>{saving > 0 && <> <span className="text-lg text-muted line-through">{formatNaira(ctx.bundle.separateKobo)}</span> <span className="text-lg font-semibold text-mocha">Save {formatNaira(saving)}</span></>}</p>
      </header>

      {ctx.bundle.available ? (
        <Suspense fallback={<div className="skeleton h-96" />}><BundleBuilder ctx={ctx} giftWrapKobo={settings.gift_wrap_kobo} /></Suspense>
      ) : (
        <div className="rounded-lg border-2 border-ink p-8 text-center" role="status">
          <p className="display text-4xl">This one has ended</p>
          <p className="mx-auto mt-2 max-w-md text-muted">{bundle.name} was a seasonal gift box and the ordering window has closed. Ready-stock gifts and digital gift cards are always available.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/collections/accessories">Shop accessories</Link></Button><Button asChild variant="secondary"><Link href="/gift-cards">Buy a gift card</Link></Button></div>
        </div>
      )}
    </div>
  );
}
