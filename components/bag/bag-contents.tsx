'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, Truck } from 'lucide-react';
import { useQuote, useDeliveryState } from '@/lib/checkout/use-quote';
import type { PublicQuote } from '@/lib/checkout/types';
import { useBag } from '@/lib/cart-store';
import { formatDeliveryDate } from '@/lib/delivery';
import { formatNaira } from '@/lib/money';
import type { ProductType } from '@/lib/catalogue/types';
import { Button } from '@/components/ui/button';
import { GarmentMockup } from '@/components/product/garment-mockup';
import { ProductVisual } from '@/components/product/product-visual';

type QLine = PublicQuote['lines'][number];

function LineVisual({ l }: { l: QLine }) {
  const v = l.visual;
  if (v.type === 'bundle') return <div className="relative aspect-[4/5] overflow-hidden bg-sand"><Image src={v.imageUrl ?? '/placeholders/gift-box.svg'} alt="" fill sizes="80px" className="object-cover" /></div>;
  if ((l.kind === 'custom' || l.kind === 'revision') && (v.type === 'tee' || v.type === 'hoodie')) return <GarmentMockup type={v.type} colour={v.colour ?? 'Black'} view="back" designSlug={null} />;
  return <ProductVisual type={v.type as ProductType} designSlug={v.designSlug} colour={v.colour} finish={v.finish} imageUrl={v.imageUrl} alt="" sizes="80px" />;
}

function Progress({ q }: { q: PublicQuote }) {
  if (!q.freeDeliveryThresholdKobo) return null;
  const goods = q.subtotalKobo - (q.discount?.amountKobo ?? 0);
  const pct = Math.min(100, Math.round((goods / q.freeDeliveryThresholdKobo) * 100));
  return (
    <div aria-live="polite" className="rounded-lg bg-sand/60 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Truck className="size-4" aria-hidden />{q.freeDeliveryAwayKobo ? `${formatNaira(q.freeDeliveryAwayKobo)} away from free delivery in Lagos` : 'You have free delivery in Lagos'}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery"><div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function CodeBox({ q }: { q: PublicQuote }) {
  const code = useBag((s) => s.code), giftCode = useBag((s) => s.giftCode), setCodes = useBag((s) => s.setCodes);
  const [c, setC] = useState(code), [g, setG] = useState(giftCode);
  useEffect(() => { setC(code); setG(giftCode); }, [code, giftCode]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setCodes(c.trim(), g.trim()); }} className="space-y-2" aria-label="Discount and gift card codes">
      <div className="flex gap-2">
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Discount code" aria-label="Discount code" autoCapitalize="characters" className="min-h-12 min-w-0 flex-1 rounded-btn border border-line bg-white px-3 text-base" />
        <input value={g} onChange={(e) => setG(e.target.value)} placeholder="Gift card" aria-label="Gift card code" autoCapitalize="characters" className="min-h-12 min-w-0 flex-1 rounded-btn border border-line bg-white px-3 text-base" />
        <Button type="submit" variant="secondary" size="sm">Apply</Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {q.discount && <span className="font-semibold text-mocha">{q.discount.code} applied: {formatNaira(q.discount.amountKobo)} off. </span>}
        {q.giftCardAppliedKobo > 0 && <span className="font-semibold text-mocha">Gift card: {formatNaira(q.giftCardAppliedKobo)} applied. </span>}
        {q.codeError && code && <span className="text-ember">{q.codeError}. </span>}
        {q.giftCodeError && <span className="text-ember">{q.giftCodeError}.</span>}
      </p>
    </form>
  );
}

