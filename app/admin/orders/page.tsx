import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderFilters } from '@/components/admin/order-filters';
import { DataTable, Empty, PageTitle, StatusBadge, fmtDate } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { getCatalogue } from '@/lib/catalogue/load';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Orders' };
type Row = { id: string; number: string; status: string; created_at: string; paid_at: string | null; promised_by: string | null; total_kobo: number; email: string; phone: string; recipient: string; zone: string | null; has_custom: boolean; has_bundle: boolean; express: boolean; at_risk: boolean; items: string[] };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireStaff('/admin/orders');
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === 'string' && sp[k] !== '' ? (sp[k] as string) : undefined);
  const page = Math.max(1, Number(s('page')) || 1);
  const [res, cat] = await Promise.all([
    adm<{ total: number; per_page: number; rows: Row[] }>('admin_orders_list', me, { q: s('q'), status: s('status') ? [s('status')] : [], zone: s('zone'), custom: s('custom'), promised_from: s('promised_from'), promised_to: s('promised_to'), include_unpaid: s('include_unpaid') === 'true', page, per_page: 25 }),
    getCatalogue(),
  ]);
  const pages = Math.max(1, Math.ceil(res.total / res.per_page));
  const qs = (n: number) => { const p = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' && v && k !== 'page' ? [[k, v]] : []))); p.set('page', String(n)); return `?${p}`; };

  return (
    <>
      <PageTitle title="Orders" sub={`${res.total} ${res.total === 1 ? 'order' : 'orders'}`} />
      <OrderFilters sp={sp} zones={cat.zones.map((z) => z.name)} />
      {res.rows.length === 0 ? <Empty>No orders match those filters.</Empty> : (
        <>
          {/* Phones: cards. Larger screens: table. */}
          <ul className="space-y-3 md:hidden" aria-label="Orders">{res.rows.map((o) => (
            <li key={o.id} className={`rounded-lg border p-3 ${o.at_risk ? 'border-ember bg-ember/10' : 'border-line bg-sand/40'}`}>
              <div className="flex items-center justify-between gap-2"><Link href={`/admin/orders/${o.number}`} className="text-lg font-bold underline underline-offset-4">{o.number}</Link><StatusBadge status={o.status} /></div>
              <p className="mt-1 text-sm">{o.recipient} · {o.zone ?? 'n/a'}</p><p className="text-sm text-muted">{o.items.join(', ')}</p>
              <div className="mt-2 flex justify-between text-sm"><span className="font-semibold">{formatNaira(o.total_kobo)}</span><span className={o.at_risk ? 'font-semibold text-ember' : 'text-muted'}>{o.promised_by ? `Due ${fmtDate(o.promised_by)}` : o.has_custom ? 'Awaiting proof' : ''}</span></div>
            </li>))}</ul>
          <div className="hidden md:block">
            <DataTable caption="Orders" head={['Order', 'Customer', 'Items', 'Status', 'Zone', 'Total', 'Promised']}>
              {res.rows.map((o) => (
                <tr key={o.id} className={o.at_risk ? 'bg-ember/10' : ''}>
                  <td className="px-3 py-2.5"><Link href={`/admin/orders/${o.number}`} className="font-bold underline underline-offset-4">{o.number}</Link><div className="text-xs text-muted">{fmtDate(o.created_at)}{o.has_custom ? ' · custom' : ''}{o.has_bundle ? ' · bundle' : ''}{o.express ? ' · express' : ''}</div></td>
                  <td className="px-3 py-2.5">{o.recipient}<div className="text-xs text-muted">{o.phone}</div></td>
                  <td className="max-w-[16rem] px-3 py-2.5 text-muted"><span className="line-clamp-2">{o.items.join(', ')}</span></td>
                  <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td><td className="px-3 py-2.5">{o.zone ?? 'n/a'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{formatNaira(o.total_kobo)}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 ${o.at_risk ? 'font-bold text-ember' : ''}`}>{o.promised_by ? fmtDate(o.promised_by) : '—'}</td>
                </tr>))}
            </DataTable>
          </div>
          {pages > 1 && <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
            {page > 1 ? <Link href={qs(page - 1)} className="min-h-11 font-semibold underline">← Previous</Link> : <span />}<span className="text-muted">Page {page} of {pages}</span>
            {page < pages ? <Link href={qs(page + 1)} className="min-h-11 font-semibold underline">Next →</Link> : <span />}</nav>}
        </>
      )}
    </>
  );
}
