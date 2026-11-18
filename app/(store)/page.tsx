import { getCatalogue } from '@/lib/catalogue/load';
import { getSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import { WebsiteHome } from '@/components/website-home';
import { getComboCatalogue, getComboSettings } from '@/lib/combos/server';
export const revalidate = 300;
export async function generateMetadata() {
  const { brand } = resolveWebsite(await getSettings());
  return {
    title: { absolute: brand.seoTitle },
    description: brand.seoDescription,
    alternates: { canonical: '/' },
    openGraph: {
      title: brand.seoTitle,
      description: brand.seoDescription,
      ...(brand.ogImage ? { images: [{ url: brand.ogImage }] } : {}),
    },
  };
}
export default async function HomePage() {
  const [cat, settings, comboSettings, comboCatalogue] = await Promise.all([getCatalogue(), getSettings(), getComboSettings(), getComboCatalogue()]);
  return <WebsiteHome content={resolveWebsite(settings)} cat={cat} combos={{ settings: comboSettings, catalogue: comboCatalogue }} />;
}
