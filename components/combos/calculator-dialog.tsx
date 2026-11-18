'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCombo } from '@/lib/actions/combos';
import { useBag } from '@/lib/cart-store';
import { opener, useCalculator } from '@/lib/combos/calculator-store';
import { defaultSelection, priceCombo, startingPrice } from '@/lib/combos/pricing';
import { NOTES_MAX, TEXT_MAX, UNAVAILABLE_PRICE, type ComboCatalogue, type ComboComponent, type ComboConfig, type ComboSelection, type ComboSlot, type UnitChoice } from '@/lib/combos/types';
import { formatNaira } from '@/lib/money';

const field = 'min-h-11 w-full rounded-btn border border-line bg-paper px-3 text-base text-ink';
const legend = 'mb-2 text-sm font-bold uppercase tracking-[0.08em]';
let cache: Promise<ComboCatalogue> | null = null;
const loadCatalogue = () => (cache ??= fetch('/api/combos').then((r) => (r.ok ? (r.json() as Promise<ComboCatalogue>) : Promise.reject(new Error('load')))).catch((e) => { cache = null; throw e; }));

/** Mounted once in the store layout. Fetches the published combos the first time it opens, so no page carries their data. */
export function CalculatorDialog() {
  const { open, slug, editingLineId, drafts, close, select, setDraft, clearDraft } = useCalculator();
  const addLine = useBag((s) => s.add), removeLine = useBag((s) => s.remove);
  const [cat, setCat] = useState<ComboCatalogue | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && !cat) loadCatalogue().then(setCat).catch(() => setLoadError(true)); }, [open, cat]);
  useEffect(() => { setProblems([]); }, [slug, open]);
  const off = useMemo(() => new Set(cat?.unavailable ?? []), [cat]);
  const collections = cat?.collections ?? [];
  const config: ComboConfig | undefined = collections.find((c) => c.slug === slug) ?? (collections.length === 1 ? collections[0] : undefined);
  const sel: ComboSelection | null = useMemo(() => (config ? (drafts[config.slug] ?? defaultSelection(config, off)) : null), [config, drafts, off]);
  const quote = useMemo(() => (config && sel ? priceCombo(config, sel, { unavailable: off }) : null), [config, sel, off]);

  const update = (fn: (s: ComboSelection) => ComboSelection) => { if (config && sel) { setDraft(config.slug, fn(sel)); setProblems([]); } };
  const setUnit = (slot: ComboSlot, i: number, patch: Partial<UnitChoice>) => update((s) => {
    const units = Array.from({ length: slot.quantity }, (_, k) => ({ ...(s.units[slot.id]?.[k] ?? {}) }));
    units[i] = { ...units[i], ...patch };
    // A garment change drops a size/colour that the new garment does not have.
    if (patch.componentId && slot.kind === 'garment') { const c = slot.components.find((x) => x.id === patch.componentId); const keep = (id?: string) => (id && c?.options.some((o) => o.id === id) ? id : undefined); units[i] = { ...units[i], sizeId: keep(units[i]!.sizeId), colourId: keep(units[i]!.colourId) }; }
    if (patch.frameSizeId && slot.same_size_only) for (let k = 0; k < units.length; k++) units[k] = { ...units[k], frameSizeId: patch.frameSizeId };
    return { ...s, units: { ...s.units, [slot.id]: units } };
  });
  const setItem = (slot: ComboSlot, qty: number, notes?: string) => update((s) => ({ ...s, items: { ...s.items, [slot.id]: { qty, notes: notes ?? s.items[slot.id]?.notes } } }));

  async function add() {
    if (!config || !sel || !quote) return;
    if (!quote.ok) { setProblems(quote.issues); body.current?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    try {
      const live = await checkCombo(sel); // the server prices it again from the live data: that is the price that counts
      if (!live.ok) { setProblems(live.issues.length ? live.issues : [UNAVAILABLE_PRICE]); return; }
      if (editingLineId) removeLine(editingLineId);
      const selection = JSON.parse(JSON.stringify(sel)) as Record<string, unknown>;
      clearDraft(config.slug);
      close();
      addLine({ id: crypto.randomUUID(), kind: 'combo', refId: config.slug, quantity: 1, selection }, { name: config.name, unitKobo: live.unitKobo, category: 'combo' });
    } catch { setProblems(['Something went wrong. Please try again.']); } finally { setBusy(false); }
  }

  const price = quote?.priced ? formatNaira(quote.unitKobo) : null;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade fixed inset-0 z-50 bg-ink/60" />
        <Dialog.Content aria-describedby="combo-desc" onCloseAutoFocus={(e) => { e.preventDefault(); if (opener.el?.isConnected) opener.el.focus(); }} className="fixed inset-0 z-50 flex flex-col bg-paper md:m-auto md:h-fit md:max-h-[92vh] md:w-[min(56rem,94vw)] md:rounded-lg md:shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
            <div><Dialog.Title className="display text-2xl sm:text-3xl">Build Your Combo</Dialog.Title>
              <Dialog.Description id="combo-desc" className="text-sm text-muted">Choose what you wear and the promises you keep before your eyes. The price updates as you choose.</Dialog.Description></div>
            <Dialog.Close className="grid size-12 shrink-0 place-items-center rounded-btn hover:bg-sand" aria-label="Close"><X className="size-6" aria-hidden /></Dialog.Close>
          </div>
          <div ref={body} className="flex-1 overflow-y-auto px-5 py-4">
            {loadError && <p role="alert" className="rounded-lg border border-ember p-4">We could not load the combos. Please check your connection and try again.</p>}
            {!cat && !loadError && <p role="status" className="py-10 text-center text-muted">Loading…</p>}
            {cat && collections.length === 0 && <p className="rounded-lg border border-dashed border-line p-6 text-center">Combos are not available yet. Please check back soon.</p>}
            {cat && collections.length > 0 && (
              <div className="space-y-6">
                <fieldset><legend className={legend}>1. Choose your collection</legend>
                  <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Collection">
                    {collections.map((c) => { const from = startingPrice(c, off); const on = config?.slug === c.slug; return (
                      <label key={c.id} className={`flex min-h-11 cursor-pointer flex-col rounded-lg border-2 p-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${on ? 'border-ink bg-sand' : 'border-line hover:border-ink'}`}>
                        <input type="radio" name="combo-collection" value={c.slug} checked={on} onChange={() => select(c.slug)} className="sr-only" />
                        <span className="display text-xl">{c.name}</span>{c.label && <span className="text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</span>}
                        {c.tagline && <span className="mt-1 text-sm text-muted">{c.tagline}</span>}
                        <span className="mt-2 text-sm font-bold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</span></label>); })}
                  </div></fieldset>
                {config && sel && (<>
                  {(config.scripture_ref || config.description) && <p className="text-sm text-muted">{config.scripture_text ? `“${config.scripture_text}” ` : ''}{config.scripture_ref && <strong>{config.scripture_ref}. </strong>}{config.description}</p>}
                  {config.slots.filter((s) => s.mode !== 'unavailable').sort((a, b) => a.sort_order - b.sort_order).map((slot) => (
                    <SlotView key={slot.id} slot={slot} sel={sel} off={off} setUnit={setUnit} setItem={setItem} />))}
                </>)}
              </div>)}
          </div>
          {config && quote && (
            <div className="border-t border-line bg-paper px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <div role="status" aria-live="polite" className="sr-only">{price ? `Total ${price}` : UNAVAILABLE_PRICE}</div>
              {problems.length > 0 && (<ul role="alert" className="mb-2 space-y-0.5 text-sm text-ember">{problems.map((p) => (<li key={p}>{p}</li>))}</ul>)}
              <details className="mb-2 text-sm"><summary className="min-h-8 cursor-pointer font-semibold">See price breakdown</summary>
                {quote.priced ? (<ul className="mt-1 space-y-0.5">{quote.lines.map((l) => (<li key={l.key} className="flex justify-between gap-3"><span>{l.label}</span><span className={l.amountKobo < 0 ? 'text-mocha' : ''}>{l.amountKobo < 0 ? '−' : l.kind === 'package' ? '' : '+'}{formatNaira(Math.abs(l.amountKobo))}</span></li>))}</ul>)
                  : <p className="mt-1 text-muted">{UNAVAILABLE_PRICE}</p>}</details>
              <div className="flex items-center justify-between gap-3">
                <p><span className="block text-xs font-semibold uppercase tracking-wide text-muted">Total</span><span className="display text-3xl" data-testid="combo-total">{price ?? UNAVAILABLE_PRICE}</span></p>
                <button type="button" onClick={add} disabled={busy || !quote.priced} className="inline-flex min-h-12 items-center justify-center rounded-btn bg-ink px-6 text-sm font-semibold uppercase tracking-[0.1em] text-paper hover:bg-ink/85 disabled:opacity-50">
                  {busy ? 'Checking…' : editingLineId ? 'Update bag' : 'Add to bag'}</button></div>
              <p className="mt-1 text-xs text-muted">Made to order. Customised items are final sale once production starts.</p>
            </div>)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SlotView({ slot, sel, off, setUnit, setItem }: { slot: ComboSlot; sel: ComboSelection; off: ReadonlySet<string>; setUnit: (s: ComboSlot, i: number, p: Partial<UnitChoice>) => void; setItem: (s: ComboSlot, qty: number, notes?: string) => void }) {
  const units = sel.units[slot.id] ?? [];
  const ok = (c: ComboComponent) => c.available && !off.has(c.id);
  if (slot.kind === 'garment') {
    return (<>{Array.from({ length: slot.quantity }, (_, i) => {
      const u = units[i] ?? {}; const comp = slot.components.find((c) => c.id === u.componentId);
      const sizes = comp?.options.filter((o) => o.group === 'size') ?? [], colours = comp?.options.filter((o) => o.group === 'colour') ?? [];
      const id = `g-${slot.id}-${i}`;
      return (
        <fieldset key={id} className="rounded-lg border border-line p-3"><legend className={`${legend} px-1`}>2. {slot.quantity > 1 ? `${slot.label} ${i + 1}` : slot.label}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Garment">
            {slot.components.map((c) => (<label key={c.id} className={`flex min-h-11 cursor-pointer items-center rounded-btn border-2 px-4 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${u.componentId === c.id ? 'border-ink bg-ink text-paper' : 'border-line'} ${ok(c) ? '' : 'opacity-50'}`}>
              <input type="radio" className="sr-only" name={`${id}-garment`} checked={u.componentId === c.id} disabled={!ok(c)} onChange={() => setUnit(slot, i, { componentId: c.id })} />{c.name}{ok(c) ? '' : ' (unavailable)'}</label>))}</div>
          {comp && (<div className="mt-3 grid gap-3 sm:grid-cols-2">
            {colours.length > 0 && <div><label htmlFor={`${id}-c`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Colour</label><select id={`${id}-c`} value={u.colourId ?? ''} onChange={(e) => setUnit(slot, i, { colourId: e.target.value || undefined })} className={field}><option value="">Choose a colour</option>{colours.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}</select></div>}
            {sizes.length > 0 && <div><label htmlFor={`${id}-s`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Size</label><select id={`${id}-s`} value={u.sizeId ?? ''} onChange={(e) => setUnit(slot, i, { sizeId: e.target.value || undefined })} className={field}><option value="">Choose a size</option>{sizes.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}</select></div>}
            {slot.customise && <div className="sm:col-span-2"><label htmlFor={`${id}-t`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Your Scripture or words for the garment (optional)</label><input id={`${id}-t`} maxLength={TEXT_MAX} value={u.text ?? ''} onChange={(e) => setUnit(slot, i, { text: e.target.value })} placeholder="e.g. Psalm 119:18" className={field} /></div>}
          </div>)}
        </fieldset>);
    })}</>);
  }
  if (slot.kind === 'frame') {
    const comp = slot.components[0]; const sizes = comp?.options.filter((o) => o.group === 'frame_size') ?? [];
    return (<fieldset className="rounded-lg border border-line p-3"><legend className={`${legend} px-1`}>3. {slot.quantity > 1 ? `Your ${slot.quantity} frames` : slot.label}</legend>
      {comp && !ok(comp) && <p className="text-sm text-ember">{comp.name} is currently unavailable.</p>}
      {slot.same_size_only && slot.quantity > 1 && <p className="mb-2 text-sm text-muted">All frames in this combo are the same size.</p>}
      <div className="space-y-4">{Array.from({ length: slot.quantity }, (_, i) => {
        const u = units[i] ?? {}; const id = `f-${slot.id}-${i}`;
        return (<div key={id} className={slot.quantity > 1 ? 'rounded-md bg-sand/50 p-3' : ''}>
          {slot.quantity > 1 && <p className="mb-1 text-sm font-semibold">Frame {i + 1}</p>}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Frame ${i + 1} size`}>{sizes.map((o) => (
            <label key={o.id} className={`flex min-h-11 cursor-pointer items-center rounded-btn border-2 px-4 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${u.frameSizeId === o.id ? 'border-ink bg-ink text-paper' : 'border-line bg-paper'}`}>
              <input type="radio" className="sr-only" name={`${id}-size`} checked={u.frameSizeId === o.id} onChange={() => setUnit(slot, i, { frameSizeId: o.id })} />{o.label}</label>))}</div>
          {slot.customise && (<div className="mt-2"><label htmlFor={`${id}-t`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Scripture or promise for {slot.quantity > 1 ? `frame ${i + 1}` : 'your frame'}</label>
            <input id={`${id}-t`} maxLength={TEXT_MAX} value={u.text ?? ''} onChange={(e) => setUnit(slot, i, { text: e.target.value })} placeholder="e.g. Jeremiah 29:11" className={field} /></div>)}
        </div>);
      })}</div></fieldset>);
  }
  const comp = slot.components[0]; if (!comp) return null;
  if (slot.mode === 'required') return (<p className="rounded-lg bg-sand/50 px-3 py-2 text-sm"><strong>Included:</strong> {slot.quantity > 1 ? `${slot.quantity} × ` : ''}{comp.name}{comp.description ? <span className="text-muted"> · {comp.description}</span> : null}{ok(comp) ? '' : ' (currently unavailable)'}</p>);
  const price = slot.extra_price_kobo ?? comp.public_price_kobo; const cur = sel.items[slot.id]?.qty ?? 0; const id = `i-${slot.id}`;
  if (price == null || !ok(comp)) return (<p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">{comp.name}: {ok(comp) ? 'not available to add right now.' : 'currently unavailable.'}</p>);
  return (<div className="rounded-lg border border-line p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"><input id={id} type="checkbox" checked={cur > 0} onChange={(e) => setItem(slot, e.target.checked ? Math.max(1, slot.min_qty) : 0)} className="size-5 accent-ink" />Add {comp.name} <span className="font-normal text-muted">+{formatNaira(price)}{slot.max_qty > 1 ? ' each' : ''}</span></label>
      {cur > 0 && slot.max_qty > 1 && (<label className="flex items-center gap-2 text-sm">Quantity <select aria-label={`${comp.name} quantity`} value={cur} onChange={(e) => setItem(slot, Number(e.target.value))} className="min-h-11 rounded-btn border border-line bg-paper px-2">{Array.from({ length: slot.max_qty - Math.max(1, slot.min_qty) + 1 }, (_, k) => k + Math.max(1, slot.min_qty)).map((n) => (<option key={n} value={n}>{n}</option>))}</select></label>)}</div>
    {comp.description && <p className="text-xs text-muted">{comp.description}</p>}
    {cur > 0 && comp.customisable && (<div className="mt-2"><label htmlFor={`${id}-n`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Note for this item (optional)</label><input id={`${id}-n`} maxLength={NOTES_MAX} value={sel.items[slot.id]?.notes ?? ''} onChange={(e) => setItem(slot, cur, e.target.value)} className={field} /></div>)}
  </div>);
}
