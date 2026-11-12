import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';
import { JsonLd } from '@/components/json-ld';

export const metadata: Metadata = { title: 'FAQ', description: 'Answers about ordering, delivery, custom designs, payments and exchanges at Pemart.', alternates: { canonical: '/faq' } };

const FAQ = [
  ['How long does delivery take?', 'Available estimates depend on the destination and service and are shown before payment. Custom production starts after proof approval.'],
  ['How do custom designs work?', 'Choose a tier on the Design Your Own page, pay at checkout, and we send you a proof: within 12 hours for Personalise, 24 hours for Text design and 48 hours for Full custom. Approve it, or ask for one free revision. Once you approve, production begins and delivery follows your confirmed service.'],
  ['How much do custom designs cost?', 'Personalise (change the name, date or verse on an existing design) adds ₦3,000. Text design (your own words in a Pemart type style) adds ₦5,000. Full custom (your idea or sketch) adds ₦15,000. These are on top of the price of the garment.'],
  ['Can I return a custom item?', 'Custom and personalised items are final sale, except for print defects or wrong items, which we replace free.'],
  ['Can I exchange the size?', 'Yes. Ready designs can be exchanged for another size within 7 days of delivery if unworn and unwashed.'],
  ['How do I pay?', 'Securely with Paystack by card, bank transfer or USSD, in Naira. Pay on delivery is not available at the moment.'],
  ['Is delivery free?', 'Eligible orders qualify for nationwide free delivery at the current threshold shown on our Delivery page and in your bag, after discounts. Below that threshold, confirmed service fees apply.'],
  ['What are Gift Boxes?', 'Ready-to-gift sets such as the Joy Box, the Couple’s Christmas Box and the Family Box. You choose designs, colours and sizes, add a gift message, and we pack it. They are available until 24 December.'],
  ['Do you do bulk orders for churches and events?', 'Yes. 10 to 24 pieces get 10% off, 25 to 99 pieces get 15% off, and 100 or more is by quote. Send us a request on the Bulk Orders page.'],
  ['How do I track my order?', 'Use the Track Order page with your order number and the phone or email you ordered with. You do not need an account.'],
  ['What is the print quality like?', 'Our tees are heavyweight oversized cotton, and designs are printed to order for a soft, durable finish. Wash inside out in cold water to keep them looking sharp.'],
  ['Can I ask a question before I buy?', 'Always. Tap the green WhatsApp button on any page and we will reply with the page you are on already attached.'],
] as const;

export default function FaqPage() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (
    <ContentPage title="FAQ" kicker="good questions" intro="The quick answers. If yours is not here, message us on WhatsApp.">
      <JsonLd data={ld} />
      <div className="not-prose space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-lg border border-line bg-white p-5 [&[open]>summary]:mb-2">
            <summary className="min-h-6 cursor-pointer text-lg font-semibold">{q}</summary>
            <p className="text-muted">{a}</p>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
