import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Empty, PageTitle, StatusBadge, fmtDate, inputCls } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Search' };

type Order = { number: string; status: string; created_at: string; total_kobo: number; email: string; recipient: string };
type Customer = { email: string; name: string | null; orders: number; spend: number };
type Product = { id: string; slug: string; name: string; type: string; is_active: boolean; base_price_kobo: number };

/** One search box for orders (number, name, phone, email), customers and, for admins, products. */
export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireStaff('/admin/search');
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const [orders, customers, catalogue] = q
    ? await Promise.all([
        adm<{ total: number; rows: Order[] }>('admin_orders_list', me, { q, include_unpaid: true, per_page: 10 }),
        adm<{ total: number; rows: Customer[] }>('admin_customers_list', me, { q, per_page: 10 }),
        me.role === 'admin' ? adm<{ products: Product[] }>('admin_catalogue_list', me) : Promise.resolve(null),
      ])
    : [null, null, null];
  const needle = q.toLowerCase();
  const products = catalogue?.products.filter((p) => p.name.toLowerCase().includes(needle) || p.slug.includes(needle)).slice(0, 10) ?? [];

  return (
    <>
      <PageTitle title="Search" sub={q ? `Results for “${q}”` : 'Find an order, customer or product'} />
      <form method="get" role="search" className="mb-6 flex gap-2">
        <label htmlFor="sq" className="sr-only">Search</label>
        <input id="sq" name="q" defaultValue={q} placeholder="Order number, name, phone, email or product" className={inputCls} autoFocus />
        <button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Search</button>
      </form>
      {!q ? null : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`Orders (${orders?.total ?? 0})`}>
            {orders && orders.rows.length ? (
              <ul className="divide-y divide-line">
                {orders.rows.map((o) => (
                  <li key={o.number}>
                    <Link href={`/admin/orders/${o.number}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline">
                      <span><strong>{o.number}</strong> <span className="text-sm text-muted">{o.recipient} · {fmtDate(o.created_at)}</span></span>
                      <span className="flex items-center gap-2 text-sm"><StatusBadge status={o.status} />{formatNaira(o.total_kobo)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>No orders match.</Empty>}
            {orders && orders.total > orders.rows.length && <Link href={`/admin/orders?q=${encodeURIComponent(q)}&include_unpaid=true`} className="mt-3 inline-block text-sm font-semibold underline">See all {orders.total} orders</Link>}
          </Card>
          <Card title={`Customers (${customers?.total ?? 0})`}>
            {customers && customers.rows.length ? (
              <ul className="divide-y divide-line">
                {customers.rows.map((c) => (
                  <li key={c.email}>
                    <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}&include_unpaid=true`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline">
                      <span><strong>{c.name ?? c.email}</strong> <span className="block text-sm text-muted">{c.email}</span></span>
                      <span className="text-sm">{c.orders} orders · {formatNaira(c.spend)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>No customers match.</Empty>}
          </Card>
          {me.role === 'admin' && (
            <Card title={`Products (${products.length})`} className="lg:col-span-2">
              {products.length ? (
                <ul className="divide-y divide-line">
                  {products.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/catalogue/products/${p.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline">
                        <span><strong>{p.name}</strong> <span className="text-sm text-muted">{p.type}{p.is_active ? '' : ' · hidden'}</span></span>
                        <span className="text-sm">{formatNaira(p.base_price_kobo)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No products match.</Empty>}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
