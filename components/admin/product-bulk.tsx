'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionForm } from './action-form';
import { inputCls, labelCls } from './ui';
import { bulkProductDeleteAction, bulkProductPriceAction, bulkProductStatusAction } from '@/lib/admin/actions-catalogue';

export type BulkRow = { id: string; name: string; slug: string; type: string; price: string; variants: number; images: number; status: 'active' | 'draft' | 'archived' };

const PILL = { active: 'bg-[#1f3d2b] text-[#bfe6cb]', draft: 'bg-sand text-ink', archived: 'bg-transparent text-muted border border-line' } as const;
const LABEL = { active: 'Active', draft: 'Draft', archived: 'Archived' } as const;

/** The product list with tick boxes, "select all shown", and bulk actions: set status, set one price, delete archived. */
export function ProductBulk({ rows }: { rows: BulkRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const head = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  // Anything that is no longer in the list (a filter changed, or a product was deleted) cannot stay ticked.
  useEffect(() => { setSel((s) => { const n = new Set([...s].filter((id) => shown.has(id))); return n.size === s.size ? s : n; }); }, [shown]);
  const chosen = rows.filter((r) => sel.has(r.id));
  const archived = chosen.filter((r) => r.status === 'archived');
  const all = rows.length > 0 && chosen.length === rows.length;
  useEffect(() => { if (head.current) head.current.indeterminate = chosen.length > 0 && !all; }, [chosen.length, all]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = (list: { id: string }[]) => list.map((r) => <input key={r.id} type="hidden" name="ids" value={r.id} />);

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 rounded-lg border border-line bg-sand/95 p-3 backdrop-blur" role="region" aria-label="Bulk actions">
        <p className="mb-2 text-sm" aria-live="polite"><strong>{chosen.length}</strong> of {rows.length} shown selected
          {rows.length > 0 && !all && <button type="button" onClick={() => setSel(new Set(rows.map((r) => r.id)))} className="ml-3 min-h-9 font-semibold underline underline-offset-4">Select all {rows.length} shown</button>}
          {chosen.length > 0 && <button type="button" onClick={() => setSel(new Set())} className="ml-3 min-h-9 font-semibold underline underline-offset-4">Clear</button>}</p>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <ActionForm action={bulkProductStatusAction} submitLabel="Set status" pendingLabel="Updating…" variant="secondary" className="min-w-52">
            {ids(chosen)}<label htmlFor="bulk-status" className={labelCls}>Set status of selected</label>
            <select id="bulk-status" name="status" className={inputCls}><option value="active">Active (on the store)</option><option value="draft">Draft (hidden)</option><option value="archived">Archived</option></select>
          </ActionForm>
          <ActionForm action={bulkProductPriceAction} submitLabel="Set price" pendingLabel="Saving…" variant="secondary" className="min-w-44">
            {ids(chosen)}<label htmlFor="bulk-price" className={labelCls}>Same price for selected (₦)</label>
            <input id="bulk-price" name="price" inputMode="decimal" placeholder="e.g. 18000" className={inputCls} />
          </ActionForm>
          <ActionForm action={bulkProductDeleteAction} submitLabel={`Delete ${archived.length || ''} archived`.replace('  ', ' ')} pendingLabel="Deleting…" variant="danger" className="min-w-56" confirm="Permanently delete the selected ARCHIVED products? This cannot be undone.">
            {ids(archived)}<span className={labelCls}>Delete archived products</span>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-5 accent-ink" disabled={archived.length === 0} />Yes, delete permanently</label>
            <p className="text-xs text-muted">{archived.length === 0 ? 'Select archived products to delete them.' : `${archived.length} archived selected. Ones on past orders are kept.`}{chosen.length > archived.length && archived.length > 0 ? ` ${chosen.length - archived.length} not archived: ignored.` : ''}</p>
          </ActionForm>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line" role="region" aria-label="Products" tabIndex={0}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Products</caption>
          <thead className="bg-sand/60"><tr>
            <th scope="col" className="px-3 py-2.5"><input ref={head} type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all shown products" className="size-5 accent-ink" /></th>
            {['Product', 'Type', 'Price', 'Variants', 'Photos', 'Status'].map((h) => (<th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>))}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className={sel.has(p.id) ? 'bg-sand/50' : ''}>
                <td className="px-3 py-2.5"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} className="size-5 accent-ink" /></td>
                <td className="px-3 py-2.5"><Link href={`/admin/catalogue/products/${p.id}`} className="font-semibold underline underline-offset-4">{p.name}</Link><div className="text-xs text-muted">{p.slug}</div></td>
                <td className="px-3 py-2.5">{p.type}</td><td className="px-3 py-2.5">{p.price}</td><td className="px-3 py-2.5">{p.variants}</td><td className="px-3 py-2.5">{p.images}</td>
                <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[p.status]}`}>{LABEL[p.status]}</span></td>
              </tr>))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
