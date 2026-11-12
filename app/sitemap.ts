import { BRAND_COLLECTIONS, WORD_THEMES } from '@/lib/brand';
import type { MetadataRoute } from 'next';
import { getCatalogue } from '@/lib/catalogue/load';
import { isBundleAvailable } from '@/lib/catalogue/helpers';
import { publicEnv } from '@/lib/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const cat = await getCatalogue();
  const fixed = ['', '/collections', ...BRAND_COLLECTIONS.filter((b) => !cat.collections.some((c) => c.slug === b.slug)).map((b) => '/collections/' + b.slug), ...WORD_THEMES.map((t) => '/themes/' + encodeURIComponent(t.toLowerCase().replaceAll(' ', '-'))), '/collections/all', '/gift-boxes', '/couples', '/custom', '/bulk', '/gift-cards', '/about', '/delivery', '/returns', '/size-guide', '/faq', '/contact', '/privacy', '/terms'];
  return [
    ...fixed.map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...cat.collections.map((c) => ({ url: `${base}/collections/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...cat.products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...cat.bundles.filter((b) => isBundleAvailable(b)).map((b) => ({ url: `${base}/bundles/${b.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
