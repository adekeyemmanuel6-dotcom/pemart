'use client';
import { useActionState, useState } from 'react';
import { Star } from 'lucide-react';
import { submitReviewAction, type ReviewState } from '@/lib/actions/orders';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { FileUploader } from '@/components/studio/file-uploader';

export function ReviewForm({ number, token, orderItemId, itemName, creditLabel }: { number: string; token?: string; orderItemId: string; itemName: string; creditLabel: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReviewAction, null);
  const [rating, setRating] = useState(0), [paths, setPaths] = useState<string[]>([]);
  if (state?.ok) return <p role="status" className="rounded-lg bg-sand/60 p-4 font-semibold">{state.message}</p>;
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-white p-5">
      <input type="hidden" name="number" value={number} /><input type="hidden" name="token" value={token ?? ''} /><input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="rating" value={rating || ''} /><input type="hidden" name="photoPaths" value={JSON.stringify(paths)} />
      <h3 className="display text-2xl">{itemName}</h3>
      <fieldset><legend className="mb-1 text-sm font-semibold">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Star rating">{[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onClick={() => setRating(n)} className="grid size-11 place-items-center rounded-md hover:bg-sand"><Star className={`size-7 ${n <= rating ? 'fill-mocha text-mocha' : 'text-line'}`} aria-hidden /></button>))}</div></fieldset>
      <div><Label htmlFor={`t-${orderItemId}`}>Tell us about it (optional)</Label><textarea id={`t-${orderItemId}`} name="text" rows={3} maxLength={1500} className="w-full rounded-btn border border-line bg-paper p-3 text-base" placeholder="The fit, the print, how it feels…" /></div>
      <div><Label htmlFor={`n-${orderItemId}`}>Your name (optional)</Label><Input id={`n-${orderItemId}`} name="displayName" maxLength={60} placeholder="e.g. Ada O." /></div>
      <div><FileUploader bucket="review" onPaths={setPaths} max={3} /><p className="mt-1 text-sm font-semibold text-mocha">Add a photo and earn {creditLabel} store credit when we approve it.</p></div>
      {state && !state.ok && <p role="alert" className="text-sm text-ember">{state.message}</p>}
      <Button type="submit" disabled={pending || rating === 0}>{pending ? 'Sending…' : 'Submit review'}</Button>
    </form>
  );
}
