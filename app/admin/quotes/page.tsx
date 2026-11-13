import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { Card, Empty, PageTitle, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requirePerm } from '@/lib/admin/db';
import { Flash } from '@/components/admin/flash';
import { quoteToOrderAction, updateQuoteAction } from '@/lib/admin/actions-ops';
import { getCatalogue } from '@/lib/catalogue/load';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Bulk quotes' };
type Quote = { id: string; name: string; organisation: string | null; phone: string; email: string; product_type: string; quantity: number; sizes: Record<string, number> | null; date_needed: string | null; idea: string | null; upload_paths: string[]; status: 'new' | 'quoted' | 'won' | 'lost'; quoted_amount_kobo: number | null; order_number: string | null; created_at: string };
const COLS: { s: Quote['status']; t: string }[] = [{ s: 'new', t: 'New' }, { s: 'quoted', t: 'Quoted' }, { s: 'won', t: 'Won' }, { s: 'lost', t: 'Lost' }];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ flash?: string; flashLink?: string; flashLabel?: string }> }) {
  const sp = await searchParams;
  const me = await requirePerm('orders', '/admin/quotes');
  const [quotes, cat] = await Promise.all([adm<Quote[]>('admin_quotes_list', me), getCatalogue()]);
  const states = cat.zones.flatMap((z) => z.states).sort((a, b) => a.localeCompare(b));
  return (
    <>
      <PageTitle title="Bulk quotes" sub="New, quoted, won, lost. Add the quoted amount, then turn a won quote into an order the customer pays online." />
      <Flash sp={sp} />
      {quotes.length === 0 ? <Empty>No bulk quote requests yet.</Empty> : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" role="list">
          {COLS.map((col) => {
            const items = quotes.filter((q) => q.status === col.s);
            return (
              <section key={col.s} role="listitem" aria-label={col.t} className="w-80 shrink-0 snap-start">
                <h2 className="display mb-2 text-2xl">{col.t} <span className="text-sm text-muted">({items.length})</span></h2>
                <ul className="space-y-3">{items.map((q) => (
                  <li key={q.id}><Card>
                    <p className="font-bold">{q.name}{q.organisation ? ` · ${q.organisation}` : ''}</p>
                    <p className="text-sm text-muted">{q.quantity} × {q.product_type} · {fmtDate(q.created_at)}{q.date_needed ? ` · needed ${fmtDate(q.date_needed)}` : ''}</p>
                    <p className="text-sm"><a href={`tel:${q.phone}`} className="underline">{q.phone}</a> · <a href={`mailto:${q.email}`} className="underline">{q.email}</a></p>
                    {q.sizes && <p className="text-sm text-muted">Sizes: {Object.entries(q.sizes).map(([k, v]) => `${k}:${v}`).join(' ')}</p>}
                    {q.idea && <p className="mt-1 line-clamp-3 text-sm">{q.idea}</p>}
                    {q.upload_paths.length > 0 && <p className="text-xs text-muted">{q.upload_paths.length} file(s) uploaded</p>}
                    {q.order_number && <p className="mt-1 text-sm font-semibold">Order {q.order_number}</p>}
                    <ActionForm action={updateQuoteAction} submitLabel="Update" variant="secondary" className="mt-2"><input type="hidden" name="id" value={q.id} />
                      <div className="grid grid-cols-2 gap-2"><div><label htmlFor={`s-${q.id}`} className={labelCls}>Status</label><select id={`s-${q.id}`} name="status" defaultValue={q.status} className={inputCls}>{COLS.map((c) => (<option key={c.s} value={c.s}>{c.t}</option>))}</select></div>
                        <div><label htmlFor={`a-${q.id}`} className={labelCls}>Quote (₦)</label><input id={`a-${q.id}`} name="amount" inputMode="decimal" defaultValue={q.quoted_amount_kobo ? String(q.quoted_amount_kobo / 100) : ''} className={inputCls} placeholder="800000" /></div></div></ActionForm>
                    {!q.order_number && q.quoted_amount_kobo ? (
                      <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Turn into an order ({formatNaira(q.quoted_amount_kobo)})</summary>
                        <ActionForm action={quoteToOrderAction} submitLabel="Create order and email payment link" pendingLabel="Creating…" className="mt-2"><input type="hidden" name="id" value={q.id} />
                          <div className="space-y-2"><input name="recipient" defaultValue={q.name} aria-label="Recipient" className={inputCls} /><input name="phone" defaultValue={q.phone} aria-label="Delivery phone" className={inputCls} /><input name="line1" placeholder="Street address" aria-label="Street address" className={inputCls} required />
                            <div className="grid grid-cols-2 gap-2"><input name="city" placeholder="City" aria-label="City" className={inputCls} required /><select name="state" aria-label="State" defaultValue="Lagos" className={inputCls}>{states.map((s) => (<option key={s}>{s}</option>))}</select></div></div></ActionForm></details>) : null}
                  </Card></li>))}</ul>
              </section>);
          })}
        </div>)}
    </>
  );
}
