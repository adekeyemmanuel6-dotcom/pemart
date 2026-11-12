import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WORD_THEMES } from '@/lib/brand';
import { getCatalogue } from '@/lib/catalogue/load';
import { toCard } from '@/lib/catalogue/helpers';
import { ProductCard } from '@/components/product/product-card';
type Props = { params: Promise<{ slug: string }> };
const themeFor = (slug: string) =>
  WORD_THEMES.find((t) => t.toLowerCase().replaceAll(' ', '-') === decodeURIComponent(slug));
export function generateStaticParams() {
  return WORD_THEMES.map((t) => ({ slug: t.toLowerCase().replaceAll(' ', '-') }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = themeFor(slug);
  return {
    title: `${theme ?? 'Find your Word'} — Shop by message`,
    description: `Explore ${theme?.toLowerCase() ?? 'faith'} through meaningful Christian apparel and gifts from Wear The Word.`,
    alternates: { canonical: `/themes/${encodeURIComponent(slug)}` },
  };
}
export default async function ThemePage({ params }: Props) {
  const { slug } = await params;
  const theme = themeFor(slug);
  if (!theme) notFound();
  const cat = await getCatalogue();
  const products = cat.products.filter((p) => p.themes?.includes(theme));
  return (
    <section className="wtw-section">
      <Link href="/" className="wtw-text-link">
        ← Find your Word
      </Link>
      <p className="wtw-eyebrow mt-10">A message for your season</p>
      <h1 className="display mt-5 mb-10 text-7xl">{theme}</h1>
      {products.length ? (
        <ul className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard p={toCard(cat, p)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-y border-line py-10">
          <p>No pieces have been assigned to this message yet.</p>
          <Link href="/collections/all" className="wtw-text-link mt-4">
            Explore all available pieces →
          </Link>
        </div>
      )}
    </section>
  );
}