/** The bag, shared by the slide-out drawer and the full /bag page. Everything priced by the server. */
export function BagContents({ variant, onNavigate }: { variant: 'drawer' | 'page'; onNavigate?: () => void }) {
  const [state] = useDeliveryState();
  const { quote: q, loading, error, hasLines } = useQuote({ state });
  const lines = useBag((s) => s.lines), remove = useBag((s) => s.remove), setQty = useBag((s) => s.setQuantity), add = useBag((s) => s.add);
  const [pick, setPick] = useState('');

  if (!hasLines) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="display text-4xl">Your bag is empty</p>
        <p className="mt-2 text-muted">Nothing here yet. Find something you believe in.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild onClick={onNavigate}><Link href="/collections/all">Shop all</Link></Button><Button asChild variant="secondary" onClick={onNavigate}><Link href="/gift-boxes">Gift Boxes</Link></Button></div>
      </div>
    );
  }
  if (!q) return <div className="space-y-3 p-5" role="status" aria-busy="true" aria-label="Loading your bag">{lines.map((l) => (<div key={l.id} className="skeleton h-28" />))}{error && <p role="alert" className="text-sm text-ember">{error}</p>}</div>;

  const blocked = q.lines.some((l) => l.issues.length > 0);
  const eta = q.promise.customBy ? { text: `Estimated delivery ${formatDeliveryDate(new Date(q.promise.customBy))}`, note: `Your proof arrives within ${q.promise.proofHours} hours. The 5-day clock starts when you approve it.` }
    : q.promise.readyBy ? { text: `Arrives by ${formatDeliveryDate(new Date(q.promise.readyBy))}`, note: 'Order today for delivery within 5 days.' } : null;

  return (
    <div className={variant === 'page' ? 'grid gap-8 lg:grid-cols-[1fr_380px]' : 'flex min-h-full flex-col'}>
      <div className={variant === 'drawer' ? 'flex-1 space-y-4 p-5' : 'space-y-4'}>
        <Progress q={q} />
        <ul className="divide-y divide-line">
          {q.lines.map((l) => (
            <li key={l.id} className="flex gap-3 py-4">
              <div className="w-20 shrink-0 overflow-hidden rounded-md border border-line"><LineVisual l={l} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><p className="font-semibold leading-snug">{l.name}</p><p className="shrink-0 font-semibold">{formatNaira(l.lineKobo)}</p></div>
                {l.detail.length > 0 && <p className="text-sm text-muted">{l.detail.join(' · ')}</p>}
                {l.upsell && <p className="text-sm font-semibold text-mocha">Special offer price</p>}
                {l.contents.length > 0 && (
                  <details className="mt-1 text-sm"><summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">What&apos;s inside</summary>
                    <ul className="mt-1 space-y-0.5 text-muted">{l.contents.map((c) => (<li key={c}>{c}</li>))}</ul></details>
                )}
                {l.giftMessage && <p className="mt-1 text-sm italic text-muted">&ldquo;{l.giftMessage}&rdquo;</p>}
                {l.giftWrap && <p className="text-sm text-muted">Gift wrap and card</p>}
                {l.issues.map((m) => (<p key={m} role="alert" className="mt-1 text-sm font-semibold text-ember">{m}</p>))}
                <div className="mt-2 flex items-center justify-between">
                  {l.kind === 'custom' || l.kind === 'revision' || l.upsell ? <span className="text-sm text-muted">Qty 1</span> : (
                    <div className="flex items-center rounded-btn border border-line bg-white" role="group" aria-label={`Quantity for ${l.name}`}>
                      <button type="button" className="grid size-11 place-items-center" onClick={() => setQty(l.id, l.quantity - 1)} aria-label="Decrease quantity"><Minus className="size-4" aria-hidden /></button>
                      <span className="w-7 text-center font-semibold" aria-live="polite">{l.quantity}</span>
                      <button type="button" className="grid size-11 place-items-center" onClick={() => setQty(l.id, l.quantity + 1)} aria-label="Increase quantity"><Plus className="size-4" aria-hidden /></button>
                    </div>)}
                  <button type="button" onClick={() => remove(l.id)} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold underline-offset-4 hover:underline" aria-label={`Remove ${l.name}`}><Trash2 className="size-4" aria-hidden />Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {q.upsell && (
          <section className="rounded-lg border-2 border-dashed border-mocha p-4" aria-label="Special offer">
            <p className="font-script text-2xl text-mocha">add one more?</p>
            <p className="font-semibold">{q.upsell.productName} <span className="text-mocha">{formatNaira(q.upsell.offerKobo)}</span> <span className="text-sm text-muted line-through">{formatNaira(q.upsell.regularKobo)}</span></p>
            <div className="mt-2 flex gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Choose a style" className="min-h-12 min-w-0 flex-1 rounded-btn border border-line bg-white px-3 text-base">
                <option value="">Choose a style</option>{q.upsell.variants.map((v) => (<option key={v.id} value={v.id}>{v.option}</option>))}
              </select>
              <Button size="sm" variant="secondary" disabled={!pick} onClick={() => { add({ id: crypto.randomUUID(), kind: 'variant', refId: pick, quantity: 1, upsell: true }); setPick(''); }}>Add</Button>
            </div>
          </section>
        )}
        {variant === 'page' && <p className="text-sm text-muted">{lines.length} {lines.length === 1 ? 'item' : 'items'} in your bag</p>}
      </div>

      <div className={variant === 'drawer' ? 'sticky bottom-0 space-y-3 border-t border-line bg-paper p-5' : 'h-fit space-y-4 rounded-lg border-2 border-ink bg-white p-5 lg:sticky lg:top-24'} aria-busy={loading}>
        <CodeBox q={q} />
        <dl className="space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(q.subtotalKobo)}</dd></div>
          {q.discount && <div className="flex justify-between text-mocha"><dt>Discount ({q.discount.code})</dt><dd>-{formatNaira(q.discount.amountKobo)}</dd></div>}
          {q.giftWrapKobo > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{formatNaira(q.giftWrapKobo)}</dd></div>}
          <div className="flex justify-between text-muted"><dt>Delivery to {q.zone?.name ?? state}</dt><dd>{q.digitalOnly ? 'None' : q.zone ? (q.deliveryFeeKobo === 0 ? 'Free' : formatNaira(q.deliveryFeeKobo)) : 'At checkout'}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{formatNaira(q.totalKobo)}</dd></div>
        </dl>
        {eta && <p className="text-sm"><strong>{eta.text}.</strong> <span className="text-muted">{eta.note}</span></p>}
        {q.warnings.map((w) => (<p key={w} role="status" className="rounded-md bg-ember/15 p-3 text-sm font-semibold">{w}</p>))}
        {error && <p role="alert" className="text-sm text-ember">{error}</p>}
        <Button asChild={!blocked} className="w-full" disabled={blocked} onClick={onNavigate}>{blocked ? <span>Fix the items above to continue</span> : <Link href="/checkout">Checkout · {formatNaira(q.totalKobo)}</Link>}</Button>
        {variant === 'drawer' && <Button asChild variant="ghost" className="w-full" onClick={onNavigate}><Link href="/bag">View full bag</Link></Button>}
        <p className="text-center text-xs text-muted">Secure payment with Paystack. Prices are confirmed again at checkout.</p>
      </div>
    </div>
  );
}
