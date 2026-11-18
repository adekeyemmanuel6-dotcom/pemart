'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ActionForm } from './action-form';
import { AdminUploader } from './admin-uploader';
import { inputCls, labelCls } from './ui';
import { archiveComponentAction, deleteComponentAction, saveComponentAction } from '@/lib/admin/actions-combos';
import type { LibraryItem } from '@/lib/combos/build';
import { koboToNaira, nairaToKobo } from '@/lib/combos/money';

type Opt = { id?: string; grp: 'size' | 'colour' | 'frame_size'; slug: string; label: string; internal_cost_kobo: number | null; is_active: boolean };
const GROUPS: Record<LibraryItem['kind'], { grp: Opt['grp']; title: string }[]> = {
  garment: [{ grp: 'size', title: 'Sizes' }, { grp: 'colour', title: 'Colours' }],
  frame: [{ grp: 'frame_size', title: 'Frame sizes' }],
  item: [{ grp: 'colour', title: 'Colours or variants' }],
};
const KIND = { garment: 'Garments', frame: 'Frames', item: 'Items (diary, pen, perfume…)' } as const;
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function Money({ id, label, value, onChange, help }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; help?: string }) {
  const [t, setT] = useState(koboToNaira(value)); const [bad, setBad] = useState(false);
  return (<div><label className={labelCls} htmlFor={id}>{label}</label>
    <div className="relative"><span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">₦</span>
      <input id={id} inputMode="decimal" value={t} placeholder="Not set" aria-invalid={bad || undefined} className={`${inputCls} pl-8`} onChange={(e) => { setT(e.target.value); const k = nairaToKobo(e.target.value); setBad(k === undefined); if (k !== undefined) onChange(k); }} /></div>
    {bad ? <p className="mt-1 text-xs text-ember">Enter an amount like 25000</p> : help && <p className="mt-1 text-xs text-muted">{help}</p>}</div>);
}

