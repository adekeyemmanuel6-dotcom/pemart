'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { submitBulkQuote, type BulkState } from '@/lib/actions/bulk';
import { BULK_MIN, bulkTier } from '@/lib/bulk';
import { whatsappLink } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { FileUploader } from '@/components/studio/file-uploader';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export function BulkForm({ whatsapp }: { whatsapp: string | null }) {
  const [state, action, pending] = useActionState<BulkState, FormData>(submitBulkQuote, null);
  const tracked = useRef(false);
  useEffect(() => { if (state?.ok && !tracked.current) { tracked.current = true; track('bulk_order_enquiry', { items: [], valueKobo: 0 }); } }, [state]);
  const [paths, setPaths] = useState<string[]>([]);
  const [qty, setQty] = useState('');
  const tier = bulkTier(parseInt(qty, 10) || 0);
  const v = (k: string) => state?.values?.[k];
  const err = (k: string) => state?.fieldErrors?.[k];
  const field = (k: string) => ({ 'aria-invalid': !!err(k) || undefined, 'aria-describedby': err(k) ? `${k}-err` : undefined });
  const Err = ({ k }: { k: string }) => (err(k) ? <p id={`${k}-err`} role="alert" className="mt-1 text-sm text-ember">{err(k)}</p> : null);

  if (state?.ok) {
    return (
      <div className="rounded-lg border-2 border-ink bg-white p-8 text-center" role="status">
        <p className="font-script text-3xl text-mocha">thank you</p>
        <h2 className="display text-4xl">Request received</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">{state.message}</p>
        {state.ref && <p className="mt-2 text-sm">Reference: <strong>{state.ref}</strong></p>}
        <Button asChild className="mt-6"><a href={whatsappLink(whatsapp, `Hi Wear The Word, I just sent a bulk quote request for ${state.quantity} pieces${state.ref ? ` (ref ${state.ref})` : ''}.`)} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></Button>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="uploadPaths" value={JSON.stringify(paths)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div><Label htmlFor="name">Your name</Label><Input id="name" name="name" defaultValue={v('name')} autoComplete="name" required {...field('name')} /><Err k="name" /></div>
        <div><Label htmlFor="organisation">Organisation (optional)</Label><Input id="organisation" name="organisation" defaultValue={v('organisation')} autoComplete="organization" /></div>
        <div><Label htmlFor="phone">WhatsApp number</Label><Input id="phone" name="phone" defaultValue={v('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" required {...field('phone')} /><Err k="phone" /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" defaultValue={v('email')} type="email" autoComplete="email" required {...field('email')} /><Err k="email" /></div>
        <div><Label htmlFor="productType">What do you need?</Label>
          <select id="productType" name="productType" defaultValue={v('productType') ?? 'tee'} className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base">
            <option value="tee">Oversized tees</option><option value="hoodie">Hoodies</option><option value="frame">Wall frames</option><option value="gift_set">Gift sets</option><option value="other">Something else</option>
          </select></div>
        <div><Label htmlFor="quantity">Estimated quantity</Label><Input id="quantity" name="quantity" type="number" inputMode="numeric" min={BULK_MIN} value={qty} onChange={(e) => setQty(e.target.value)} required {...field('quantity')} /><Err k="quantity" />
          {tier && <p className="mt-1 text-sm font-semibold text-mocha" aria-live="polite">{tier.discountPct ? `${tier.label}: ${tier.note}` : `${tier.label}: we will quote you`}</p>}</div>
        <div><Label htmlFor="dateNeeded">Date needed (optional)</Label><Input id="dateNeeded" name="dateNeeded" defaultValue={v('dateNeeded')} type="date" {...field('dateNeeded')} /><Err k="dateNeeded" /></div>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Sizes breakdown (optional)</legend>
        <div className="grid grid-cols-5 gap-2">{SIZES.map((s) => (<div key={s}><label htmlFor={`size_${s}`} className="mb-1 block text-center text-sm font-semibold">{s}</label><Input id={`size_${s}`} name={`size_${s}`} defaultValue={v(`size_${s}`)} type="number" inputMode="numeric" min={0} placeholder="0" className="px-2 text-center" /></div>))}</div>
        <Err k="sizes" />
      </fieldset>

      <div><Label htmlFor="idea">Your design idea</Label><textarea id="idea" name="idea" defaultValue={v('idea')} rows={4} maxLength={2000} placeholder="Tell us about the event, the message, the colours…" className="w-full rounded-btn border border-line bg-white p-3 text-base" /></div>

      <div><p className="mb-1 text-sm font-semibold">Logo or reference files (optional)</p><FileUploader bucket="bulk" onPaths={setPaths} />
        <p className="mt-2 text-xs text-muted">Only upload images you have the right to use. Files are stored privately and used only to prepare your quote.</p></div>

      {state && !state.ok && !state.fieldErrors && <p role="alert" className="rounded-md bg-ember/10 p-3 text-sm">{state.message}</p>}
      {state && !state.ok && state.fieldErrors && <p role="alert" className="rounded-md bg-ember/10 p-3 text-sm">{state.message}</p>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? 'Sending…' : 'Request my quote'}</Button>
    </form>
  );
}
