'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, Truck } from 'lucide-react';
import { requestStockAlert, type StockAlertState } from '@/lib/actions/stock-alert';
import { useBag } from '@/lib/cart-store';
import { colourHex } from '@/lib/colours';
import { formatDeliveryDate, promisedDate } from '@/lib/delivery';
import { formatNaira } from '@/lib/money';
import type { ProductType } from '@/lib/catalogue/types';
import { SIZE_ORDER } from '@/lib/catalogue/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductVisual } from './product-visual';
import { SizeGuideDrawer } from './size-guide-drawer';

export type ViewVariant = { id: string; colour: string | null; size: string | null; option: string | null; group: string | null; priceKobo: number; soldOut: boolean; lowStock: number | null };
export type ViewProduct = {
  id: string; slug: string; name: string; type: ProductType; designSlug: string | null;
  compareAtKobo: number | null; madeToOrder: boolean; optionLabel: string;
  images: { url: string; alt: string }[]; variants: ViewVariant[];
};
export type ViewBundle = { slug: string; name: string; priceKobo: number; separateKobo: number; contents: string[] };
export type ViewZone = { name: string; states: string[]; feeKobo: number; leadDays: number };

const uniq = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];
const OPTION_LABELS: Partial<Record<ProductType, string>> = { frame: 'Frame', perfume: 'Scent', bracelet: 'Style', jewellery: 'Style', glasses: 'Frame', fun: 'Colour', gift_card: 'Amount' };

