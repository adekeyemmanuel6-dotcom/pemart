import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Gift Cards', description: 'Digital Pemart gift cards of ₦10,000, ₦25,000 and ₦50,000, delivered by email with a code to redeem at checkout.', alternates: { canonical: '/gift-cards' } };

export default function GiftCardsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
      <p className="font-script text-3xl text-mocha">the easy gift</p>
      <h1 className="display text-5xl sm:text-7xl">Gift cards</h1>
      <p className="mx-auto mt-3 max-w-xl text-lg text-muted">A digital gift card arrives by email with a code to redeem at checkout. Perfect when you are not sure of the size.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">{[1000000, 2500000, 5000000].map((k) => (<li key={k} className="rounded-lg bg-ink p-8 text-paper"><p className="display text-5xl">{formatNaira(k)}</p><p className="mt-1 text-sm text-sand">Pemart gift card</p></li>))}</ul>
      <Button asChild className="mt-10"><Link href="/products/gift-card">Choose an amount</Link></Button>
      <p className="mt-4 text-sm text-muted">Recipient email and message are added at checkout.</p>
    </section>
  );
}
