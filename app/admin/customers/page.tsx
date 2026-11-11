import type { Metadata } from 'next';
import Link from 'next/link';
import { DataTable, Empty, PageTitle, fmtDate, inputCls } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Customers' };
type C = { email: string; name: string | null; phone: string | null; orders: number; spend: number; last_order: string | null; store_credit_kobo: number; has_account: boolean };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireStaff('/admin/customers');
  const { q, page: pg } = await searchParams; const page = Math.max(1, Number(pg) || 1);
  const r = await adm<{ total: number; per_page: number; rows: C[] }>('admin_customers_list', me, { q, page, per_page: 25 });
  const pages = Math.max(1, Math.ceil(r.total / r.per_page));
  return (
    <>
      <PageTitle title="Customers" sub={`${r.total} customers who have paid for an order`} actions={<a href={`/admin/customers/export${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-4 text-sm font-semibold">Export CSV</a>} />
      <form method="get" className="mb-4 flex gap-2"><label htmlFor="cq" className="sr-only">Search customers</label><input id="cq" name="q" defaultValue={q} placeholder="Name or email" className={inputCls} /><button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Search</button></form>
      {r.rows.length === 0 ? <Empty>No customers found.</Empty> : (
        <DataTable caption="Customers" head={['Customer', 'Orders', 'Lifetime spend', 'Last order', 'Store credit', 'Account']}>
          {r.rows.map((c) => (<tr key={c.email}><td className="px-3 py-2.5 font-semibold">{c.name ?? '—'}<div className="text-xs font-normal text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div></td><td className="px-3 py-2.5">{c.orders}</td><td className="px-3 py-2.5 font-semibold">{formatNaira(c.spend)}</td><td className="px-3 py-2.5">{fmtDate(c.last_order)}</td><td className="px-3 py-2.5">{formatNaira(c.store_credit_kobo)}</td><td className="px-3 py-2.5">{c.has_account ? 'Yes' : 'Guest'}</td></tr>))}
        </DataTable>)}
      {pages > 1 && <nav className="mt-4 flex justify-between text-sm" aria-label="Pages">{page > 1 ? <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`} className="min-h-11 font-semibold underline">← Previous</Link> : <span />}<span className="text-muted">Page {page} of {pages}</span>{page < pages ? <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`} className="min-h-11 font-semibold underline">Next →</Link> : <span />}</nav>}
    </>
  );
}