export function ProductView({ product: p, bundle, zones, children }: { product: ViewProduct; bundle: ViewBundle | null; zones: ViewZone[]; children?: React.ReactNode }) {
  const router = useRouter();
  const add = useBag((s) => s.add);
  const colours = useMemo(() => uniq(p.variants.map((v) => v.colour)), [p.variants]);
  const sizes = useMemo(() => uniq(p.variants.map((v) => v.size)).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)), [p.variants]);
  const options = useMemo(() => uniq(p.variants.map((v) => v.option)), [p.variants]);
  const optionLabel = OPTION_LABELS[p.type] ?? 'Style';

  const [colour, setColour] = useState<string | null>(() => (colours.includes('Black') ? 'Black' : colours[0] ?? null));
  const [size, setSize] = useState<string | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [gcEmail, setGcEmail] = useState('');
  const [gcMsg, setGcMsg] = useState('');
  const [added, setAdded] = useState(false);
  const [state, setState] = useState('Lagos');
  const [today, setToday] = useState<Date | null>(null);
  const [slide, setSlide] = useState(0);
  const [alert, alertAction, alertPending] = useActionState<StockAlertState, FormData>(requestStockAlert, null);

  useEffect(() => {
    setToday(new Date());
    try { const s = localStorage.getItem('pemart-state'); if (s) setState(s); } catch { /* storage may be blocked */ }
  }, []);
  const chooseState = (s: string) => { setState(s); try { localStorage.setItem('pemart-state', s); } catch { /* ignore */ } };

  const need = { colour: colours.length > 0, size: sizes.length > 0, option: options.length > 0 };
  const matches = (v: ViewVariant, c = colour, s = size, o = option) =>
    (!need.colour || v.colour === c) && (!need.size || v.size === s) && (!need.option || v.option === o);
  const selected = p.variants.find((v) => matches(v));
  const missing = need.colour && !colour ? 'colour' : need.size && !size ? 'size' : need.option && !option ? optionLabel.toLowerCase() : null;

  // A choice is unavailable when every variant that could complete it is sold out.
  const availableWith = (patch: Partial<{ c: string | null; s: string | null; o: string | null }>) => {
    const c = 'c' in patch ? patch.c! : colour, s = 's' in patch ? patch.s! : size, o = 'o' in patch ? patch.o! : option;
    return p.variants.some((v) => !v.soldOut && (!need.colour || !c || v.colour === c) && (!need.size || !s || v.size === s) && (!need.option || !o || v.option === o));
  };

  const price = selected?.priceKobo ?? Math.min(...p.variants.map((v) => v.priceKobo));
  const hasRange = !selected && new Set(p.variants.map((v) => v.priceKobo)).size > 1;
  const zone = zones.find((z) => z.states.includes(state)) ?? zones[zones.length - 1];
  const eta = today && zone ? formatDeliveryDate(promisedDate(today, zone.leadDays)) : null;
  const garment = p.type === 'tee' || p.type === 'hoodie';

  const slides = useMemo(() => {
    if (p.images.length) return p.images.map((im) => ({ key: im.url, label: im.alt, node: <ProductVisual type={p.type} designSlug={null} imageUrl={im.url} alt={im.alt} sizes="(min-width:1024px) 50vw, 100vw" priority /> }));
    if (garment) return (['front', 'back', 'detail'] as const).map((view) => ({
      key: view, label: view === 'detail' ? 'Close-up of the print' : `${view} view`,
      node: <ProductVisual type={p.type} designSlug={p.designSlug} colour={colour ?? 'Black'} view={view} alt={`${p.name}, ${view}`} />,
    }));
    return [{ key: 'main', label: p.name, node: <ProductVisual type={p.type} designSlug={p.designSlug} finish={option} imageUrl={null} alt={p.name} sizes="(min-width:1024px) 50vw, 100vw" priority /> }];
  }, [p, garment, colour, option]);
  const current = slides[Math.min(slide, slides.length - 1)]!;

  const addToBag = () => {
    if (!selected || selected.soldOut) return false;
    add({ id: crypto.randomUUID(), kind: 'variant', refId: selected.id, quantity: qty, ...(p.type === 'gift_card' ? { giftCard: { recipientEmail: gcEmail.trim() || undefined, message: gcMsg.trim() || undefined } } : {}) });
    setAdded(true); window.setTimeout(() => setAdded(false), 2500);
    return true;
  };
  const label = selected?.soldOut ? 'Sold out' : missing ? `Choose a ${missing}` : added ? 'Added to bag' : 'Add to bag';
  const disabled = !selected || selected.soldOut;

  const chip = (on: boolean, off: boolean) => `relative inline-flex min-h-12 min-w-12 items-center justify-center rounded-btn border-2 px-4 text-base font-semibold transition-colors ${on ? 'border-ink bg-ink text-paper' : off ? 'border-line bg-transparent text-muted line-through' : 'border-line bg-white hover:border-ink'}`;
  const groups = uniq(p.variants.map((v) => v.group));

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-line">{current.node}</div>
          {slides.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-2" aria-label="Product views">
              {slides.map((s, i) => (
                <li key={s.key}>
                  <button type="button" onClick={() => setSlide(i)} aria-label={`Show ${s.label}`} aria-current={i === slide} className={`block w-full overflow-hidden rounded-md border-2 ${i === slide ? 'border-ink' : 'border-line'}`}>{s.node}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Purchase panel */}
        <div className="space-y-6">
          <div>
            <h1 className="display text-4xl sm:text-5xl">{p.name}</h1>
            <p className="mt-2 text-2xl">
              {hasRange && <span className="text-base text-muted">From </span>}
              <span className="font-semibold">{formatNaira(price)}</span>
              {p.compareAtKobo && p.compareAtKobo > price && <span className="ml-2 text-lg text-muted line-through">{formatNaira(p.compareAtKobo)}</span>}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-mocha"><Truck className="size-4" aria-hidden />{p.type === 'gift_card' ? 'Delivered by email, instantly after payment' : <>Arrives in {zone?.leadDays ?? 5} days{p.madeToOrder ? ' · made to order' : ''}</>}</p>
          </div>

          {need.colour && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Colour: <span className="font-normal text-muted">{colour}</span></legend>
              <div className="flex flex-wrap gap-3">
                {colours.map((c) => {
                  const off = !availableWith({ c });
                  return (
                    <button key={c} type="button" onClick={() => setColour(c)} aria-pressed={colour === c} aria-label={`${c}${off ? ', sold out' : ''}`}
                      className={`grid size-12 place-items-center rounded-full border-2 ${colour === c ? 'border-ink' : 'border-line'} ${off ? 'opacity-40' : ''}`}>
                      <span className="size-8 rounded-full border border-ink/20" style={{ background: colourHex(c) }} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {need.size && (
            <fieldset>
              <div className="mb-2 flex items-center justify-between"><legend className="text-sm font-semibold">Size{size ? <>: <span className="font-normal text-muted">{size}</span></> : ''}</legend>
                {(p.type === 'tee' || p.type === 'hoodie' || p.type === 'frame') && <SizeGuideDrawer type={p.type} />}</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => { const off = !availableWith({ s }); return (<button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} aria-label={`${s}${off ? ', sold out' : ''}`} className={chip(size === s, off)}>{s}</button>); })}
              </div>
            </fieldset>
          )}

          {need.option && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">{optionLabel}{option ? <>: <span className="font-normal text-muted">{option}</span></> : ''}</legend>
              {(groups.length ? groups : [null]).map((g) => (
                <div key={g ?? 'all'}>
                  {g && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">For {g}</p>}
                  <div className="flex flex-wrap gap-2">
                    {uniq(p.variants.filter((v) => v.group === g).map((v) => v.option)).map((o) => { const off = !availableWith({ o }); return (<button key={o} type="button" onClick={() => setOption(o)} aria-pressed={option === o} aria-label={`${o}${off ? ', sold out' : ''}`} className={chip(option === o, off)}>{o}</button>); })}
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          {selected?.soldOut && (
            <form action={alertAction} className="rounded-lg border border-line bg-sand/50 p-4">
              <p className="font-semibold">Sold out for now</p>
              <p className="mb-3 text-sm text-muted">Leave your email and we&apos;ll tell you when this is back.</p>
              <input type="hidden" name="variantId" value={selected.id} />
              <div className="flex gap-2"><Input name="email" type="email" required autoComplete="email" placeholder="you@email.com" aria-label="Email for back-in-stock alert" /><Button type="submit" disabled={alertPending}>Notify me</Button></div>
              <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${alert?.ok ? 'text-mocha' : 'text-ember'}`}>{alert?.message}</p>
            </form>
          )}
          {selected && !selected.soldOut && selected.lowStock !== null && selected.lowStock <= 5 && <p className="text-sm font-semibold text-mocha">Only {selected.lowStock} left</p>}

          {p.type === 'gift_card' && (
            <div className="space-y-3 rounded-lg border border-line bg-white p-4">
              <p className="text-sm font-semibold">Who is it for? <span className="font-normal text-muted">(optional: leave blank to get the code yourself)</span></p>
              <Input type="email" value={gcEmail} onChange={(e) => setGcEmail(e.target.value)} placeholder="Recipient's email" aria-label="Recipient email" />
              <textarea value={gcMsg} onChange={(e) => setGcMsg(e.target.value)} maxLength={300} rows={2} placeholder="A message to go with it" aria-label="Gift card message" className="w-full rounded-btn border border-line bg-paper p-3 text-base" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-btn border-2 border-line bg-white" role="group" aria-label="Quantity">
              <button type="button" className="grid size-12 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="size-4" aria-hidden /></button>
              <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
              <button type="button" className="grid size-12 place-items-center" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Increase quantity"><Plus className="size-4" aria-hidden /></button>
            </div>
            <Button className="flex-1" disabled={disabled} onClick={addToBag}>{added && <Check className="size-5" aria-hidden />}{label}</Button>
          </div>
          <Button variant="secondary" className="w-full" disabled={disabled} onClick={() => { if (addToBag()) router.push('/bag'); }}>Buy now</Button>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-mocha">{added && <>Added. <Link href="/bag" className="font-semibold underline">View your bag</Link></>}</p>

 {p.type !== 'gift_card' && (<div className="rounded-lg border border-line bg-white p-4">
            <label htmlFor="state" className="text-sm font-semibold">Where are we delivering?</label>
            <select id="state" value={state} onChange={(e) => chooseState(e.target.value)} className="mt-2 min-h-12 w-full rounded-btn border border-line bg-paper px-3 text-base">
              {zones.flatMap((z) => z.states).sort((a, b) => a.localeCompare(b)).map((s) => (<option key={s}>{s}</option>))}
            </select>
            <p className="mt-3 text-sm" aria-live="polite">
              {eta ? <>Order today and it arrives by <strong>{eta}</strong>.</> : 'Arrives in 5 days.'}{' '}
              {zone && <span className="text-muted">Delivery from {formatNaira(zone.feeKobo)} in {zone.name}.</span>}
            </p>
          </div>)}

          {bundle && (
            <div className="rounded-lg border-2 border-ink p-4">
              <p className="font-script text-2xl text-mocha">complete the look</p>
              <p className="display text-2xl">{bundle.name}</p>
              <p className="text-sm text-muted">{bundle.contents.join(' + ')}</p>
              <p className="mt-2"><span className="text-xl font-semibold">{formatNaira(bundle.priceKobo)}</span>{bundle.separateKobo > bundle.priceKobo && (<> <span className="text-muted line-through">{formatNaira(bundle.separateKobo)}</span> <span className="font-semibold text-mocha">Save {formatNaira(bundle.separateKobo - bundle.priceKobo)}</span></>)}</p>
              <Button asChild variant="secondary" className="mt-3 w-full"><Link href={`/bundles/${bundle.slug}?start=${p.slug}`}>Build this bundle</Link></Button>
            </div>
          )}

          {children}
        </div>
      </div>

      {/* Sticky mobile bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-paper px-4 py-3 md:hidden">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-sm">{formatNaira(price)}</p></div>
        <Button className="ml-auto" disabled={disabled} onClick={addToBag}>{label}</Button>
      </div>
    </>
  );
}
