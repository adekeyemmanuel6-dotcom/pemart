import { getWebsitePage, websitePageMetadata } from '@/lib/website/server';
import { WebsitePageView } from '@/components/website-page';
import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';

export async function generateMetadata(): Promise<Metadata> {
  return websitePageMetadata('returns', {
    title: 'Returns and Exchanges',
    description: 'Size exchanges within 7 days on ready designs. Custom items are final sale except for print defects.',
    alternates: { canonical: '/returns' },
  });
}

export default async function ReturnsPage() {
  const websitePage = await getWebsitePage('returns');
  if (websitePage) return <WebsitePageView page={websitePage} />;
  return (
    <ContentPage
      title="Returns and exchanges"
      kicker="fair and simple"
      intro="We want you to love what you ordered. Here is exactly how exchanges and replacements work."
    >
      <h2>Ready designs: size exchanges</h2>
      <p>
        If your ready-design tee or hoodie does not fit, you can exchange it for another size within{' '}
        <strong>7 days of delivery</strong>, as long as it is unworn and unwashed with the tags and packaging intact.
        Message us on WhatsApp with your order number and the size you need.
      </p>
      <h2>Custom and personalised items</h2>
      <p>
        Anything made to your request (Personalise, Text design or Full custom) is <strong>final sale</strong>, because
        it is printed for you alone. You approve a proof before we print, and every custom order includes one free
        revision.
      </p>
      <h2>Print defects and wrong items</h2>
      <p>
        If something arrives with a print defect, or it is not what you ordered, we will replace it{' '}
        <strong>free of charge</strong>, custom items included. Send a clear photo within 7 days of delivery and we will
        sort it out quickly.
      </p>
      <h2>Accessories and gifts</h2>
      <p>
        Perfume, jewellery, bracelets, glasses and fun items can be returned only if they arrive faulty or damaged.
        Please keep the packaging and message us within 7 days.
      </p>
      <h2>Gift cards</h2>
      <p>Digital gift cards are non-refundable and are delivered to the email address you provide.</p>
      <h2>Refunds</h2>
      <p>
        Where a refund is due, it goes back to your original payment method through Paystack. Bank processing times
        vary, but it normally reaches you within a few working days.
      </p>
    </ContentPage>
  );
}

export const revalidate = 300;
