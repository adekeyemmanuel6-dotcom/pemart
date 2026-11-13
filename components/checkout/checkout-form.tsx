'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { startCheckout } from '@/lib/actions/checkout';
import { useBag } from '@/lib/cart-store';
import { NIGERIAN_STATES, SHIPPING_PENDING } from '@/lib/shipping';
import { formatDeliveryDate } from '@/lib/delivery';
import { formatNaira } from '@/lib/money';
import { track } from '@/lib/analytics';
import { toInputLines, useDeliveryState, useQuote } from '@/lib/checkout/use-quote';
import { openPaystack } from '@/lib/paystack-client';
import { confirmPayment } from '@/lib/payment-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Progress } from '@/components/bag/bag-contents';
import { MockPaystack } from './mock-paystack';

type Session = { reference: string; accessCode: string; mock: boolean; number: string; token: string; totalKobo: number };

export function CheckoutForm({ defaultEmail, signedIn, addOns, crypto = [] }: { zones: { name: string; states: string[] }[]; defaultEmail: string; signedIn: boolean; addOns: { giftWrapKobo: number; surpriseNoteKobo: number; expressKobo: number; expressEnabled: boolean }; crypto?: { asset: string; network: string }[] }) {
  const router = useRouter();
  const lines = useBag((s) => s.lines), code = useBag((s) => s.code), giftCode = useBag((s) => s.giftCode), clear = useBag((s) => s.clear);
  const [deliveryState, setDeliveryState] = useDeliveryState();

  const [email, setEmail] = useState(defaultEmail), [phone, setPhone] = useState('');
  const [isGift, setIsGift] = useState(false), [giftMessage, setGiftMessage] = useState('');
  const [recipient, setRecipient] = useState(''), [rPhone, setRPhone] = useState('');
  const [shippingRateId, setShippingRateId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [line1, setLine1] = useState(''), [area, setArea] = useState(''), [city, setCity] = useState('');
  const [giftWrap, setGiftWrap] = useState(false), [surpriseNote, setSurpriseNote] = useState(false), [express, setExpress] = useState(false), [shipReadyFirst, setShipReadyFirst] = useState(false);
  const [useCredit, setUseCredit] = useState(false), [consent, setConsent] = useState(false), [createAccount, setCreateAccount] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState<'paystack' | 'crypto'>('paystack');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const extras = { giftWrap, surpriseNote, express, shipReadyFirst };
  const { quote: q, loading } = useQuote({ state: deliveryState, city, shippingRateId: shippingRateId || undefined, extras, useCredit, acceptFinalSale: consent, giftMessage });
  const beganCheckout = useRef(false);
  useEffect(() => {
    if (!q || beganCheckout.current || !q.lines.length) return;
    beganCheckout.current = true;
    track('begin_checkout', { valueKobo: q.totalKobo, items: q.lines.map((l) => ({ id: l.slug ?? l.id, name: l.name, priceKobo: l.unitKobo, quantity: l.quantity, category: l.kind })) });
  }, [q]);
  const digital = !!q?.digitalOnly;
  const stateOptions = NIGERIAN_STATES;

  const err = (k: string) => errors[k];
  const field = (k: string) => ({ 'aria-invalid': !!err(k) || undefined, 'aria-describedby': err(k) ? `${k}-e` : undefined });
  const Err = ({ k }: { k: string }) => (err(k) ? <p id={`${k}-e`} role="alert" className="mt-1 text-sm text-ember">{err(k)}</p> : null);
  const section = 'rounded-lg border border-line bg-white p-5 sm:p-6';
  const check = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-btn border border-line bg-paper px-4 py-2';

  function succeed(number: string, token: string) { clear(); router.push(`/order/${number}?t=${token}`); }

  async function confirm(reference: string, s: Session) {
    setConfirming(true); setMockOpen(false);
    const r = await confirmPayment(reference);
    setConfirming(false);
    if (r.ok) return succeed(r.number, r.token);
    setMessage(r.message);
    if (r.pending) succeed(s.number, s.token); // the webhook will finish it; the order page shows the real status
  }

  function openPayment(s: Session) {
    setMessage(null);
    if (s.mock) return setMockOpen(true);
    openPaystack(s.accessCode, { onSuccess: (ref) => confirm(ref, s), onCancel: () => setMessage('Payment was not completed. Your order is saved for 24 hours: you can try again below.'), onError: (m) => setMessage(`Payment error: ${m}`) });
  }

  async function pay() {
    if (!q || submitting.current) return;
    submitting.current = true;
    setBusy(true); setMessage(null); setErrors({});
    const pricing = { lines: toInputLines(lines), code: code || undefined, giftCode: giftCode || undefined, state: deliveryState, extras, useCredit, acceptFinalSale: consent, giftMessage: giftMessage || undefined };
    const details = {
      email, phone, isGift, giftMessage: giftMessage || undefined, createAccount,
      address: digital ? { recipient: 'Digital order', phone, line1: 'Delivered by email', city: 'Lagos', state: 'Lagos' }
        : { recipient, phone: isGift ? rPhone : rPhone || phone, line1, area: area || undefined, city, state: deliveryState, instructions },
    };
    try {
      const res = await startCheckout(pricing, details, crypto.length ? method : 'paystack');
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); setMessage(res.message); if (Object.keys(res.fieldErrors ?? {}).length) document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center' }); return; }
      if (res.mode === 'paid' || res.mode === 'crypto') return succeed(res.number, res.token);
      const s: Session = { reference: res.reference, accessCode: res.accessCode, mock: res.mock, number: res.number, token: res.token, totalKobo: res.totalKobo };
      setSession(s); openPayment(s);
    } catch { setMessage('Something went wrong. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (mounted && lines.length === 0 && !session && !confirming) {
    return (<div className="py-10 text-center"><p className="display text-4xl">Your bag is empty</p><Button asChild className="mt-6"><Link href="/collections/all">Shop all</Link></Button></div>);
  }

  const hasConsent = q?.needsFinalSaleConsent;
  const canPay = !!q && !loading && !busy && !confirming && q.issues.length === 0 && (digital || (!q.shippingPending && !!recipient.trim() && !!deliveryState && !!line1.trim() && !!city.trim()));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5">
        <section className={section} aria-labelledby="c1"><h2 id="c1" className="display mb-4 text-3xl">1. Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...field('email')} /><Err k="email" /></div>
            <div><Label htmlFor="phone">Phone (WhatsApp)</Label><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} {...field('phone')} /><Err k="phone" /></div>
          </div>
          {!signedIn && <label className={`${check} mt-4`}><input type="checkbox" className="size-5 accent-ink" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} /><span className="text-sm">Email me a sign-in link so I can track this order from an account <span className="text-muted">(optional)</span></span></label>}
        </section>

        {!digital && (
          <section className={section} aria-labelledby="c2"><h2 id="c2" className="display mb-4 text-3xl">2. Delivery</h2>
            <label className={`${check} mb-4`}><input type="checkbox" className="size-5 accent-ink" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} /><span className="text-sm font-semibold">This is a gift for someone else</span></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="recipient">{isGift ? "Recipient's name" : 'Full name'}</Label><Input id="recipient" autoComplete={isGift ? 'off' : 'name'} value={recipient} onChange={(e) => setRecipient(e.target.value)} {...field('address.recipient')} /><Err k="address.recipient" /></div>
              <div><Label htmlFor="rphone">{isGift ? "Recipient's phone" : 'Delivery phone'}</Label><Input id="rphone" type="tel" inputMode="tel" placeholder={isGift ? '' : 'Same as above'} value={rPhone} onChange={(e) => setRPhone(e.target.value)} {...field('address.phone')} /><Err k="address.phone" /></div>
              <div className="sm:col-span-2"><Label htmlFor="line1">Street address</Label><Input id="line1" autoComplete="address-line1" value={line1} onChange={(e) => setLine1(e.target.value)} {...field('address.line1')} /><Err k="address.line1" /></div>
              <div><Label htmlFor="area">Area / landmark (optional)</Label><Input id="area" value={area} onChange={(e) => setArea(e.target.value)} /></div>
              <div><Label htmlFor="city">City / town</Label><Input id="city" autoComplete="address-level2" value={city} onChange={(e) => { setCity(e.target.value); setShippingRateId(''); }} {...field('address.city')} /><Err k="address.city" /></div>
              <div className="sm:col-span-2"><Label htmlFor="state">State</Label>
                <select id="state" value={deliveryState} onChange={(e) => { setDeliveryState(e.target.value); setShippingRateId(''); }} className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base" {...field('address.state')}>
                  <option value="">Select your state</option>{stateOptions.map((s) => (<option key={s}>{s}</option>))}
                </select>
                <p className="mt-1 text-sm text-muted">{q?.shippingPending ? SHIPPING_PENDING : q?.zone ? `${q.zone.name}: delivery ${q.deliveryFeeKobo === 0 ? 'is free' : formatNaira(q.deliveryFeeKobo)}.` : ''}</p><Err k="address.state" /></div>
            </div>
            {q && q.shippingOptions.length > 1 && <div className="mt-4"><Label htmlFor="shipping-service">Delivery service</Label><select id="shipping-service" className="min-h-12 w-full border border-line p-3" value={shippingRateId || q.zone?.id || ''} onChange={(e) => setShippingRateId(e.target.value)}>{q.shippingOptions.map((z) => <option key={z.id} value={z.id}>{[z.name, z.provider, z.service].filter(Boolean).join(' · ')}</option>)}</select></div>}
            <div className="mt-4"><Label htmlFor="instructions">Delivery instructions (optional)</Label><textarea id="instructions" maxLength={300} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full border border-line p-3" /></div>
            {isGift && (<div className="mt-4"><Label htmlFor="gm">Gift message (optional)</Label><textarea id="gm" rows={3} maxLength={300} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} className="w-full rounded-btn border border-line bg-paper p-3 text-base" placeholder="A note for the recipient" /></div>)}
          </section>
        )}

        {!digital && (
          <section className={section} aria-labelledby="c3"><h2 id="c3" className="display mb-4 text-3xl">3. Extras</h2>
            <div className="space-y-2">
              <label className={check}><input type="checkbox" className="size-5 accent-ink" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} /><span className="flex-1 text-sm font-semibold">Gift wrap and card</span><span className="text-sm font-semibold">+{formatNaira(addOns.giftWrapKobo)}</span></label>
              {deliveryState === 'Lagos' && <label className={check}><input type="checkbox" className="size-5 accent-ink" checked={surpriseNote} onChange={(e) => setSurpriseNote(e.target.checked)} /><span className="flex-1 text-sm font-semibold">Surprise delivery note <span className="font-normal text-muted">(Lagos only)</span></span><span className="text-sm font-semibold">+{formatNaira(addOns.surpriseNoteKobo)}</span></label>}
              {addOns.expressEnabled && !q?.hasCustom && <label className={check}><input type="checkbox" className="size-5 accent-ink" checked={express} onChange={(e) => setExpress(e.target.checked)} /><span className="flex-1 text-sm font-semibold">Express 48-hour production <span className="font-normal text-muted">(ready designs only)</span></span><span className="text-sm font-semibold">+{formatNaira(addOns.expressKobo)}</span></label>}
              {q?.hasCustom && lines.length > 1 && <label className={check}><input type="checkbox" className="size-5 accent-ink" checked={shipReadyFirst} onChange={(e) => setShipReadyFirst(e.target.checked)} /><span className="flex-1 text-sm font-semibold">Ship my ready items first <span className="font-normal text-muted">(otherwise everything ships together after your proof)</span></span><span className="text-sm font-semibold">+{formatNaira(q.zone?.feeKobo ?? 0)}</span></label>}
            </div>
          </section>
        )}

      </div>

      <aside className="h-fit space-y-4 rounded-lg border-2 border-ink bg-white p-5 lg:sticky lg:top-24" aria-label="Review and pay" aria-busy={loading}>
        <h2 className="display text-3xl">{digital ? '2' : '4'}. Review and pay</h2>
        {!q ? <div className="skeleton h-40" /> : (<>
          <Progress q={q} /><ul className="divide-y divide-line text-sm">{q.lines.map((l) => (<li key={l.id} className="flex justify-between gap-3 py-2"><span>{l.quantity > 1 ? `${l.quantity} × ` : ''}{l.name}{l.detail.length ? <span className="text-muted"> ({l.detail.join(', ')})</span> : null}</span><span className="shrink-0 font-semibold">{formatNaira(l.lineKobo)}</span></li>))}</ul>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(q.subtotalKobo)}</dd></div>
            {q.discount && <div className="flex justify-between text-mocha"><dt>Discount ({q.discount.code})</dt><dd>-{formatNaira(q.discount.amountKobo)}</dd></div>}
            {!digital && <div className="flex justify-between"><dt>Delivery ({q.zone?.name ?? deliveryState})</dt><dd>{q.shippingPending ? 'Awaiting confirmation' : q.deliveryFeeKobo === 0 ? 'Free' : formatNaira(q.deliveryFeeKobo)}</dd></div>}
            {q.giftWrapKobo > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{formatNaira(q.giftWrapKobo)}</dd></div>}
            {q.surpriseNoteKobo > 0 && <div className="flex justify-between"><dt>Surprise note</dt><dd>{formatNaira(q.surpriseNoteKobo)}</dd></div>}
            {q.expressKobo > 0 && <div className="flex justify-between"><dt>Express production</dt><dd>{formatNaira(q.expressKobo)}</dd></div>}
            {q.shipReadyFirstKobo > 0 && <div className="flex justify-between"><dt>Second delivery</dt><dd>{formatNaira(q.shipReadyFirstKobo)}</dd></div>}
            {q.giftCardAppliedKobo > 0 && <div className="flex justify-between text-mocha"><dt>Gift card</dt><dd>-{formatNaira(q.giftCardAppliedKobo)}</dd></div>}
            {q.creditAppliedKobo > 0 && <div className="flex justify-between text-mocha"><dt>Store credit</dt><dd>-{formatNaira(q.creditAppliedKobo)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-xl font-bold"><dt>{q.shippingPending ? 'Before delivery' : 'Total'}</dt><dd>{formatNaira(q.totalKobo)}</dd></div>
          </dl>
          {signedIn && q.creditAvailableKobo > 0 && <label className={check}><input type="checkbox" className="size-5 accent-ink" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /><span className="text-sm font-semibold">Use my store credit ({formatNaira(q.creditAvailableKobo)})</span></label>}

          <div className="rounded-md bg-sand/60 p-3 text-sm" aria-live="polite">
            {q.promise.customBy ? (<><strong>Estimated delivery {formatDeliveryDate(new Date(q.promise.customBy))}.</strong> Your proof arrives within {q.promise.proofHours} hours. <strong>Production starts when you approve your proof.</strong></>)
              : q.promise.readyBy ? <><strong>Estimated by {formatDeliveryDate(new Date(q.promise.readyBy))}.</strong> Timing starts after payment confirmation.</> : digital ? <>Delivered to your email after verified payment.</> : <>Delivery timing will be confirmed for your destination.</>}
          </div>
          {q.warnings.map((w) => (<p key={w} role="alert" className="rounded-md bg-ember/15 p-3 text-sm font-semibold">{w}</p>))}

          {hasConsent && (<label className={check}><input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span className="text-sm">I understand custom and personalised items are <strong>final sale</strong>, except for print defects or wrong items, which are replaced free. <span className="text-muted">(Required)</span></span></label>)}

          {q.issues.filter((i) => !i.includes('final sale')).slice(0, 4).map((i) => (<p key={i} role="alert" className="text-sm font-semibold text-ember">{i}</p>))}
          {message && <p role="alert" className="rounded-md bg-ember/10 p-3 text-sm">{message}</p>}

          {crypto.length > 0 && q.totalKobo > 0 && !session && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">How would you like to pay?</legend>
              <label className={check}><input type="radio" name="pay-method" className="size-5 accent-ink" checked={method === 'paystack'} onChange={() => setMethod('paystack')} /><span className="text-sm"><strong>Card, bank transfer or USSD</strong> <span className="text-muted">(Paystack)</span></span></label>
              <label className={check}><input type="radio" name="pay-method" className="size-5 accent-ink" checked={method === 'crypto'} onChange={() => setMethod('crypto')} /><span className="text-sm"><strong>Crypto</strong> <span className="text-muted">({Array.from(new Set(crypto.map((c) => c.asset))).join(', ')})</span></span></label>
              {method === 'crypto' && <p className="rounded-md bg-sand/60 p-3 text-xs">After you place the order you&apos;ll see the wallet address and the amount. Your order is confirmed once our team sees the payment arrive.</p>}
            </fieldset>
          )}

          {session && !confirming && !mockOpen && message?.includes('try again') ? (
            <Button className="w-full" onClick={() => openPayment(session)}>Try payment again · {formatNaira(session.totalKobo)}</Button>
          ) : (
            <Button className="w-full" disabled={!canPay} onClick={pay}>{confirming ? 'Confirming your payment…' : busy ? 'Preparing…' : q.totalKobo === 0 ? 'Place order' : method === 'crypto' && crypto.length ? `Place order · pay ${formatNaira(q.totalKobo)} in crypto` : `Pay ${formatNaira(q.totalKobo)} with Paystack`}</Button>
          )}
          {hasConsent && !consent && <p className="text-center text-xs text-muted">Please confirm the final-sale note above to continue.</p>}
          <p className="text-center text-xs text-muted">{method === 'crypto' && crypto.length ? 'You will send the payment from your own wallet.' : 'Card, bank transfer or USSD. We never see your card details.'}</p>
          <Link href="/bag" className="block text-center text-sm font-semibold underline underline-offset-4">Back to bag</Link>
        </>)}
      </aside>
      {mockOpen && session && <MockPaystack amountKobo={session.totalKobo} onPay={() => confirm(session.reference, session)} onCancel={() => { setMockOpen(false); setMessage('Payment was not completed. Your order is saved for 24 hours: you can try again below.'); }} />}
    </div>
  );
}
