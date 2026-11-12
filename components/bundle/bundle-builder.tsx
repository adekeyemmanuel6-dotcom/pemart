'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Gift } from 'lucide-react';
import { useBag } from '@/lib/cart-store';
import { colourHex } from '@/lib/colours';
import { formatNaira } from '@/lib/money';
import type { ProductType } from '@/lib/catalogue/types';
import {
  CUSTOM_TEXT_MAX, GIFT_MESSAGE_MAX, completedUnits, unitColours, unitOptions, unitProduct, unitSizes, validateSelection,
  type BundleContext, type CtxUnit, type UnitChoice,
} from '@/lib/bundles/selection';
import { Button } from '@/components/ui/button';
import { ProductVisual } from '@/components/product/product-visual';

const garment = (t: string) => t === 'tee' || t === 'hoodie';

export function BundleBuilder({ ctx, giftWrapKobo }: { ctx: BundleContext; giftWrapKobo: number }) {
  const params = useSearchParams();
  const add = useBag((s) => s.add);
  const [choices, setChoices] = useState<Record<string, UnitChoice>>(() =>
    Object.fromEntries(ctx.units.map((u) => [u.key, { key: u.key, colour: u.requiresColour ? 'Black' : undefined }])));
  const [giftMessage, setGiftMessage] = useState('');
  const [giftWrap, setGiftWrap] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [added, setAdded] = useState(false);
  const unitRefs = useRef<Record<string, HTMLElement | null>>({});

  const setDesign = (unit: CtxUnit, designSlug: string) =>
    setChoices((c) => {
      const next = { ...c };
      for (const u of ctx.units) if (u.key === unit.key || (unit.matchingGroup && u.matchingGroup === unit.matchingGroup && u.designs)) next[u.key] = { ...next[u.key]!, designSlug };
      return next;
    });
  const patch = (key: string, p: Partial<UnitChoice>) => setChoices((c) => ({ ...c, [key]: { ...c[key]!, ...p } }));

  // Prefill from links such as /bundles/signature?start=seek-first-tee or /bundles/two-of-us-starter?design=my-beloved&his=M&her=S
  useEffect(() => {
    const design = params.get('design') ?? params.get('start')?.replace(/-(tee|hoodie|frame)$/, '');
    const startType = params.get('start')?.match(/-(tee|hoodie|frame)$/)?.[1];
    setChoices((c) => {
      const next = { ...c };
      if (design) {
        const target = ctx.units.find((u) => u.designs?.some((d) => d.slug === design) && (!startType || u.productType === startType));
        if (target) for (const u of ctx.units) if (u.key === target.key || (target.matchingGroup && u.matchingGroup === target.matchingGroup && u.designs?.some((d) => d.slug === design))) next[u.key] = { ...next[u.key]!, designSlug: design };
      }
      const valid = ['S', 'M', 'L', 'XL', 'XXL'];
      for (const u of ctx.units) {
        const who = /^his\b/i.test(u.label) ? params.get('his') : /^her\b/i.test(u.label) ? params.get('her') : null;
        if (who && valid.includes(who) && u.requiresSize) next[u.key] = { ...next[u.key]!, size: who };
      }
      return next;
    });
  }, [params, ctx.units]);

  // Bring a pre-selected design into view inside its scrollable grid (without scrolling the page). Runs once.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    const grids = [...document.querySelectorAll<HTMLElement>('[data-design-grid]')];
    const hit = grids.filter((g) => g.querySelector('[aria-pressed="true"]'));
    if (!hit.length) return;
    scrolled.current = true;
    hit.forEach((g) => { g.scrollTop = Math.max(0, g.querySelector<HTMLElement>('[aria-pressed="true"]')!.offsetTop - 4); });
  }, [choices]);

  const selection = useMemo(() => ({ bundleSlug: ctx.bundle.slug, choices: ctx.units.map((u) => choices[u.key]!), giftMessage, giftWrap }), [ctx, choices, giftMessage, giftWrap]);
  const done = completedUnits(ctx, selection);
  const total = ctx.bundle.priceKobo + (giftWrap ? giftWrapKobo : 0);
  const saving = ctx.bundle.separateKobo - ctx.bundle.priceKobo;

  const submit = () => {
    const res = validateSelection(ctx, selection);
    if (!res.ok) {
      setIssues(res.issues.map((i) => i.message));
      const first = res.issues.find((i) => unitRefs.current[i.key]);
      unitRefs.current[first?.key ?? '']?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setIssues([]);
    add({ id: crypto.randomUUID(), kind: 'bundle', refId: ctx.bundle.slug, quantity: 1, selection: { ...selection }, giftMessage: giftMessage || undefined, giftWrap });
    setAdded(true);
  };

  const chip = (on: boolean, off = false) => `inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border-2 px-3 text-sm font-semibold ${on ? 'border-ink bg-ink text-paper' : off ? 'border-line text-muted line-through' : 'border-line bg-white hover:border-ink'}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ol className="space-y-5">
        {ctx.units.map((u, idx) => {
          const c = choices[u.key]!;
          const follower = !!u.matchingGroup && ctx.units.findIndex((x) => x.matchingGroup === u.matchingGroup && x.designs) !== idx && !!u.designs;
          const leader = follower ? ctx.units.find((x) => x.matchingGroup === u.matchingGroup && x.designs)! : null;
          const product = unitProduct(ctx, u, c);
          const colours = unitColours(product), sizes = unitSizes(product), options = unitOptions(u, product);
          const unitIssues = false;
          void unitIssues;
          const complete = !validateSelection({ ...ctx, units: [u], bundle: { ...ctx.bundle, available: true } }, { ...selection, choices: [c] }).issues.some((i) => i.key === u.key);
          return (
            <li key={u.key} ref={(el) => { unitRefs.current[u.key] = el; }} className="rounded-lg border border-line bg-white p-4 sm:p-5">
              <div className="flex gap-4">
                <div className="w-24 shrink-0 overflow-hidden rounded-md sm:w-32">
                  <ProductVisual type={u.productType as ProductType} designSlug={c.designSlug ?? null} colour={c.colour ?? 'Black'} finish={c.option} imageUrl={u.designs && !c.designSlug ? '/placeholders/' + u.productType + '.svg' : null} alt={u.label} sizes="128px" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-bold">{idx + 1}. {u.label}{complete && <Check className="size-5 text-mocha" aria-label="Chosen" />}</h3>
                  {product && <p className="text-sm text-muted">{product.name}</p>}
                </div>
              </div>

              {u.designs && (
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold">Design{c.designSlug ? <span className="font-normal text-muted">: {u.designs.find((d) => d.slug === c.designSlug)?.name}</span> : ''}</legend>
                  {follower && leader ? (
                    <p className="rounded-md bg-sand/60 p-3 text-sm">Matches {leader.label}. Change the design there and this updates too.</p>
                  ) : (
                    <ul data-design-grid className="relative grid max-h-60 grid-cols-3 gap-2 overflow-y-auto rounded-md sm:grid-cols-4" role="list">
                      {u.designs.map((d) => (
                        <li key={d.slug}>
                          <button type="button" aria-pressed={c.designSlug === d.slug} onClick={() => setDesign(u, d.slug)} className={`block w-full overflow-hidden rounded-md border-2 text-left ${c.designSlug === d.slug ? 'border-ink' : 'border-line'}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/designs/${d.slug}-card.svg`} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                            <span className="block px-1.5 py-1 text-xs font-semibold leading-tight">{d.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              )}

              {u.requiresColour && colours.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold">Colour<span className="font-normal text-muted">: {c.colour}</span></legend>
                  <div className="flex flex-wrap gap-2">{colours.map((col) => (
                    <button key={col} type="button" aria-pressed={c.colour === col} aria-label={col} onClick={() => patch(u.key, { colour: col })} className={`grid size-11 place-items-center rounded-full border-2 ${c.colour === col ? 'border-ink' : 'border-line'}`}><span className="size-7 rounded-full border border-ink/20" style={{ background: colourHex(col) }} /></button>
                  ))}</div>
                </fieldset>
              )}

              {u.requiresSize && sizes.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold">Size{c.size ? <span className="font-normal text-muted">: {c.size}</span> : ''}</legend>
                  <div className="flex flex-wrap gap-2">{sizes.map((s) => (<button key={s} type="button" aria-pressed={c.size === s} onClick={() => patch(u.key, { size: s })} className={chip(c.size === s)}>{s}</button>))}</div>
                </fieldset>
              )}

              {u.requiresOption && (
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold">{u.optionLabel ?? 'Style'}{c.option ? <span className="font-normal text-muted">: {c.option}</span> : ''}</legend>
                  <div className="flex flex-wrap gap-2">{options.map((o) => (<button key={o.option} type="button" disabled={o.soldOut} aria-pressed={c.option === o.option} onClick={() => patch(u.key, { option: o.option })} className={chip(c.option === o.option, o.soldOut)}>{o.option}</button>))}</div>
                </fieldset>
              )}

              {u.requiresCustomText && (
                <div className="mt-4">
                  <label htmlFor={`txt-${u.key}`} className="mb-1.5 block text-sm font-semibold">Names on the frame</label>
                  <input id={`txt-${u.key}`} value={c.customText ?? ''} maxLength={CUSTOM_TEXT_MAX} onChange={(e) => patch(u.key, { customText: e.target.value })} placeholder="e.g. Ada & Tunde" className="min-h-12 w-full rounded-btn border border-line bg-paper px-4 text-base" />
                </div>
              )}
            </li>
          );
        })}

        <li className="rounded-lg border border-line bg-white p-4 sm:p-5">
          <h3 className="text-lg font-bold">Make it a gift</h3>
          <label htmlFor="gift-msg" className="mt-3 block text-sm font-semibold">Gift card message <span className="font-script text-xl font-normal text-mocha">for you</span></label>
          <textarea id="gift-msg" rows={3} maxLength={GIFT_MESSAGE_MAX} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Write a few words to go on the card (optional)" className="mt-1.5 w-full rounded-btn border border-line bg-paper p-3 text-base" />
          <p className="text-right text-xs text-muted">{giftMessage.length}/{GIFT_MESSAGE_MAX}</p>
          <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-btn border border-line bg-paper px-4">
            <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="size-5 accent-ink" />
            <span className="flex-1"><Gift className="mr-1.5 inline size-4" aria-hidden /><span className="font-semibold">Gift wrap and card</span></span>
            <span className="font-semibold">+{formatNaira(giftWrapKobo)}</span>
          </label>
        </li>
      </ol>

      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Bundle summary">
        <div className="rounded-lg border-2 border-ink bg-white p-5">
          <p className="font-script text-2xl text-mocha">what&apos;s inside</p>
          <ul className="mt-2 divide-y divide-line">
            {ctx.units.map((u) => { const c = choices[u.key]!; return (
              <li key={u.key} className="flex items-center gap-3 py-2 text-sm">
                <div className="w-10 shrink-0 overflow-hidden rounded"><ProductVisual type={u.productType as ProductType} designSlug={c.designSlug ?? null} colour={c.colour ?? 'Black'} finish={c.option} imageUrl={u.designs && !c.designSlug ? '/placeholders/' + u.productType + '.svg' : null} alt="" sizes="40px" /></div>
                <span className="flex-1"><span className="font-semibold">{u.label}</span><span className="block text-xs text-muted">{[u.designs?.find((d) => d.slug === c.designSlug)?.name, garment(u.productType) ? c.colour : null, c.size, c.option].filter(Boolean).join(' · ') || 'Not chosen yet'}</span></span>
              </li>); })}
          </ul>
          <dl className="mt-4 space-y-1">
            {saving > 0 && <div className="flex justify-between text-sm text-muted"><dt>Bought separately</dt><dd className="line-through">{formatNaira(ctx.bundle.separateKobo)}</dd></div>}
            <div className="flex justify-between"><dt className="font-semibold">Bundle price</dt><dd className="text-xl font-bold">{formatNaira(ctx.bundle.priceKobo)}</dd></div>
            {saving > 0 && <div className="flex justify-between text-sm font-semibold text-mocha"><dt>You save</dt><dd>{formatNaira(saving)}</dd></div>}
            {giftWrap && <div className="flex justify-between text-sm"><dt>Gift wrap</dt><dd>{formatNaira(giftWrapKobo)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Total</dt><dd className="text-xl font-bold">{formatNaira(total)}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted" aria-live="polite">{done} of {ctx.units.length} items chosen</p>
          <Button className="mt-3 w-full" onClick={submit}>{added ? 'Added. Add another?' : 'Add bundle to bag'}</Button>
          {added && <Button asChild variant="secondary" className="mt-2 w-full"><Link href="/bag">View bag</Link></Button>}
          <div role="alert" aria-live="assertive">
            {issues.length > 0 && (<ul className="mt-3 list-disc space-y-1 rounded-md bg-ember/10 p-3 pl-7 text-sm">{issues.slice(0, 6).map((m, i) => (<li key={i}>{m}</li>))}{issues.length > 6 && <li>and {issues.length - 6} more</li>}</ul>)}
          </div>
          <p className="mt-3 text-xs text-muted">Delivery services and timing are confirmed at checkout. Prices are confirmed again at checkout.</p>
        </div>
      </aside>
    </div>
  );
}
