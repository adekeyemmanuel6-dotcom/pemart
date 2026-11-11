import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewForm } from '@/components/order/review-form';
import { Button } from '@/components/ui/button';
import { orderForPage } from '@/lib/actions/orders';
import { formatNaira } from '@/lib/money';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Leave a review', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const [o, settings] = await Promise.all([orderForPage(number, t), getSettings()]);
  if (!o) return (<section className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="display text-5xl">We couldn&apos;t find that order</h1><Button asChild className="mt-6"><Link href="/track">Track an order</Link></Button></section>);
  const items = o.items.filter((i) => i.kind === 'variant' || i.kind === 'bundle');
  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-script text-3xl text-mocha">how&apos;s it wearing?</p>
      <h1 className="display text-5xl">Leave a review</h1>
      <p className="mt-2 text-muted">Order {o.number}. Reviews come from verified buyers only, and are checked before they appear.</p>
      {o.status !== 'delivered' ? (
        <p className="mt-6 rounded-lg bg-sand/60 p-4" role="status">You can review once your order has been delivered.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {items.map((i) => i.review_status ? (
            <p key={i.id} className="rounded-lg border border-line bg-white p-4" role="status"><strong>{i.name}</strong>: {i.review_status === 'approved' ? 'your review is published. Thank you!' : i.review_status === 'rejected' ? 'your review was not published.' : `thanks, your review is waiting for approval. If you added a photo, ${formatNaira(settings.review_credit_kobo)} store credit is added once it is approved.`}</p>
          ) : (<ReviewForm key={i.id} number={o.number} token={t} orderItemId={i.id} itemName={i.name} creditLabel={formatNaira(settings.review_credit_kobo)} />))}
        </div>
      )}
      <Button asChild variant="ghost" className="mt-8"><Link href={`/order/${o.number}${t ? `?t=${t}` : ''}`}>Back to your order</Link></Button>
    </section>
  );
}