function ItemForm({ item, kind, isOwner, onDone }: { item: LibraryItem | null; kind: LibraryItem['kind']; isOwner: boolean; onDone?: () => void }) {
  const uid = item?.id ?? `new-${kind}`;
  const [c, setC] = useState({
    slug: item?.slug ?? '', name: item?.name ?? '', description: item?.description ?? '', image_url: item?.image_url ?? '', internal_cost_kobo: (item as { internal_cost_kobo?: number | null } | null)?.internal_cost_kobo ?? null,
    public_price_kobo: item?.public_price_kobo ?? null, customisable: item?.customisable ?? kind !== 'item', min_qty: item?.min_qty ?? 0, max_qty: item?.max_qty ?? 1,
    inventory_status: item?.inventory_status ?? 'made_to_order', is_active: item?.is_active ?? true, sort_order: item?.sort_order ?? 0,
  });
  const [opts, setOpts] = useState<Opt[]>((item?.all_options ?? []).map((o) => ({ id: o.id, grp: o.group, slug: o.slug, label: o.label, internal_cost_kobo: (o as { internal_cost_kobo?: number | null }).internal_cost_kobo ?? null, is_active: o.is_active })));
  const payload = JSON.stringify({ component: { ...(item ? { id: item.id } : {}), ...c, slug: item ? item.slug : c.slug || slugify(c.name), kind, internal_cost_kobo: isOwner ? c.internal_cost_kobo : null }, options: opts });
  const setOpt = (i: number, p: Partial<Opt>) => setOpts((a) => a.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <div className="space-y-3">
      <ActionForm action={async (p, fd) => { const r = await saveComponentAction(p, fd); if (r?.ok && !item) onDone?.(); return r; }} submitLabel={item ? 'Save item' : 'Add item'} pendingLabel="Saving…">
        <input type="hidden" name="payload" value={payload} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={labelCls} htmlFor={`${uid}-n`}>Name</label><input id={`${uid}-n`} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} /></div>
          {!item && <div><label className={labelCls} htmlFor={`${uid}-s`}>Code (auto if empty)</label><input id={`${uid}-s`} value={c.slug} onChange={(e) => setC({ ...c, slug: slugify(e.target.value) })} className={inputCls} /></div>}
          <div><label className={labelCls} htmlFor={`${uid}-i`}>Stock</label><select id={`${uid}-i`} value={c.inventory_status} onChange={(e) => setC({ ...c, inventory_status: e.target.value as typeof c.inventory_status })} className={inputCls}><option value="made_to_order">Made to order</option><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock (hidden from customers now)</option></select></div>
          <Money id={`${uid}-p`} label="Price if sold as an extra (₦)" value={c.public_price_kobo} onChange={(v) => setC({ ...c, public_price_kobo: v })} help="Only used when a combo offers this as an optional extra." />
          {isOwner && <Money id={`${uid}-c`} label="Your cost (₦), private" value={c.internal_cost_kobo} onChange={(v) => setC({ ...c, internal_cost_kobo: v })} help="Never shown to customers or staff." />}
          <div><label className={labelCls} htmlFor={`${uid}-o`}>Display order</label><input id={`${uid}-o`} type="number" min={0} value={c.sort_order} onChange={(e) => setC({ ...c, sort_order: Number(e.target.value) || 0 })} className={inputCls} /></div>
          {kind === 'item' && (<><div><label className={labelCls} htmlFor={`${uid}-mi`}>Fewest per order</label><input id={`${uid}-mi`} type="number" min={0} max={20} value={c.min_qty} onChange={(e) => setC({ ...c, min_qty: Number(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`${uid}-ma`}>Most per order</label><input id={`${uid}-ma`} type="number" min={0} max={20} value={c.max_qty} onChange={(e) => setC({ ...c, max_qty: Number(e.target.value) || 0 })} className={inputCls} /></div></>)}
          <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor={`${uid}-d`}>Description (shown to customers)</label><textarea id={`${uid}-d`} rows={2} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} className={`${inputCls} py-2`} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor={`${uid}-im`}>Picture</label><input id={`${uid}-im`} value={c.image_url} onChange={(e) => setC({ ...c, image_url: e.target.value })} placeholder="Picture link, or upload" className={inputCls} />
            <div className="mt-2"><AdminUploader bucket="catalogue" label="Upload a picture" accept=".png,.jpg,.jpeg,.webp" onDone={(v) => setC((p) => ({ ...p, image_url: v.url }))} /></div></div>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={c.is_active} onChange={(e) => setC({ ...c, is_active: e.target.checked })} className="size-5 accent-ink" />Available to customers</label>
          {kind !== 'item' && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={c.customisable} onChange={(e) => setC({ ...c, customisable: e.target.checked })} className="size-5 accent-ink" />Customer can add their own text</label>}
        </div>
        {GROUPS[kind].map(({ grp, title }) => (
          <fieldset key={grp} className="mt-3 rounded-md border border-line bg-paper p-3"><legend className="px-1 text-sm font-semibold">{title}</legend>
            <ul className="space-y-2">{opts.map((o, i) => o.grp !== grp ? null : (
              <li key={i} className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1"><label className={labelCls} htmlFor={`${uid}-ol-${i}`}>Name</label><input id={`${uid}-ol-${i}`} value={o.label} onChange={(e) => setOpt(i, { label: e.target.value, ...(o.id ? {} : { slug: slugify(e.target.value) }) })} className={inputCls} /></div>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={o.is_active} onChange={(e) => setOpt(i, { is_active: e.target.checked })} className="size-5 accent-ink" />Offered</label>
                {!o.id && <button type="button" onClick={() => setOpts((a) => a.filter((_, j) => j !== i))} aria-label={`Remove ${o.label || 'option'}`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button>}
              </li>))}</ul>
            <button type="button" onClick={() => setOpts((a) => [...a, { grp, slug: '', label: '', internal_cost_kobo: null, is_active: true }])} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-line px-3 text-sm font-semibold hover:border-ink"><Plus className="size-4" aria-hidden />Add to {title.toLowerCase()}</button>
            <p className="mt-1 text-xs text-muted">Options you untick stay on past orders and are simply hidden from new ones.</p>
          </fieldset>))}
      </ActionForm>
      {item && (
        <div className="flex flex-wrap gap-x-4 border-t border-line pt-2">
          <ActionForm action={archiveComponentAction} submitLabel={item.archived_at ? 'Restore' : 'Archive'} variant="secondary" confirm={item.archived_at ? undefined : 'Archive this item? Combos stop offering it at once. Past orders are unchanged.'}>
            <input type="hidden" name="id" value={item.id} /><input type="hidden" name="archive" value={item.archived_at ? 'false' : 'true'} /></ActionForm>
          {item.used_in === 0 && (<ActionForm action={deleteComponentAction} submitLabel="Delete" variant="danger" confirm="Delete this item permanently?"><input type="hidden" name="id" value={item.id} />
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-5 accent-ink" />Yes, delete</label></ActionForm>)}
          {item.used_in > 0 && <p className="self-center text-xs text-muted">Used in {item.used_in} combo slot{item.used_in === 1 ? '' : 's'}, so it can be archived but not deleted.</p>}
        </div>)}
    </div>
  );
}

export function ComboLibrary({ items, isOwner }: { items: LibraryItem[]; isOwner: boolean }) {
  const [adding, setAdding] = useState<LibraryItem['kind'] | null>(null);
  return (
    <div className="space-y-8">
      {(['garment', 'frame', 'item'] as const).map((kind) => (
        <section key={kind} aria-label={KIND[kind]}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="display text-2xl">{KIND[kind]}</h2>
            <button type="button" onClick={() => setAdding(adding === kind ? null : kind)} aria-expanded={adding === kind} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-ink px-4 text-sm font-semibold"><Plus className="size-4" aria-hidden />New</button></div>
          {adding === kind && <div className="mb-3 rounded-lg border-2 border-ink bg-sand/40 p-4"><ItemForm item={null} kind={kind} isOwner={isOwner} onDone={() => setAdding(null)} /></div>}
          <ul className="space-y-2">
            {items.filter((i) => i.kind === kind).map((i) => (
              <li key={i.id}><details className="rounded-lg border border-line bg-sand/40">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-4 py-2 font-semibold">{i.name}
                  {i.archived_at ? <span className="rounded-full bg-line px-2 py-0.5 text-xs">Archived</span> : !i.is_active ? <span className="rounded-full bg-line px-2 py-0.5 text-xs">Off</span> : i.inventory_status === 'out_of_stock' ? <span className="rounded-full bg-ember px-2 py-0.5 text-xs text-[#141414]">Out of stock</span> : null}
                  {isOwner && (i as { internal_cost_kobo?: number | null }).internal_cost_kobo == null && <span className="rounded-full bg-mocha px-2 py-0.5 text-xs text-[#141414]">No cost set</span>}</summary>
                <div className="border-t border-line p-4"><ItemForm item={i} kind={kind} isOwner={isOwner} /></div></details></li>))}
          </ul>
        </section>))}
    </div>
  );
}
