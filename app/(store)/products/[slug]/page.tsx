import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalogue } from '@/lib/catalogue/load';
import { availableQty, bundleSeparateTotal, isSoldOut, productBySlug, relatedProducts, suggestedBundle, toCard, variantPrice } from '@/lib/catalogue/helpers';
import { getProductReviews } from '@/lib/reviews';
import { publicEnv } from '@/lib/env';
import { ProductView, type ViewBundle, type ViewProduct } from '@/components/product/product-view';
import { ProductCard } from '@/components/product/product-card';
import { Reviews } from '@/components/product/reviews';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 300;

export async function generateStaticParams() {
  return (await getCatalogue()).products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = productBySlug(await getCatalogue(), slug);
  if (!p) return {};
  const title = p.seo_title ?? p.name;
  const description = p.seo_description ?? p.description?.slice(0, 160) ?? undefined;
  return { title, description, alternates: { canonical: `/products/${slug}` }, openGraph: { title: `${title} | Pemart`, description, type: 'website', images: [{ url: `/og/${slug}`, width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', images: [`/og/${slug}`] } };
}

const OPTION_LABEL: Record<string, string> = { frame: 'Frame', perfume: 'Scent', bracelet: 'Style', jewellery: 'Style', glasses: 'Frame', fun: 'Colour', gift_card: 'Amount' };
const TYPE_NAME: Record<string, string> = { tee: 'Tee', hoodie: 'Hoodie', frame: 'Frame', perfume: 'Perfume', jewellery: 'Necklace', bracelet: 'Bracelet', glasses: 'Glasses', fun: 'Orb ball' };

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCatalogue();
  const p = productBySlug(cat, slug);
  if (!p) notFound();

  const design = p.design_id ? cat.designs.find((d) => d.id === p.design_id) : undefined;
  const collection = cat.collections.find((c) => c.id === p.collection_id);
  const reviews = await getProductReviews(p.id);
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;

  const real = p.product_images.filter((i) => !i.url.startsWith('/placeholders/') && !i.url.startsWith('/designs/'));
  const view: ViewProduct = {
    id: p.id, slug: p.slug, name: p.name, type: p.type, designSlug: design?.slug ?? null,
    compareAtKobo: p.compare_at_kobo, madeToOrder: p.is_made_to_order, optionLabel: OPTION_LABEL[p.type] ?? 'Style',
    images: p.design_id && !real.length ? [] : (real.length ? real : p.product_images).map((i) => ({ url: i.url, alt: i.alt || p.name })),
    variants: p.product_variants.map((v) => ({ id: v.id, colour: v.colour, size: v.size, option: v.option, group: v.option_group, priceKobo: variantPrice(p, v), soldOut: isSoldOut(v), lowStock: availableQty(v) })),
  };

  const sb = suggestedBundle(cat, p);
  const bundle: ViewBundle | null = sb ? {
    slug: sb.slug, name: sb.name, priceKobo: sb.price_kobo, separateKobo: bundleSeparateTotal(cat, sb, p),
    contents: sb.bundle_slots.map((s) => TYPE_NAME[s.product_type] ?? s.label),
  } : null;
  const zones = cat.zones.map((z) => ({ name: z.name, states: z.states, feeKobo: z.fee_kobo, leadDays: z.lead_days }));
  const related = relatedProducts(cat, p).map((r) => toCard(cat, r));

  const prices = view.variants.map((v) => v.priceKobo);
  const inStock = view.variants.some((v) => !v.soldOut);
  const offerBase = { '@type': 'Offer', priceCurrency: 'NGN', availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`, url: `${base}/products/${p.slug}` };
  const lowPrice = Math.min(...prices), highPrice = Math.max(...prices);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description ?? undefined, sku: p.product_variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'Pemart' }, image: [`${base}/og/${p.slug}`],
    offers: lowPrice === highPrice ? { ...offerBase, price: (lowPrice / 100).toFixed(2) }
      : { '@type': 'AggregateOffer', priceCurrency: 'NGN', lowPrice: (lowPrice / 100).toFixed(2), highPrice: (highPrice / 100).toFixed(2), offerCount: view.variants.length, availability: offerBase.availability },
    ...(reviews.length ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } } : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 md:pb-12">
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, ...(collection ? [{ name: collection.name, url: `${base}/collections/${collection.slug}` }] : []), { name: p.name, url: `${base}/products/${p.slug}` }])} />
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
        <Link href="/" className="hover:underline">Home</Link> / {collection && <><Link href={`/collections/${collection.slug}`} className="hover:underline">{collection.name}</Link> / </>}<span aria-current="page" className="text-ink">{p.name}</span>
      </nav>

      <ProductView product={view} bundle={bundle} zones={zones}>
        <div className="space-y-4 pt-2">
          {design?.story_or_verse && (
            <section className="rounded-lg bg-ink p-6 text-paper" aria-labelledby="story-h">
              <h2 id="story-h" className="font-script text-2xl text-sand">the story behind it</h2>
              <blockquote className="mt-2 text-lg leading-relaxed">&ldquo;{design.story_or_verse}&rdquo;</blockquote>
              {design.verse_reference && <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-sand">{design.verse_reference} (KJV)</p>}
            </section>
          )}
          <details className="group rounded-lg border border-line bg-white p-5" open>
            <summary className="cursor-pointer list-none text-lg font-semibold">Description</summary>
            <p className="mt-3 text-muted">{p.description}</p>
          </details>
          <details className="group rounded-lg border border-line bg-white p-5">
            <summary className="cursor-pointer list-none text-lg font-semibold">Fabric and care</summary>
            <p className="mt-3 text-muted">{p.type === 'tee' ? 'Heavyweight 100% cotton jersey, pre-shrunk. ' : p.type === 'hoodie' ? 'Heavy cotton-rich fleece with a soft brushed inside. ' : ''}{p.care}</p>
          </details>
          <details className="group rounded-lg border border-line bg-white p-5">
            <summary className="cursor-pointer list-none text-lg font-semibold">Delivery and returns</summary>
            <p className="mt-3 text-muted">{p.is_made_to_order ? 'Made to order and delivered within 5 days of payment. ' : 'In stock and delivered within 5 days of payment. '}Unworn, unwashed ready designs can be exchanged for another size within 7 days. See <Link href="/returns" className="underline">Returns and Exchanges</Link>.</p>
          </details>
        </div>
      </ProductView>

      <Reviews reviews={reviews} productName={p.name} />

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="mt-16">
          <h2 id="related-h" className="display mb-6 text-4xl">You might also like</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{related.map((r) => (<li key={r.slug}><ProductCard p={r} /></li>))}</ul>
        </section>
      )}
    </div>
  );
}
