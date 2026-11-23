import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComboTrigger } from '@/components/combos/combo-trigger';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { editions } from '@/lib/combos/pairs';
import { startingPrice } from '@/lib/combos/pricing';
import { getComboBySlug, getComboCatalogue } from '@/lib/combos/server';
import { UNAVAILABLE_PRICE } from '@/lib/combos/types';
import { publicEnv } from '@/lib/env';
import { formatNaira } from '@/lib/money';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getComboBySlug((await params).slug);
  if (!found) return {};
  const { config: c } = found;
  const description = c.description ?? c.tagline ?? undefined;
  return { title: c.name, description, alternates: { canonical: `/combos/${c.slug}` }, openGraph: { title: `${c.name} | Wear The Word`, description, ...(c.image_url ? { images: [{ url: c.image_url }] } : {}) } };
}

export default async function ComboPage({ params }: Props) {
  const { slug } = await params;
  const found = await getComboBySlug(slug);
  if (!found) notFound();
  const { config: c, unavailable } = found;
  const ed = editions((await getComboCatalogue()).collections, c);
  const other = ed ? (c.pair_of ? ed.single : ed.couples) : null;
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const from = startingPrice(c, new Set(unavailable));
  const slots = c.slots.filter((s) => s.mode !== 'unavailable').sort((a, b) => a.sort_order - b.sort_order);
  // Structured data only claims a price when a real one exists. No price: no offer.
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: c.name, description: c.description ?? undefined, brand: { '@type': 'Brand', name: 'Pemart' }, ...(c.image_url ? { image: c.image_url } : {}),
    ...(from !== null ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'NGN', lowPrice: (from / 100).toFixed(2), availability: 'https://schema.org/InStock', url: `${base}/combos/${c.slug}` } } : {}) };
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name: 'Combos', url: `${base}/combos` }, { name: c.name, url: `${base}/combos/${c.slug}` }])} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/" className="hover:underline">Home</Link> / <Link href="/combos" className="hover:underline">Combos</Link> / <span aria-current="page">{c.name}</span></nav>
      <div className="grid gap-8 lg:grid-cols-2">
        {c.image_url && <div className="relative aspect-[4/3] overflow-hidden rounded-lg"><Image src={c.image_url} alt="" fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" /></div>}
        <div className={c.image_url ? '' : 'max-w-2xl lg:col-span-2'}>
          {c.label && <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{c.label}</p>}
          <h1 className="display text-5xl sm:text-7xl">{c.name}</h1>
          {c.tagline && <p className="mt-2 text-xl">{c.tagline}</p>}
          {(c.scripture_ref || c.scripture_text) && <p className="mt-3 italic text-muted">{c.scripture_text ? `“${c.scripture_text}” ` : ''}{c.scripture_ref}</p>}
          {c.description && <p className="mt-4 text-lg text-muted">{c.description}</p>}
          <p className="mt-5 text-2xl font-bold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</p>
          <ComboTrigger slug={c.slug} className="mt-5 inline-flex min-h-12 items-center rounded-btn bg-[var(--wtw-ember)] px-7 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--wtw-coal)] hover:bg-ink hover:text-paper">Customize &amp; Calculate Price</ComboTrigger>
          {other && <p className="mt-4 text-sm">{c.pair_of ? 'Just for you? ' : 'Making it a pair? '}<Link href={`/combos/${other.slug}`} className="font-semibold underline underline-offset-4">{c.pair_of ? 'See the single edition' : 'See the couples edition (2 garments)'}</Link></p>}
          <h2 className="display mt-8 text-2xl">What is in this combo</h2>
          <ul className="mt-2 space-y-2">
            {slots.map((s) => (<li key={s.id} className="rounded-lg border border-line p-3">
              {s.kind === 'garment' && (<><strong>{s.quantity > 1 ? `${s.quantity} garments, one for each of you` : s.label}</strong>: choose {s.components.map((x) => x.name).join(', ')}{s.quantity > 1 ? ' for each' : ''}.</>)}
              {s.kind === 'frame' && (<><strong>{s.quantity} × {s.label}</strong>{s.components[0] && <>, in {s.components[0].options.filter((o) => o.group === 'frame_size').map((o) => o.label).join(' or ')}</>}. Each with your own Scripture.</>)}
              {s.kind === 'item' && (<><strong>{s.components[0]?.name ?? s.label}</strong>{s.quantity > 1 ? ` × ${s.quantity}` : ''}{s.mode === 'optional' ? ' (optional add-on)' : ' (included)'}{s.components[0]?.description ? ` · ${s.components[0].description}` : ''}</>)}
            </li>))}
          </ul>
          <p className="mt-6 text-sm text-muted">Made to order. Customised pieces are final sale once production starts.</p>
        </div>
      </div>
    </div>
  );
}
