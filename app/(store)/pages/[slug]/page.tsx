import { notFound } from 'next/navigation';
import { getWebsitePage } from '@/lib/website/server';
import { WebsitePageView } from '@/components/website-page';
import { EXISTING_PAGES } from '@/lib/website/schema';
export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getWebsitePage(slug);
  return page
    ? { title: page.title, description: page.seoDescription || page.intro, alternates: { canonical: `/pages/${slug}` } }
    : {};
}
export default async function CustomWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if ((EXISTING_PAGES as readonly string[]).includes(slug)) notFound();
  const page = await getWebsitePage(slug);
  if (!page) notFound();
  return <WebsitePageView page={page} />;
}
