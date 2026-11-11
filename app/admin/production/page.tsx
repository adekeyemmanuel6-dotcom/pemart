import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { PageTitle, fmtDate, inputCls } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { bulkStatusAction } from '@/lib/admin/actions-ops';
import { STATUS_LABEL } from '@/lib/orders/status';

export const metadata: Metadata = { title: 'Production' };
type Card = { id: string; number: string; status: string; promised_by: string | null; recipient: string; has_custom: boolean; express: boolean; due_soon: boolean; items: string[] };

const COLUMNS: { key: string; title: string; statuses: string[] }[] = [
  { key: 'ready', title: 'Ready to start', statuses: ['paid', 'approved'] },
  { key: 'prod', title: 'In production', statuses: ['in_production', 'reprint'] },
  { key: 'qc', title: 'Quality check', statuses: ['quality_check'] },
  { key: 'packed', title: 'Packed', statuses: ['packed'] },
  { key: 'out', title: 'Out for delivery', statuses: ['out_for_delivery'] },
  { key: 'done', title: 'Delivered (7 days)', statuses: ['delivered'] },
];

export default async function ProductionBoard() {
  const me = await requireStaff('/admin/production');
  const cards = await adm<Card[]>('admin_board', me);
  return (
    <>
      <PageTitle title="Production" sub="Sorted by promised date. Red means due within 24 hours." />
      <ActionForm action={bulkStatusAction} hideSubmit>
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper p-3">
          <div className="min-w-48 flex-1"><label htmlFor="to" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Move ticked orders to</label>
            <select id="to" name="to" className={inputCls} defaultValue="in_production">{['in_production', 'quality_check', 'packed', 'out_for_delivery', 'delivered', 'reprint'].map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}</select></div>
          <button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Move selected</button>
        </div>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" role="list" aria-label="Production columns">
          {COLUMNS.map((col) => {
            const items = cards.filter((c) => col.statuses.includes(c.status));
            return (
              <section key={col.key} role="listitem" aria-label={col.title} className="w-72 shrink-0 snap-start rounded-lg border border-line bg-sand/30 p-2">
                <h2 className="display mb-2 px-1 text-xl">{col.title} <span className="text-sm text-muted">({items.length})</span></h2>
                <ul className="space-y-2">{items.length === 0 && <li className="px-1 py-6 text-center text-sm text-muted">Nothing here</li>}
                  {items.map((c) => (
                    <li key={c.id} className={`rounded-md border p-2.5 text-sm ${c.due_soon ? 'border-ember bg-ember/15' : 'border-line bg-paper'}`}>
                      <label className="flex gap-2"><input type="checkbox" name="ids" value={c.id} className="mt-0.5 size-5 shrink-0 accent-ink" aria-label={`Select ${c.number}`} />
                        <span className="min-w-0 flex-1"><Link href={`/admin/orders/${c.number}`} className="font-bold underline underline-offset-4">{c.number}</Link>
                          {c.has_custom && <span className="ml-1 rounded bg-mocha px-1.5 text-xs font-bold text-ink">custom</span>}{c.express && <span className="ml-1 rounded bg-denim px-1.5 text-xs font-bold text-ink">express</span>}
                          <span className="block text-muted">{c.recipient}</span><span className="block truncate text-muted">{c.items.join(', ')}</span>
                          <span className={`mt-1 block font-semibold ${c.due_soon ? 'text-ember' : ''}`}>{c.promised_by ? `${c.due_soon ? '⚠ ' : ''}Due ${fmtDate(c.promised_by, true)}` : 'No date yet'}</span></span></label>
                    </li>))}</ul>
              </section>);
          })}
        </div>
      </ActionForm>
    </>
  );
}
