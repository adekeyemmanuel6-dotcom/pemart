'use client';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionForm } from './action-form';
import { AdminUploader } from './admin-uploader';
import { inputCls, labelCls } from './ui';
import { buildWorkingConfig, type CollectionRow, type LibraryItem, type RuleRow, type SlotRow } from '@/lib/combos/build';
import { koboToNaira, nairaToKobo } from '@/lib/combos/money';
import { configIssues, enumerateConfigs, estimateCost, frameSignature, priceCombo, profit } from '@/lib/combos/pricing';
import type { ComboOverheads } from '@/lib/combos/types';
import { formatNaira } from '@/lib/money';
import { publishComboAction, saveComboAction, saveComboCostsAction } from '@/lib/admin/actions-combos';

type Tab = 'details' | 'contents' | 'pricing' | 'costs' | 'publish';
type Props = {
  id: string | null; initial: { collection: CollectionRow; slots: SlotRow[]; rules: RuleRow[]; overheads?: ComboOverheads };
  library: LibraryItem[]; bundles: { id: string; name: string }[]; status: 'draft' | 'published' | 'archived'; hasUnpublishedChanges: boolean; isOwner: boolean; orders: number;
};
const uid = () => crypto.randomUUID();
const card = 'rounded-lg border border-line bg-sand/40 p-4';

