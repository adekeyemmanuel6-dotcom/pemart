import 'server-only';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { resolveWebsite } from './schema';

export async function getWebsitePage(slug: string) {
  return resolveWebsite(await getSettings()).pages.find((p) => p.slug === slug && p.enabled);
}
export async function websitePageMetadata(slug: string, fallback: Metadata): Promise<Metadata> {
  const p = await getWebsitePage(slug);
  return p
    ? {
        ...fallback,
        title: p.title,
        description: p.seoDescription || p.intro || fallback.description,
        ...(p.image ? { openGraph: { title: p.title, images: [{ url: p.image, alt: p.alt }] } } : {}),
      }
    : fallback;
}
