import { ComingSoon } from '@/components/coming-soon';
import { getCatalogue } from '@/lib/catalogue/load';

export async function generateStaticParams() {
  return (await getCatalogue()).bundles.map((b) => ({ slug: b.slug }));
}

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = (await getCatalogue()).bundles.find((b) => b.slug === slug)?.name ?? 'Bundle';
  return <ComingSoon title={name} phase={3} note="The configurable bundle builder arrives in the next phase." />;
}
