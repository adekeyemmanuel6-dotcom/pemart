import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = { title: 'Terms', description: 'The terms for ordering from Pemart: payment, delivery, custom orders, exchanges and uploads.', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of sale" kicker="the small print" intro="Plain-language terms for buying from Pemart.">
      <h2>Orders and prices</h2>
      <p>All prices are in Nigerian Naira (₦). The price you pay is calculated by our system at checkout, including delivery, add-ons and any discount codes, and confirmed before you pay. An order is accepted once your payment is verified.</p>
      <h2>Payment</h2>
      <p>We accept card, bank transfer and USSD through Paystack. Pay on delivery is not offered at this time. Unpaid orders are cancelled after 24 hours.</p>
      <h2>Delivery</h2>
      <p>Delivery fees and any verified estimates are shown before payment. Custom orders require proof approval before production. Contact our team for timing specific to your order; courier delays may affect estimates.</p>
      <h2>Custom and personalised orders</h2>
      <ul>
        <li>You approve a design proof before printing. Every custom order includes one free revision; further revisions can be bought as an add-on.</li>
        <li>Custom and personalised items are final sale, except for print defects or wrong items, which we replace free.</li>
        <li>Content you upload: you confirm you own it or have permission to use it, and that it does not infringe anyone&apos;s rights or contain unlawful material. We may decline any design.</li>
      </ul>
      <h2>Exchanges and returns</h2>
      <p>See <Link href="/returns">Returns and Exchanges</Link>. In short: size exchanges on unworn, unwashed ready designs within 7 days, and free replacement for print defects.</p>
      <h2>Discount codes, store credit and gift cards</h2>
      <p>Codes have their own conditions (such as a minimum spend, dates or one use per customer) and cannot be exchanged for cash. Store credit and gift cards are redeemed at checkout, and gift cards may have an expiry date shown on the card.</p>
      <h2>Reviews</h2>
      <p>Reviews are moderated. Photo reviews approved by us earn store credit as described when we invite you to review.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, our liability for any order is limited to the amount you paid for it.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
    </ContentPage>
  );
}
