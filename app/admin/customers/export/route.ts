import { adm, requirePerm } from '@/lib/admin/db';
import { csvResponse, toCsv } from '@/lib/admin/csv';

export const dynamic = 'force-dynamic';

/** Customer export. Staff and admin only (checked here, and again in the database function). */
export async function GET(request: Request) {
  const me = await requirePerm('customers', '/admin/customers');
  const q = new URL(request.url).searchParams.get('q') ?? undefined;
  const r = await adm<{ rows: { email: string; name: string | null; phone: string | null; orders: number; spend: number; last_order: string | null; store_credit_kobo: number; has_account: boolean }[] }>('admin_customers_list', me, { q, page: 1, per_page: 5000 });
  return csvResponse('pemart-customers.csv', toCsv(['Name', 'Email', 'Phone', 'Orders', 'Lifetime spend (NGN)', 'Last order', 'Store credit (NGN)', 'Has account'],
    r.rows.map((c) => [c.name, c.email, c.phone, c.orders, (c.spend / 100).toFixed(2), c.last_order?.slice(0, 10), (c.store_credit_kobo / 100).toFixed(2), c.has_account ? 'yes' : 'no'])));
}
