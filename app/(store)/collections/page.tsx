import type { Metadata } from 'next';
import { BRAND_COLLECTIONS, brandProducts } from '@/lib/brand';
import { getCatalogue } from '@/lib/catalogue/load';
import { CollectionEditorial } from '@/components/collection-editorial';
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Explore the Identity, Declaration, Scripture, Together and Word Gift collections from Wear The Word.',
  alternates: { canonical: '/collections' },
};
export default async function CollectionsPage() {
  const cat = await getCatalogue();
  return (
    <section className="wtw-section">
      <p className="wtw-eyebrow">A Word for every season</p>
      <h1 className="display mt-6 mb-12 text-6xl sm:text-8xl">The collections.</h1>
      <div className="wtw-collection-grid">
        {BRAND_COLLECTIONS.map((c, i) => (
          <CollectionEditorial
            key={c.slug}
            collection={c}
            index={i}
            image={
              cat.collections.find((x) => x.slug === c.slug)?.hero_image ||
              brandProducts(cat, c.slug)[0]?.product_images[0]?.url ||
              null
            }
          />
        ))}
      </div>
    </section>
  );
}
