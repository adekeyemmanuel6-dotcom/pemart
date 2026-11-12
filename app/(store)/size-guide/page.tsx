import { getWebsitePage, websitePageMetadata } from '@/lib/website/server';
import { WebsitePageView } from '@/components/website-page';
import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';
import { SizeGuideTable } from '@/components/product/size-guide-table';
import { HOW_TO_MEASURE } from '@/lib/size-guide';

export async function generateMetadata(): Promise<Metadata> {
  return websitePageMetadata('size-guide', {
    title: 'Size Guide',
    description: 'Measurements in cm for Pemart oversized tees, hoodies and frames, plus how to choose your size.',
    alternates: { canonical: '/size-guide' },
  });
}

export default async function SizeGuidePage() {
  const websitePage = await getWebsitePage('size-guide');
  if (websitePage)
    return (
      <WebsitePageView page={websitePage}>
        <div className="mt-10 space-y-10">
          <SizeGuideTable type="tee" />
          <SizeGuideTable type="hoodie" />
          <SizeGuideTable type="frame" />
        </div>
      </WebsitePageView>
    );
  return (
    <ContentPage
      title="Size guide"
      kicker="find your fit"
      intro="Our tees and hoodies are cut oversized. All measurements are in centimetres, taken flat."
    >
      <div className="not-prose space-y-10">
        <SizeGuideTable type="tee" />
        <SizeGuideTable type="hoodie" />
        <SizeGuideTable type="frame" />
      </div>
      <h2>How to choose</h2>
      <ol className="list-decimal pl-5">
        {HOW_TO_MEASURE.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p>Still unsure? Message us on WhatsApp with your height and usual size and we will help you pick.</p>
    </ContentPage>
  );
}

export const revalidate = 300;
