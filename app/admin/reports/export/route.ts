import { adm, requireAdmin } from '@/lib/admin/db';
import { csvResponse, toCsv } from '@/lib/admin/csv';

export const dynamic = 'force-dynamic';
const naira = (k: number) => (k / 100).toFixed(2);

/** CSV downloads for each report. Admin only (checked here, and in the database function). */
export async function GET(request: Request) {
  const me = await requireAdmin('/admin/reports');
  const sp = new URL(request.url).searchParams;
  const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const from = ok(sp.get('from')), to = ok(sp.get('to'));
  if (!from || !to) return new Response('Bad dates', { status: 400 });
  const r = await adm<{ by_day: { date: string; orders: number; revenue: number }[]; designs: { name: string; qty: number; revenue: number }[]; products: { name: string; qty: number; revenue: number }[]; bundles: { name: string; qty: number; revenue: number }[]; collections: { name: string; qty: number; revenue: number }[]; zones: { name: string; orders: number; revenue: number }[]; ambassadors: { code: string; orders: number; revenue: number; commission: number }[] }>('admin_reports', me, { from, to });
  const t = sp.get('type') ?? 'sales';
  const name = `pemart-${t}-${from}-to-${to}.csv`;
  switch (t) {
    case 'designs': return csvResponse(name, toCsv(['Design', 'Quantity', 'Revenue (NGN)'], r.designs.map((x) => [x.name, x.qty, naira(x.revenue)])));
    case 'products': return csvResponse(name, toCsv(['Product', 'Quantity', 'Revenue (NGN)'], r.products.map((x) => [x.name, x.qty, naira(x.revenue)])));
    case 'bundles': return csvResponse(name, toCsv(['Bundle', 'Quantity', 'Revenue (NGN)'], r.bundles.map((x) => [x.name, x.qty, naira(x.revenue)])));
    case 'collections': return csvResponse(name, toCsv(['Collection', 'Quantity', 'Revenue (NGN)'], r.collections.map((x) => [x.name, x.qty, naira(x.revenue)])));
    case 'zones': return csvResponse(name, toCsv(['Zone', 'Orders', 'Revenue (NGN)'], r.zones.map((x) => [x.name, x.orders, naira(x.revenue)])));
    case 'ambassadors': return csvResponse(name, toCsv(['Code', 'Orders', 'Revenue (NGN)', 'Commission (NGN)'], r.ambassadors.map((x) => [x.code, x.orders, naira(x.revenue), naira(x.commission)])));
    default: return csvResponse(name, toCsv(['Date', 'Orders', 'Revenue (NGN)'], r.by_day.map((x) => [x.date, x.orders, naira(x.revenue)])));
  }
}