/** Money field: type naira, state holds kobo. Keeps what you typed while you type. */
function Naira({ id, label, value, onChange, help, placeholder }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; help?: string; placeholder?: string }) {
  const [text, setText] = useState(koboToNaira(value));
  const [bad, setBad] = useState(false);
  return (
    <div>
      <label className={labelCls} htmlFor={id}>{label}</label>
      <div className="relative"><span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₦</span>
        <input id={id} inputMode="decimal" value={text} placeholder={placeholder ?? 'Not set'} aria-invalid={bad || undefined} className={`${inputCls} pl-8`}
          onChange={(e) => { setText(e.target.value); const k = nairaToKobo(e.target.value); setBad(k === undefined); if (k !== undefined) onChange(k); }} /></div>
      {bad && <p className="mt-1 text-xs text-ember">Enter an amount like 25000</p>}
      {help && !bad && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}

export function ComboEditor({ id, initial, library, bundles, status, hasUnpublishedChanges, isOwner, orders }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const [c, setC] = useState<CollectionRow>(initial.collection);
  const [slots, setSlots] = useState<SlotRow[]>(initial.slots);
  const [rules, setRules] = useState<RuleRow[]>(initial.rules);
  const [overheads, setOverheads] = useState<ComboOverheads>(initial.overheads ?? { printing_apparel_kobo: 0, frame_artwork_kobo: 0, packaging_kobo: 0, labor_kobo: 0, processing_fee_kobo: 0, other_kobo: 0 });
  const setSlot = (sid: string, p: Partial<SlotRow>) => setSlots((a) => a.map((s) => (s.id === sid ? { ...s, ...p } : s)));
  const setRule = (rid: string, p: Partial<RuleRow>) => setRules((a) => a.map((r) => (r.id === rid ? { ...r, ...p } : r)));
  const moveSlot = (i: number, d: number) => setSlots((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  const config = useMemo(() => buildWorkingConfig(c, id ?? 'new', slots, rules, library, initial.overheads ? overheads : isOwner ? overheads : undefined), [c, id, slots, rules, library, overheads, isOwner, initial.overheads]);
  const issues = useMemo(() => configIssues(config), [config]);
  const errors = issues.filter((i) => i.level === 'error');
  const matrix = useMemo(() => enumerateConfigs(config).map((e) => ({ e, q: priceCombo(config, e.selection), cost: isOwner ? estimateCost(config, e.selection) : null })), [config, isOwner]);

  const garments = library.filter((l) => l.kind === 'garment');
  const gSlot = slots.find((s) => s.kind === 'garment');
  const frameSlots = slots.filter((s) => s.kind === 'frame');
  const frameComp = frameSlots[0]?.component_id ? library.find((l) => l.id === frameSlots[0]!.component_id) : undefined;
  const frameOptions = frameComp?.all_options.filter((o) => o.group === 'frame_size' && o.is_active) ?? [];
  const nFrames = frameSlots.reduce((n, s) => n + s.quantity, 0);
  const garmentUnits = slots.filter((s) => s.kind === 'garment' && s.mode !== 'unavailable').reduce((n, s) => n + s.quantity, 0);
  const allowedGarments = garments.filter((g) => (gSlot?.allowed_component_ids ?? []).includes(g.id));

  const adjust = (kind: 'garment_adjust' | 'frame_size_adjust', key: string) => rules.find((r) => r.kind === kind && (kind === 'garment_adjust' ? r.component_id === key : r.option_id === key));
  const setAdjust = (kind: 'garment_adjust' | 'frame_size_adjust', key: string, amount: number | null) => setRules((a) => {
    const match = (r: RuleRow) => r.kind === kind && (kind === 'garment_adjust' ? r.component_id === key : r.option_id === key);
    const rest = a.filter((r) => !match(r));
    if (amount === null) return rest;
    const prev = a.find(match);
    return [...rest, prev ? { ...prev, amount_kobo: amount } : { id: uid(), kind, component_id: kind === 'garment_adjust' ? key : null, option_id: kind === 'frame_size_adjust' ? key : null, frame_signature: null, amount_kobo: amount, discount_type: null, discount_value: null, label: null, starts_at: null, ends_at: null, is_active: true }];
  });
  const fixed = rules.filter((r) => r.kind === 'fixed_variant');
  const discounts = rules.filter((r) => r.kind === 'promo' || r.kind === 'bundle_discount');
  const sigIds = (r: RuleRow) => (r.frame_signature ? r.frame_signature.split(',') : []);
  const setSig = (r: RuleRow, idx: number, optId: string) => { const ids = Array.from({ length: nFrames }, (_, i) => sigIds(r)[i] ?? frameOptions[0]?.id ?? ''); ids[idx] = optId; setRule(r.id, { frame_signature: frameSignature(ids.filter(Boolean)) }); };
  const addAllFixed = () => setRules((a) => {
    const have = new Set(a.filter((r) => r.kind === 'fixed_variant').map((r) => `${r.component_id}|${r.frame_signature}`));
    const add: RuleRow[] = [];
    for (const m of matrix) { const sig = frameSignature(m.e.frameSizeIds); if (!have.has(`${m.e.garmentId}|${sig}`)) add.push({ id: uid(), kind: 'fixed_variant', component_id: m.e.garmentId, option_id: null, frame_signature: sig, amount_kobo: null, discount_type: null, discount_value: null, label: m.e.label, starts_at: null, ends_at: null, is_active: false }); }
    return [...a, ...add];
  });

  const payload = JSON.stringify({ id: id ?? undefined, collection: { ...c, legacy_bundle_id: c.legacy_bundle_id || null }, slots, rules: rules.filter((r) => !(r.kind === 'fixed_variant' && r.amount_kobo == null)) });
  const tabs: [Tab, string][] = [['details', '1. Details'], ['contents', '2. Package contents'], ['pricing', '3. Selling prices'], ...(isOwner ? [['costs', '4. Costs & profit'] as [Tab, string]] : []), ['publish', isOwner ? '5. Preview & publish' : '4. Preview & publish']];

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Combo sections">
        {tabs.map(([k, label]) => (<button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-btn border-2 px-4 text-sm font-semibold ${tab === k ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'}`}>{label}</button>))}
      </nav>

      {/* The save form wraps everything; the other tabs just show or hide parts of it. */}
      <ActionForm action={saveComboAction} submitLabel={id ? 'Save draft' : 'Create combo'} pendingLabel="Saving…" className="space-y-4">
        <input type="hidden" name="payload" value={payload} />

        <section hidden={tab !== 'details'} className={card} aria-label="Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} htmlFor="c-name">Collection name</label><input id="c-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="c-slug">Web address (…/combos/this)</label><input id="c-slug" value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="c-label">Label (Basic, Max, Signature, Premium…)</label><input id="c-label" value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="c-sort">Display order</label><input id="c-sort" type="number" min={0} value={c.sort_order} onChange={(e) => setC({ ...c, sort_order: Number(e.target.value) || 0 })} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="c-tag">Theme line</label><input id="c-tag" value={c.tagline} onChange={(e) => setC({ ...c, tagline: e.target.value })} placeholder="See the Word. Remember the Promise." className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="c-ref">Scripture reference</label><input id="c-ref" value={c.scripture_ref} onChange={(e) => setC({ ...c, scripture_ref: e.target.value })} placeholder="Psalm 119:18" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="c-legacy">Replaces this older bundle (it is kept, never deleted)</label>
              <select id="c-legacy" value={c.legacy_bundle_id ?? ''} onChange={(e) => setC({ ...c, legacy_bundle_id: e.target.value || null })} className={inputCls}><option value="">None</option>{bundles.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="c-text">Scripture text (optional, shown on the page)</label><textarea id="c-text" rows={2} value={c.scripture_text} onChange={(e) => setC({ ...c, scripture_text: e.target.value })} className={`${inputCls} py-2`} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="c-desc">Description</label><textarea id="c-desc" rows={3} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} className={`${inputCls} py-2`} /></div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="c-img">Collection picture</label>
              <input id="c-img" value={c.image_url} onChange={(e) => setC({ ...c, image_url: e.target.value })} placeholder="Paste a picture link, or upload below" className={inputCls} />
              {c.image_url && /^(\/|https?:)/.test(c.image_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="mt-2 max-h-40 rounded border border-line" />
              )}
              <div className="mt-2"><AdminUploader bucket="catalogue" label="Upload a picture" accept=".png,.jpg,.jpeg,.webp" onDone={(v) => setC((p) => ({ ...p, image_url: v.url }))} /></div>
            </div>
          </div>
        </section>

        <section hidden={tab !== 'contents'} className="space-y-3" aria-label="Package contents">
          <p className="text-sm text-muted">What the customer gets and chooses. Change the number of frames, add an item or make it optional here: the calculator on the website follows automatically.</p>
          {slots.length === 0 && <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">No contents yet. Add a garment first.</p>}
          <ol className="space-y-3">
            {slots.map((s, i) => {
              const comps = library.filter((l) => l.kind === s.kind);
              return (
                <li key={s.id} className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">Item {i + 1}: {s.kind === 'garment' ? 'Garment' : s.kind === 'frame' ? 'Frames' : 'Item'}</p>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveSlot(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand disabled:opacity-40"><ArrowUp className="size-4" aria-hidden /></button>
                      <button type="button" onClick={() => moveSlot(i, 1)} disabled={i === slots.length - 1} aria-label={`Move item ${i + 1} down`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand disabled:opacity-40"><ArrowDown className="size-4" aria-hidden /></button>
                      <button type="button" onClick={() => setSlots((a) => a.filter((x) => x.id !== s.id))} aria-label={`Remove item ${i + 1}`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button></div></div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div><label className={labelCls} htmlFor={`s-l-${s.id}`}>Name shown</label><input id={`s-l-${s.id}`} value={s.label} onChange={(e) => setSlot(s.id, { label: e.target.value })} className={inputCls} /></div>
                    {s.kind !== 'garment' && (<div><label className={labelCls} htmlFor={`s-c-${s.id}`}>Product</label><select id={`s-c-${s.id}`} value={s.component_id ?? ''} onChange={(e) => setSlot(s.id, { component_id: e.target.value || null })} className={inputCls}><option value="">Choose…</option>{comps.map((l) => (<option key={l.id} value={l.id}>{l.name}{l.is_active && !l.archived_at ? '' : ' (off)'}</option>))}</select></div>)}
                    <div><label className={labelCls} htmlFor={`s-m-${s.id}`}>Included how?</label>
                      <select id={`s-m-${s.id}`} value={s.mode} onChange={(e) => setSlot(s.id, { mode: e.target.value as SlotRow['mode'] })} className={inputCls}>
                        <option value="required">Included (in the package price)</option>{s.kind === 'item' && <option value="optional">Optional, at an extra price</option>}<option value="unavailable">Not available</option></select></div>
                    {s.kind === 'garment' && (<div><label className={labelCls} htmlFor={`s-q-${s.id}`}>Number of garments</label><input id={`s-q-${s.id}`} type="number" min={1} max={4} value={s.quantity} onChange={(e) => setSlot(s.id, { quantity: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })} className={inputCls} /><p className="mt-1 text-xs text-muted">2 for a couples edition: each person picks their own garment, colour and size.</p></div>)}
                    {(s.kind === 'frame' || s.mode === 'required') && s.kind !== 'garment' && (<div><label className={labelCls} htmlFor={`s-q-${s.id}`}>{s.kind === 'frame' ? 'Number of frames' : 'Quantity included'}</label><input id={`s-q-${s.id}`} type="number" min={1} max={12} value={s.quantity} onChange={(e) => setSlot(s.id, { quantity: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className={inputCls} /></div>)}
                    {s.kind === 'item' && s.mode === 'optional' && (<>
                      <Naira id={`s-p-${s.id}`} label="Extra price" value={s.extra_price_kobo} onChange={(v) => setSlot(s.id, { extra_price_kobo: v })} help="Leave empty to use the library price. With no price at all, customers cannot add it." />
                      <div><label className={labelCls} htmlFor={`s-min-${s.id}`}>Fewest</label><input id={`s-min-${s.id}`} type="number" min={0} max={20} value={s.min_qty} onChange={(e) => setSlot(s.id, { min_qty: Number(e.target.value) || 0 })} className={inputCls} /></div>
                      <div><label className={labelCls} htmlFor={`s-max-${s.id}`}>Most</label><input id={`s-max-${s.id}`} type="number" min={0} max={20} value={s.max_qty} onChange={(e) => setSlot(s.id, { max_qty: Number(e.target.value) || 0 })} className={inputCls} /></div></>)}
                  </div>
                  {s.kind === 'garment' && (
                    <fieldset className="mt-3"><legend className={labelCls}>Garments the customer can choose from</legend>
                      <div className="flex flex-wrap gap-x-5">{garments.map((g) => (<label key={g.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={s.allowed_component_ids.includes(g.id)} onChange={(e) => setSlot(s.id, { allowed_component_ids: e.target.checked ? [...s.allowed_component_ids, g.id] : s.allowed_component_ids.filter((x) => x !== g.id) })} className="size-5 accent-ink" />{g.name}{g.is_active && !g.archived_at ? '' : ' (off)'}</label>))}</div></fieldset>)}
                  <div className="mt-1 flex flex-wrap gap-x-6">
                    {s.kind !== 'item' && (<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={s.customise} onChange={(e) => setSlot(s.id, { customise: e.target.checked })} className="size-5 accent-ink" />Customer adds their Scripture or text{s.kind === 'frame' ? ' for each frame' : ''}</label>)}
                    {s.kind === 'frame' && s.quantity > 1 && (<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={s.same_size_only} onChange={(e) => setSlot(s.id, { same_size_only: e.target.checked })} className="size-5 accent-ink" />All frames must be the same size</label>)}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            {!gSlot && <button type="button" onClick={() => setSlots((a) => [...a, { id: uid(), kind: 'garment', label: 'Customised garment', component_id: null, allowed_component_ids: garments.filter((g) => g.is_active && !g.archived_at).map((g) => g.id), quantity: 1, mode: 'required', min_qty: 0, max_qty: 1, same_size_only: false, customise: true, extra_price_kobo: null }])} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add garment</button>}
            <button type="button" onClick={() => setSlots((a) => [...a, { id: uid(), kind: 'frame', label: 'Customised frame', component_id: library.find((l) => l.kind === 'frame' && l.is_active)?.id ?? null, allowed_component_ids: [], quantity: 1, mode: 'required', min_qty: 0, max_qty: 1, same_size_only: false, customise: true, extra_price_kobo: null }])} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add frames</button>
            <button type="button" onClick={() => setSlots((a) => [...a, { id: uid(), kind: 'item', label: 'New item', component_id: library.find((l) => l.kind === 'item' && l.is_active)?.id ?? null, allowed_component_ids: [], quantity: 1, mode: 'required', min_qty: 0, max_qty: 1, same_size_only: false, customise: false, extra_price_kobo: null }])} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add an item</button>
            <Link href="/admin/combos/library" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4">Manage the item library</Link>
          </div>
        </section>

        <section hidden={tab !== 'pricing'} className="space-y-4" aria-label="Selling prices">
          <div className={`${card} text-sm`}><p className="font-semibold">How the price is worked out</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted"><li>If a <strong className="text-ink">fixed price</strong> matches the garment and frame sizes exactly, that price is the whole package price.</li>
              <li>Otherwise: <strong className="text-ink">base price</strong> + garment extra + one frame-size extra per frame.</li><li>Optional items add their own price. Included items are already in the package price.</li>
              <li>Then <strong className="text-ink">one</strong> discount (the largest active) comes off. Discounts never stack.</li></ol></div>
          <div className={card}><h3 className="display mb-2 text-xl">Base package price</h3>
            <Naira id="p-base" label="Selling price (₦)" value={c.base_price_kobo} onChange={(v) => setC({ ...c, base_price_kobo: v })} help="Leave empty if you only use fixed prices. With no price at all customers see “Price currently unavailable”." /></div>
          {allowedGarments.length > 0 && (<div className={card}><h3 className="display mb-2 text-xl">Garment extras</h3><p className="mb-2 text-sm text-muted">Extra charged on top of the base price. Empty = nothing extra.</p>
            <div className="grid gap-3 sm:grid-cols-3">{allowedGarments.map((g) => (<Naira key={g.id} id={`p-g-${g.id}`} label={`${g.name}`} value={adjust('garment_adjust', g.id)?.amount_kobo ?? null} onChange={(v) => setAdjust('garment_adjust', g.id, v)} />))}</div></div>)}
          {frameOptions.length > 0 && (<div className={card}><h3 className="display mb-2 text-xl">Frame-size extras (per frame)</h3><p className="mb-2 text-sm text-muted">Charged for each frame of that size. The smallest size is usually 0.</p>
            <div className="grid gap-3 sm:grid-cols-3">{frameOptions.map((o) => (<Naira key={o.id} id={`p-f-${o.id}`} label={o.label} value={adjust('frame_size_adjust', o.id)?.amount_kobo ?? null} onChange={(v) => setAdjust('frame_size_adjust', o.id, v)} />))}</div></div>)}
          {garmentUnits > 1 ? (<div className={`${card} text-sm`}><h3 className="display mb-1 text-xl">Fixed prices</h3><p className="text-muted">Not used when the package has more than one garment. The price is the base price plus each garment&apos;s extra and each frame size&apos;s extra.</p></div>) : (<div className={card}><h3 className="display mb-1 text-xl">Fixed prices</h3><p className="mb-2 text-sm text-muted">Set an exact final price for a specific garment and set of frame sizes. It replaces the base price and extras for that selection.</p>
            <ul className="space-y-2">{fixed.map((r) => (
              <li key={r.id} className="rounded-md border border-line bg-paper p-3"><div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto] sm:items-end">
                <div><label className={labelCls} htmlFor={`fx-g-${r.id}`}>Garment</label><select id={`fx-g-${r.id}`} value={r.component_id ?? ''} onChange={(e) => setRule(r.id, { component_id: e.target.value || null })} className={inputCls}><option value="">Choose…</option>{allowedGarments.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}</select></div>
                <div><span className={labelCls}>Frame sizes ({nFrames})</span><div className="flex flex-wrap gap-1">{Array.from({ length: nFrames }, (_, i) => (
                  <select key={i} aria-label={`Frame ${i + 1} size`} value={sigIds(r)[i] ?? ''} onChange={(e) => setSig(r, i, e.target.value)} className={`${inputCls} w-auto`}><option value="">…</option>{frameOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}</select>))}</div></div>
                <Naira id={`fx-p-${r.id}`} label="Final price (₦)" value={r.amount_kobo} onChange={(v) => setRule(r.id, { amount_kobo: v })} />
                <button type="button" onClick={() => setRules((a) => a.filter((x) => x.id !== r.id))} aria-label="Remove this fixed price" className="grid size-11 place-items-center rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button></div>
                <div className="mt-1 flex flex-wrap items-center gap-4"><input aria-label="Name for this fixed price" value={r.label ?? ''} onChange={(e) => setRule(r.id, { label: e.target.value })} placeholder="Name shown in the price breakdown (optional)" className={`${inputCls} max-w-sm`} />
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={r.is_active} onChange={(e) => setRule(r.id, { is_active: e.target.checked })} className="size-5 accent-ink" />Active</label></div></li>))}</ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRules((a) => [...a, { id: uid(), kind: 'fixed_variant', component_id: allowedGarments[0]?.id ?? null, option_id: null, frame_signature: frameSignature(Array.from({ length: nFrames }, () => frameOptions[0]?.id ?? '').filter(Boolean)), amount_kobo: null, discount_type: null, discount_value: null, label: null, starts_at: null, ends_at: null, is_active: true }])} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add a fixed price</button>
              <button type="button" onClick={addAllFixed} className="inline-flex min-h-11 items-center rounded-btn border-2 border-line px-4 text-sm font-semibold hover:border-ink">Add a row for every combination</button></div></div>)}
          <div className={card}><h3 className="display mb-1 text-xl">Promotions and discounts</h3><p className="mb-2 text-sm text-muted">Only the largest active discount applies. Set dates for a time-limited promotion (Lagos time).</p>
            <ul className="space-y-2">{discounts.map((r) => (
              <li key={r.id} className="rounded-md border border-line bg-paper p-3"><div className="grid gap-2 sm:grid-cols-4">
                <div><label className={labelCls} htmlFor={`d-k-${r.id}`}>Kind</label><select id={`d-k-${r.id}`} value={r.kind} onChange={(e) => setRule(r.id, { kind: e.target.value as RuleRow['kind'] })} className={inputCls}><option value="promo">Promotion</option><option value="bundle_discount">Bundle discount</option></select></div>
                <div><label className={labelCls} htmlFor={`d-t-${r.id}`}>Type</label><select id={`d-t-${r.id}`} value={r.discount_type ?? 'percent'} onChange={(e) => setRule(r.id, { discount_type: e.target.value as 'percent' | 'fixed', discount_value: null })} className={inputCls}><option value="percent">Percent off</option><option value="fixed">Naira off</option></select></div>
                {(r.discount_type ?? 'percent') === 'percent'
                  ? (<div><label className={labelCls} htmlFor={`d-v-${r.id}`}>Percent (1 to 100)</label><input id={`d-v-${r.id}`} type="number" min={1} max={100} value={r.discount_value ?? ''} onChange={(e) => setRule(r.id, { discount_type: 'percent', discount_value: Number(e.target.value) || null })} className={inputCls} /></div>)
                  : (<Naira id={`d-v-${r.id}`} label="Amount off (₦)" value={r.discount_value} onChange={(v) => setRule(r.id, { discount_type: 'fixed', discount_value: v })} />)}
                <div><label className={labelCls} htmlFor={`d-l-${r.id}`}>Name shown</label><input id={`d-l-${r.id}`} value={r.label ?? ''} onChange={(e) => setRule(r.id, { label: e.target.value })} placeholder="Launch offer" className={inputCls} /></div>
                <div><label className={labelCls} htmlFor={`d-s-${r.id}`}>Starts (optional)</label><input id={`d-s-${r.id}`} type="datetime-local" value={r.starts_at ? r.starts_at.slice(0, 16) : ''} onChange={(e) => setRule(r.id, { starts_at: e.target.value ? `${e.target.value}:00+01:00` : null })} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor={`d-e-${r.id}`}>Ends (optional)</label><input id={`d-e-${r.id}`} type="datetime-local" value={r.ends_at ? r.ends_at.slice(0, 16) : ''} onChange={(e) => setRule(r.id, { ends_at: e.target.value ? `${e.target.value}:00+01:00` : null })} className={inputCls} /></div>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={r.is_active} onChange={(e) => setRule(r.id, { is_active: e.target.checked })} className="size-5 accent-ink" />Active</label>
                <button type="button" onClick={() => setRules((a) => a.filter((x) => x.id !== r.id))} aria-label="Remove this discount" className="grid size-11 place-items-center self-end rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button></div></li>))}</ul>
            <button type="button" onClick={() => setRules((a) => [...a, { id: uid(), kind: 'promo', component_id: null, option_id: null, frame_signature: null, amount_kobo: null, discount_type: 'percent', discount_value: null, label: null, starts_at: null, ends_at: null, is_active: true }])} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add a discount</button></div>
          <div className={card}><h3 className="display mb-2 text-xl">Price preview (what customers will pay)</h3>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><caption className="sr-only">Selling price for every garment and frame-size combination</caption>
              <thead><tr className="text-xs uppercase tracking-wide text-muted"><th scope="col" className="py-1 pr-3">Selection</th><th scope="col" className="py-1 pr-3">Price</th><th scope="col" className="py-1">Rule</th></tr></thead>
              <tbody>{matrix.map(({ e, q }) => (<tr key={e.label} className="border-t border-line"><td className="py-1.5 pr-3">{e.label}</td><td className="py-1.5 pr-3 font-semibold">{q.priced ? formatNaira(q.unitKobo) : <span className="text-ember">Price currently unavailable</span>}</td><td className="py-1.5 text-muted">{q.rule === 'fixed_variant' ? 'Fixed price' : q.rule === 'base' ? 'Base + extras' : 'n/a'}{q.discountKobo > 0 ? ` · ${formatNaira(q.discountKobo)} off` : ''}</td></tr>))}</tbody></table></div></div>
        </section>
      </ActionForm>

      {isOwner && tab === 'costs' && (
        <section className="space-y-4" aria-label="Costs and profit">
          <p className="rounded-lg border border-mocha bg-mocha/15 p-3 text-sm"><strong>Private.</strong> Costs and profit are visible to owners only and are never sent to the website.</p>
          {id ? (
            <ActionForm action={saveComboCostsAction} submitLabel="Save costs" pendingLabel="Saving…" className={card}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="payload" value={JSON.stringify(overheads)} />
              <h3 className="display mb-2 text-xl">Extra costs per package</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {([['printing_apparel_kobo', 'Apparel customisation / printing'], ['frame_artwork_kobo', 'Frame artwork and printing'], ['packaging_kobo', 'Packaging'], ['labor_kobo', 'Labour'], ['processing_fee_kobo', 'Processing fees'], ['other_kobo', 'Other fulfilment costs']] as const).map(([k, label]) => (
                  <Naira key={k} id={`oh-${k}`} label={label} value={overheads[k]} onChange={(v) => setOverheads((o) => ({ ...o, [k]: v ?? 0 }))} placeholder="0" />))}
              </div>
              <p className="mt-2 text-xs text-muted">Material costs (garments, frames, items) are set in the item library. They are reference figures, not final production costs.</p>
            </ActionForm>
          ) : <p className="text-sm text-muted">Save the combo first, then add costs.</p>}
          <div className={card}><h3 className="display mb-2 text-xl">Estimated profit per selection</h3>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Estimated cost, selling price, gross profit and margin per selection</caption>
              <thead><tr className="text-xs uppercase tracking-wide text-muted"><th scope="col" className="py-1 pr-3">Selection</th><th scope="col" className="py-1 pr-3">Est. cost</th><th scope="col" className="py-1 pr-3">Selling price</th><th scope="col" className="py-1 pr-3">Gross profit</th><th scope="col" className="py-1">Margin</th></tr></thead>
              <tbody>{matrix.map(({ e, q, cost }) => {
                const p = q.priced && cost ? profit(q.unitKobo, cost.costKobo) : null;
                return (<tr key={e.label} className="border-t border-line"><td className="py-1.5 pr-3">{e.label}</td>
                  <td className="py-1.5 pr-3">{cost ? formatNaira(cost.costKobo) : 'n/a'}{cost && cost.missing.length > 0 && <span className="block text-xs text-ember">Missing cost: {cost.missing.join(', ')}</span>}</td>
                  <td className="py-1.5 pr-3">{q.priced ? formatNaira(q.unitKobo) : 'No price set'}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${p && p.grossKobo < 0 ? 'text-ember' : ''}`}>{p ? formatNaira(p.grossKobo) : 'n/a'}</td>
                  <td className={`py-1.5 ${p && (p.marginPct ?? 0) < 0 ? 'text-ember' : ''}`}>{p && p.marginPct !== null ? `${p.marginPct}%` : 'n/a'}</td></tr>);
              })}</tbody></table></div></div>
        </section>
      )}

      {tab === 'publish' && (
        <section className="space-y-4" aria-label="Preview and publish">
          <div className={card}>
            <p className="text-sm"><strong>Status:</strong> {status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft (not visible to customers)'}{hasUnpublishedChanges && ' · you have changes that are not published yet'}{orders > 0 ? ` · ${orders} order line${orders === 1 ? '' : 's'} so far` : ''}</p>
            {issues.length === 0 ? <p className="mt-2 text-sm font-semibold text-mocha">Everything checks out.</p> : (
              <ul className="mt-2 space-y-1 text-sm">{issues.map((i, n) => (<li key={n} className={i.level === 'error' ? 'text-ember' : 'text-muted'}><strong>{i.level === 'error' ? 'Fix: ' : 'Note: '}</strong>{i.message}</li>))}</ul>)}
            <p className="mt-2 text-xs text-muted">Unsaved edits are not published. Save the draft first, then preview or publish.</p>
          </div>
          {id && (<div className="flex flex-wrap items-start gap-3">
            <Link href={`/admin/combos/${id}/preview`} className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-5 text-sm font-semibold">Preview as a customer</Link>
            <ActionForm action={publishComboAction} submitLabel={status === 'published' ? 'Publish changes' : 'Publish'} pendingLabel="Publishing…"><input type="hidden" name="id" value={id} />
              {errors.length > 0 && <p className="mt-1 text-xs text-ember">Fix the errors above before publishing.</p>}</ActionForm></div>)}
        </section>
      )}
      {errors.length > 0 && tab !== 'publish' && (<p role="status" className="rounded-lg border border-ember/50 bg-ember/10 p-3 text-sm"><strong>{errors.length} thing{errors.length === 1 ? '' : 's'} to fix:</strong> {errors[0]!.message} <button type="button" onClick={() => setTab('publish')} className="underline">See all</button></p>)}
    </div>
  );
}
