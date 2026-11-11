import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = { title: 'About', description: 'Pemart is a Nigerian label for faith-inspired, message-led merch and gifts. Wear what you believe.', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return (
    <ContentPage title="Wear what you believe" kicker="about pemart" intro="Pemart makes the kind of faith merch you actually want to wear: bold, honest and never preachy.">
      <p>We started Pemart because most Christian clothing felt like clip art. We wanted tees and hoodies with real design behind them, scripture set in confident type, and a little Naija humour in the mix, because faith lives in everyday life too.</p>
      <h2>What we make</h2>
      <p>Oversized heavyweight tees, hoodies and wall frames carrying original designs, plus perfume, jewellery, bracelets and fun gifts. Many customers shop our combos, couple packs and Christmas gift boxes, where a few good things come together in one parcel.</p>
      <h2>How it works</h2>
      <ul>
        <li>Ready designs are printed to order and delivered within 5 days of payment.</li>
        <li>Want something personal? <Link href="/custom">Design your own</Link> with your name, your words or your idea. You approve a proof before anything is printed.</li>
        <li>Churches, events and businesses can <Link href="/bulk">order in bulk</Link> at group prices.</li>
      </ul>
      <h2>Say hello</h2>
      <p>Questions are welcome, before or after you buy. The quickest way is WhatsApp: use the green button on any page.</p>
    </ContentPage>
  );
}
