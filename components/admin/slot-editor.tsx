'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { inputCls, labelCls } from './ui';

export type Slot = { label: string; product_type: string; allowed_collection_id: string | null; allowed_product_id: string | null; option_group: string | null; quantity: number; requires_size: boolean; requires_colour: boolean; requires_option: boolean; option_label: string | null; requires_custom_text: boolean; matching_group: string | null };
const TYPES = ['tee', 'hoodie', 'frame', 'perfume', 'jewellery', 'bracelet', 'glasses', 'fun'];
const blank: Slot = { label: '', product_type: 'tee', allowed_collection_id: null, allowed_product_id: null, option_group: null, quantity: 1, requires_size: true, requires_colour: true, requires_option: false, option_label: null, requires_custom_text: false, matching_group: null };

/** Bundle slot rules: what the customer chooses for each item. Which designs, a fixed product, sizes, options, matching groups. */
export function SlotEditor({ initial, collections, products }: { initial: Slot[]; collections: { id: string; name: string }[]; products: { id: string; name: string }[] }) {
  const [slots, setSlots] = useState<Slot[]>(initial);
  const set = (i: number, p: Partial<Slot>) => setSlots((a) => a.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => setSlots((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  return (
    <div>
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      <ol className="space-y-3">{slots.map((s, i) => (
        <li key={i} className="rounded-md border border-line p-3">
          <div className="flex items-center justify-between gap-2"><p className="font-bold">Item {i + 1}</p>
            <div className="flex gap-1"><button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === slots.length - 1} aria-label={`Move item ${i + 1} down`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
              <button type="button" onClick={() => setSlots((a) => a.filter((_, k) => k !== i))} aria-label={`Remove item ${i + 1}`} className="grid size-11 place-items-center rounded border border-line"><Trash2 className="size-4" aria-hidden /></button></div></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls} htmlFor={`l${i}`}>Label</label><input id={`l${i}`} value={s.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="e.g. His tee" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`t${i}`}>Product type</label><select id={`t${i}`} value={s.product_type} onChange={(e) => set(i, { product_type: e.target.value })} className={inputCls}>{TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
            <div><label className={labelCls} htmlFor={`q${i}`}>Quantity</label><input id={`q${i}`} type="number" min={1} max={10} value={s.quantity} onChange={(e) => set(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`c${i}`}>Designs from collection</label><select id={`c${i}`} value={s.allowed_collection_id ?? ''} onChange={(e) => set(i, { allowed_collection_id: e.target.value || null })} className={inputCls}><option value="">Any design</option>{collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
            <div><label className={labelCls} htmlFor={`p${i}`}>Fixed product (accessories)</label><select id={`p${i}`} value={s.allowed_product_id ?? ''} onChange={(e) => set(i, { allowed_product_id: e.target.value || null })} className={inputCls}><option value="">Chosen by design</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
            <div><label className={labelCls} htmlFor={`ol${i}`}>Option label</label><input id={`ol${i}`} value={s.option_label ?? ''} onChange={(e) => set(i, { option_label: e.target.value || null })} placeholder="Scent, Style…" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`og${i}`}>Option group</label><select id={`og${i}`} value={s.option_group ?? ''} onChange={(e) => set(i, { option_group: e.target.value || null })} className={inputCls}><option value="">Any</option><option value="him">him</option><option value="her">her</option></select></div>
            <div><label className={labelCls} htmlFor={`m${i}`}>Matching group</label><input id={`m${i}`} value={s.matching_group ?? ''} onChange={(e) => set(i, { matching_group: e.target.value || null })} placeholder="pair, family…" className={inputCls} /></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">{([['requires_size', 'Needs a size'], ['requires_colour', 'Needs a colour'], ['requires_option', 'Needs an option'], ['requires_custom_text', 'Printed names']] as const).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={s[k]} onChange={(e) => set(i, { [k]: e.target.checked } as Partial<Slot>)} className="size-5 accent-ink" />{label}</label>))}</div>
        </li>))}</ol>
      <button type="button" onClick={() => setSlots((a) => [...a, { ...blank }])} className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />Add an item</button>
    </div>
  );
}
