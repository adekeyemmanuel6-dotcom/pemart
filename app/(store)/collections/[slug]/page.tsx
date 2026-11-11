import { ComingSoon } from '@/components/coming-soon';
import { COLLECTION_LINKS } from '@/lib/site';

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = COLLECTION_LINKS.find((c) => c.slug === slug)?.name ?? (slug === 'all' ? 'Shop All' : 'Collection');
  return <ComingSoon title={name} phase={2} />;
}
