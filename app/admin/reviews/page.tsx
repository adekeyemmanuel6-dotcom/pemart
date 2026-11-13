import type { Metadata } from 'next';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { ActionForm } from '@/components/admin/action-form';
import { Card, Empty, PageTitle, fmtDate } from '@/components/admin/ui';
import { adm, requirePerm } from '@/lib/admin/db';
import { Flash } from '@/components/admin/flash';
import { moderateReviewAction } from '@/lib/admin/actions-ops';

export const metadata: Metadata = { title: 'Reviews' };
type R = { id: string; status: string; rating: number; text: string | null; display_name: string | null; photo_urls: string[]; created_at: string; credit_issued: boolean; credit_pending: boolean; product: string; order_number: string | null };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; flash?: string; flashLink?: string; flashLabel?: string }> }) {
  const me = await requirePerm('reviews', '/admin/reviews');
  const sp = await searchParams; const { status = 'pending' } = sp;
  const reviews = await adm<R[]>('admin_reviews_list', me, { status: status === 'all' ? null : status });
  return (
    <>
      <PageTitle title="Reviews" sub="Approving a review with a photo issues store credit, once." />
      <Flash sp={sp} />
      <nav className="mb-4 flex gap-2" aria-label="Filter reviews">{['pending', 'approved', 'rejected', 'all'].map((s) => (<a key={s} href={`?status=${s}`} aria-current={status === s ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${status === s ? 'bg-ink text-paper' : 'border border-line'}`}>{s[0]!.toUpperCase() + s.slice(1)}</a>))}</nav>
      {reviews.length === 0 ? <Empty>Nothing here.</Empty> : (
        <ul className="space-y-3">{reviews.map((r) => (
          <li key={r.id}><Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{r.product} <span className="font-normal text-muted">· order {r.order_number} · {fmtDate(r.created_at)}</span></p>
              <span className="flex" role="img" aria-label={`${r.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((n) => (<Star key={n} className={`size-4 ${n <= r.rating ? 'fill-mocha text-mocha' : 'text-line'}`} aria-hidden />))}</span></div>
            {r.text && <p className="mt-2">{r.text}</p>}<p className="text-sm text-muted">{r.display_name ?? 'Anonymous'}{r.credit_issued ? ' · credit issued' : r.credit_pending ? ' · credit pending (no account yet)' : ''}</p>
            {r.photo_urls.length > 0 && <ul className="mt-2 flex gap-2">{r.photo_urls.map((u) => (<li key={u}><Image src={u} alt="Customer photo" width={96} height={96} className="size-24 rounded-md object-cover" /></li>))}</ul>}
            {r.status === 'pending' && (<div className="mt-3 flex gap-2">
              <ActionForm action={moderateReviewAction} hideSubmit><input type="hidden" name="reviewId" value={r.id} /><button name="decision" value="approve" className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Approve{r.photo_urls.length ? ' + credit' : ''}</button> <button name="decision" value="reject" className="min-h-11 rounded-btn border-2 border-ink px-5 text-sm font-semibold">Reject</button></ActionForm></div>)}
            {r.status !== 'pending' && <p className="mt-2 text-sm font-semibold">{r.status === 'approved' ? 'Published' : 'Rejected'}</p>}
          </Card></li>))}</ul>)}
    </>
  );
}
