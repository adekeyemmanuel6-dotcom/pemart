import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProfile } from '@/lib/auth';
import { fetchCryptoPayment, fetchOrder } from '@/lib/checkout/service';
import { CryptoPayPanel } from '@/components/order/crypto-pay-panel';
import { ProofPanel } from '@/components/order/proof-panel';
import { ResumePayment } from '@/components/order/resume-payment';
import { proofUrl } from '@/lib/orders/service';
import { STATUS_LABEL as LABEL } from '@/lib/orders/status';
import { formatDeliveryDate } from '@/lib/delivery';
import { formatNaira } from '@/lib/money';
import { customerOrderLink } from '@/lib/notifications/whatsapp';
import { getSettings } from '@/lib/settings';
import { PurchaseEvent } from '@/components/consent/purchase-event';

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const fmtDateTime = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso));

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const o = await fetchOrder({ number, token: t, profileId: profile?.id });

  if (!o) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="display text-5xl">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-muted">The link may be incomplete. You can look up an order with its number and the email or phone you used.</p>
        <Button asChild className="mt-6"><Link href="/track">Track an order</Link></Button>
      </section>
    );
  }

  const pending = o.status === 'pending_payment', cancelled = o.status === 'cancelled';
  const crypto = pending ? await fetchCryptoPayment(o.id) : null;
  const proofItems = await Promise.all(o.custom_requests.map(async (c) => ({ ...c, latestUrl: c.proofs.length ? await proofUrl(c.proofs[c.proofs.length - 1]!.path) : null })));
  const canReview = o.status === 'delivered' && o.items.some((i) => (i.kind === 'variant' || i.kind === 'bundle') && !i.review_status);
  const extras = o.gift_wrap_kobo + o.surprise_note_kobo + o.express_kobo + o.ship_ready_first_kobo;
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {!pending && !cancelled && <PurchaseEvent orderNumber={o.number} valueKobo={o.total_kobo} items={o.items.map((i) => ({ id: i.id, name: i.name, priceKobo: i.unit_price_kobo, quantity: i.quantity, category: i.kind }))} />}
      <p className="font-script text-3xl text-mocha">{pending ? 'almost there' : cancelled ? 'order cancelled' : 'thank you'}</p>
      <h1 className="display text-5xl sm:text-6xl">{pending ? 'Waiting for payment' : cancelled ? 'Order cancelled' : 'Your order is in'}</h1>
      <p className="mt-2 text-lg">Order <strong>{o.number}</strong> · {LABEL[o.status] ?? o.status}</p>

      {!pending && !cancelled && (
        <div className="mt-5 rounded-lg bg-sand/60 p-4" role="status">
          {o.has_custom && !o.promised_by ? (<><p className="font-semibold">Next: your design proof.</p><p className="text-sm text-muted">We&apos;ll email you within the promised time. Approve it (or ask for one free revision) and <strong className="text-ink">production can begin after you approve</strong>.</p></>)
            : o.promised_by ? (<p className="font-semibold">Arriving by {formatDeliveryDate(new Date(o.promised_by))}</p>) : null}
          <p className="mt-1 text-sm text-muted">A confirmation was sent to {o.contact_email}.</p>
        </div>
      )}
      {pending && crypto && crypto.wallets.length > 0 && (
        <>
          <CryptoPayPanel crypto={crypto} number={o.number} token={t} totalKobo={o.total_kobo} expiresLabel={o.expires_at ? fmtDateTime(o.expires_at) : null} />
          <details className="mt-4 rounded-lg border border-line p-4">
            <summary className="cursor-pointer font-semibold">Prefer to pay by card, bank transfer or USSD?</summary>
            <div className="mt-3"><ResumePayment number={o.number} token={o.token} totalKobo={o.total_kobo} /></div>
          </details>
        </>
      )}
      {pending && !(crypto && crypto.wallets.length > 0) && (
        <div className="mt-5 rounded-lg bg-ember/15 p-4" role="status"><p className="font-semibold">We haven&apos;t received your payment yet.</p>
          <p className="mb-3 text-sm">If you just paid, give it a minute and refresh. We hold your items and cancel unpaid orders after 24 hours{o.expires_at ? ` (${fmtDateTime(o.expires_at)})` : ''}.</p>
          <ResumePayment number={o.number} token={o.token} totalKobo={o.total_kobo} /></div>
      )}
      {proofItems.length > 0 && !pending && !cancelled && <ProofPanel items={proofItems} number={o.number} token={t} revisionFeeKobo={settings.revision_fee_kobo} />}

      <h2 className="display mb-2 mt-10 text-3xl">Items</h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {o.items.map((i) => (
          <li key={i.id} className="p-4">
            <div className="flex justify-between gap-3"><p className="font-semibold">{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.name}</p><p className="font-semibold">{formatNaira(i.unit_price_kobo * i.quantity)}</p></div>
            {i.kind === 'revision' && <p className="text-sm text-muted">One extra revision for your custom design</p>}
            {i.kind === 'custom' && <p className="text-sm text-muted">{[(i.options as { colour?: string }).colour, (i.options as { size?: string }).size].filter(Boolean).join(' · ')} · custom design, final sale</p>}
            {i.kind === 'variant' && <p className="text-sm text-muted">{[(i.options as { colour?: string }).colour, (i.options as { size?: string }).size, (i.options as { option?: string }).option].filter(Boolean).join(' · ')}</p>}
            {i.selections && (<ul className="mt-1 space-y-0.5 text-sm text-muted">{i.selections.map((s) => (<li key={s.label}><strong className="text-ink">{s.label}:</strong> {[s.productName, s.colour, s.size, s.option, s.customText ? `"${s.customText}"` : ''].filter(Boolean).join(' · ')}</li>))}</ul>)}
            {i.gift_message && <p className="mt-1 text-sm italic">Gift message: &ldquo;{i.gift_message}&rdquo;</p>}
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(o.subtotal_kobo)}</dd></div>
        {o.discount_kobo > 0 && <div className="flex justify-between text-mocha"><dt>Discount{o.discount_code ? ` (${o.discount_code})` : ''}</dt><dd>-{formatNaira(o.discount_kobo)}</dd></div>}
        <div className="flex justify-between"><dt>Delivery{o.delivery_zone_name ? ` (${o.delivery_zone_name})` : ''}</dt><dd>{o.delivery_fee_kobo === 0 ? 'Free' : formatNaira(o.delivery_fee_kobo)}</dd></div>
        {extras > 0 && <div className="flex justify-between"><dt>Extras</dt><dd>{formatNaira(extras)}</dd></div>}
        {o.gift_card_used_kobo > 0 && <div className="flex justify-between text-mocha"><dt>Gift card</dt><dd>-{formatNaira(o.gift_card_used_kobo)}</dd></div>}
        {o.credit_used_kobo > 0 && <div className="flex justify-between text-mocha"><dt>Store credit</dt><dd>-{formatNaira(o.credit_used_kobo)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-2 text-xl font-bold"><dt>Total</dt><dd>{formatNaira(o.total_kobo)}</dd></div>
      </dl>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div><h2 className="display mb-2 text-3xl">Delivering to</h2><address className="not-italic text-muted">{o.address.recipient}<br />{o.address.line1}{o.address.area ? `, ${o.address.area}` : ''}<br />{o.address.city}, {o.address.state}</address>{o.is_gift && o.gift_message && <p className="mt-2 text-sm italic">&ldquo;{o.gift_message}&rdquo;</p>}</div>
        <div>
          <h2 className="display mb-2 text-3xl">Progress</h2>
          <ol className="space-y-2" aria-label="Order timeline">{o.events.map((e, i) => (
            <li key={i} className="flex gap-2 text-sm">{i === o.events.length - 1 ? <Circle className="mt-0.5 size-4 shrink-0 fill-ink" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0 text-mocha" aria-hidden />}
              <span><strong>{LABEL[e.status] ?? e.status}</strong> <span className="text-muted">· {fmtDateTime(e.created_at)}</span>{e.note && e.note !== LABEL[e.status] && <span className="block text-muted">{e.note}</span>}</span></li>))}</ol>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild><a href={customerOrderLink(settings.whatsapp_number, o.number)} target="_blank" rel="noopener noreferrer">Message us about this order</a></Button>
        {canReview && <Button asChild variant="secondary"><Link href={`/order/${o.number}/review${t ? `?t=${t}` : ''}`}>Leave a review</Link></Button>}
        <Button asChild variant="secondary"><Link href="/collections/all">Keep shopping</Link></Button>
      </div>
    </section>
  );
}
