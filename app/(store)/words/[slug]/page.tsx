import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComboTrigger } from '@/components/combos/combo-trigger';
import { JsonLd, breadcrumbLd } from '@/components/json-ld';
import { ProductCard } from '@/components/product/product-card';
import { getCatalogue } from '@/lib/catalogue/load';
import { listWords, wordGarments } from '@/lib/catalogue/words';
import { publicEnv } from '@/lib/env';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const design = (await getCatalogue()).designs.find((d) => d.slug === slug);
  if (!design) return {};
  const description = design.story_or_verse?.slice(0, 160) || `${design.name}: wear it as a T-shirt, sweatshirt or hoodie.`;
  return { title: design.name, description, alternates: { canonical: `/words/${slug}` }, openGraph: { title: `${design.name} | Wear The Word`, description } };
}

export default async function WordPage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCatalogue();
  const design = cat.designs.find((d) => d.slug === slug);
  const groups = design ? wordGarments(cat, design) : [];
  if (!design || groups.length === 0) notFound();
  const others = listWords(cat).filter((w) => w.design.id !== design.id).slice(0, 6);
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <JsonLd data={breadcrumbLd([{ name: 'Home', url: base }, { name: 'Shop by Word', url: `${base}/words` }, { name: design.name, url: `${base}/words/${slug}` }])} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/" className="hover:underline">Home</Link> / <Link href="/words" className="hover:underline">Shop by Word</Link> / <span aria-current="page">{design.name}</span></nav>
      <header className="mb-10 max-w-3xl">
        <h1 className="display text-5xl sm:text-7xl">{design.name}</h1>
        {design.verse_reference && <p className="mt-2 text-lg font-semibold">{design.verse_reference}</p>}
        {design.story_or_verse && <p className="mt-3 whitespace-pre-line text-lg text-muted">{design.story_or_verse}</p>}
        <nav aria-label="Garments" className="mt-5 flex flex-wrap gap-2">
          {groups.map((g) => (<a key={g.type} href={`#${g.type}`} className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-paper">{g.label}</a>))}
        </nav>
      </header>
      {groups.map((g) => (
        <section key={g.type} id={g.type} aria-labelledby={`g-${g.type}`} className="mb-12 scroll-mt-28">
          <h2 id={`g-${g.type}`} className="display mb-4 text-3xl sm:text-4xl">{g.label}</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {g.products.map((p) => (<li key={p.slug}><ProductCard p={p} /></li>))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="w-combo" className="mb-12 rounded-lg bg-[var(--wtw-ivory)] p-6 text-[var(--wtw-coal)] sm:p-8">
        <h2 id="w-combo" className="display text-3xl">Want more than a garment?</h2>
        <p className="mt-2 max-w-xl text-[var(--wtw-graphite)]">Build a combo with a framed Scripture print and the tools to live the Word, all around this word.</p>
        <ComboTrigger className="mt-4 inline-flex min-h-12 items-center rounded-btn bg-[var(--wtw-ember)] px-7 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--wtw-coal)] hover:bg-[var(--wtw-coal)] hover:text-[var(--wtw-ivory)]">Customize Your Combo</ComboTrigger>
      </section>
      {others.length > 0 && (
        <section aria-labelledby="w-more">
          <h2 id="w-more" className="display mb-3 text-2xl">More words</h2>
          <ul className="flex flex-wrap gap-2">{others.map((w) => (<li key={w.design.id}><Link href={`/words/${w.design.slug}`} className="inline-flex min-h-11 items-center rounded-btn border border-line px-4 text-sm font-semibold hover:border-ink">{w.design.name}</Link></li>))}</ul>
        </section>
      )}
    </div>
  );
}
