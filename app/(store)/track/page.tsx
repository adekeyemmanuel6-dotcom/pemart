import type { Metadata } from 'next';
import Link from 'next/link';
import { TrackForm } from '@/components/order/track-form';

export const metadata: Metadata = { title: 'Track Your Order', description: 'Look up your Pemart order with its number and the email or phone you used. No account needed.', alternates: { canonical: '/track' } };

export default function TrackPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <p className="font-script text-3xl text-mocha">where is it?</p>
      <h1 className="display text-5xl sm:text-6xl">Track your order</h1>
      <p className="mb-8 mt-2 text-muted">Enter your order number and the email or phone number you used at checkout. No account needed.</p>
      <TrackForm />
      <p className="mt-8 text-sm text-muted">Have an account? <Link href="/account" className="font-semibold underline underline-offset-4">See all your orders</Link>.</p>
    </section>
  );
}
