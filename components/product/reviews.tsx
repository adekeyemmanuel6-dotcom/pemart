import Image from 'next/image';
import { Star } from 'lucide-react';
import type { Review } from '@/lib/reviews';

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex" role="img" aria-label={`${n} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (<Star key={i} className={`size-4 ${i <= n ? 'fill-mocha text-mocha' : 'text-line'}`} aria-hidden />))}
  </span>
);

export function Reviews({ reviews, productName }: { reviews: Review[]; productName: string }) {
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  return (
    <section aria-labelledby="reviews-h" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="reviews-h" className="display text-4xl">Reviews</h2>
        {reviews.length > 0 && <p className="flex items-center gap-2"><Stars n={Math.round(avg)} /><span className="font-semibold">{avg.toFixed(1)}</span><span className="text-muted">({reviews.length})</span></p>}
      </div>
      {reviews.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line p-6 text-muted">No reviews for {productName} yet. Bought it? After your order arrives we&apos;ll invite you to share a photo review and earn ₦2,000 store credit.</p>
      ) : (
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-center justify-between"><Stars n={r.rating} /><span className="text-xs font-semibold uppercase tracking-wide text-mocha">Verified buyer</span></div>
              {r.text && <p className="mt-3">{r.text}</p>}
              {r.photo_urls.length > 0 && (<ul className="mt-3 flex gap-2">{r.photo_urls.map((u) => (<li key={u}><Image src={u} alt={`Photo from a ${productName} review`} width={96} height={96} className="size-24 rounded-md object-cover" /></li>))}</ul>)}
              <p className="mt-3 text-sm text-muted">{r.display_name ?? 'Pemart customer'}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
