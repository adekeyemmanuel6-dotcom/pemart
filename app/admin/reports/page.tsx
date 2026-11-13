import type { Metadata } from 'next';
import { Bars, LineChart } from '@/components/admin/line-chart';
import { Card, DataTable, PageTitle, Stat, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requirePerm } from '@/lib/admin/db';
import { lagosDay } from '@/lib/admin/dates';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Reports' };
type Row = { name: string; qty: number; revenue: number };
type Rep = { totals: { orders: number; revenue: number; aov: number }; by_day: { date: string; orders: number; revenue: number }[]; designs: Row[]; products: Row[]; bundles: Row[]; collections: Row[]; zones: { name: string; orders: number; revenue: number }[]; ambassadors: { code: string; orders: number; revenue: number; commission: number }[] };

const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requirePerm('reports', '/admin/reports');
  const sp = await searchParams;
  let from = valid(sp.from) ?? lagosDay(-29), to = valid(sp.to) ?? lagosDay(0);
  if (from > to) [from, to] = [to, from];
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  if (days > 366) from = lagosDay(-365);
  const r = await adm<Rep>('admin_reports', me, { from, to });
  const q = `from=${from}&to=${to}`;
  const exp = (t: string) => <a href={`/admin/reports/export?type=${t}&${q}`} className="text-sm font-semibold underline underline-offset-4">Download CSV</a>;
  return (
    <>
      <PageTitle title="Reports" sub="Counts paid orders (not cancelled or refunded) by the day they were paid, Lagos time. Item revenue is before discounts." />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-sand/40 p-4" aria-label="Date range">
        <div><label htmlFor="rf" className={labelCls}>From</label><input id="rf" type="date" name="from" defaultValue={from} className={inputCls} /></div>
        <div><label htmlFor="rt" className={labelCls}>To</label><input id="rt" type="date" name="to" defaultValue={to} className={inputCls} /></div>
        <button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Update</button>
        <div className="flex gap-2 text-sm">{[['7 days', 6], ['30 days', 29], ['90 days', 89]].map(([l, n]) => (<a key={String(l)} href={`?from=${lagosDay(-(n as number))}&to=${lagosDay(0)}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-3 font-semibold">{l}</a>))}</div>
      </form>
      <section className="mb-5 grid grid-cols-3 gap-3" aria-label="Totals"><Stat label="Revenue" value={formatNaira(r.totals.revenue)} /><Stat label="Orders" value={r.totals.orders} /><Stat label="Average order" value={formatNaira(r.totals.aov)} /></section>
      <Card title="Sales by day"><LineChart data={r.by_day} /><div className="mt-2 text-right">{exp('sales')}</div>
        <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Show as a table</summary><DataTable caption="Sales by day" head={['Date', 'Orders', 'Revenue']}>{r.by_day.map((d) => (<tr key={d.date}><td className="px-3 py-2">{d.date}</td><td className="px-3 py-2">{d.orders}</td><td className="px-3 py-2">{formatNaira(d.revenue)}</td></tr>))}</DataTable></details></Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Best-selling designs"><Bars label="Best-selling designs" rows={r.designs} /><div className="mt-2 text-right">{exp('designs')}</div></Card>
        <Card title="Best-selling products"><Bars label="Best-selling products" rows={r.products} /><div className="mt-2 text-right">{exp('products')}</div></Card>
        <Card title="Bundles">{r.bundles.length ? <Bars label="Bundles" rows={r.bundles} /> : <p className="text-sm text-muted">No bundles sold in this period.</p>}<div className="mt-2 text-right">{exp('bundles')}</div></Card>
        <Card title="By collection"><Bars label="Sales by collection" rows={r.collections} /><div className="mt-2 text-right">{exp('collections')}</div></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="By delivery zone"><DataTable caption="Sales by delivery zone" head={['Zone', 'Orders', 'Revenue']}>{r.zones.map((z) => (<tr key={z.name}><td className="px-3 py-2">{z.name}</td><td className="px-3 py-2">{z.orders}</td><td className="px-3 py-2">{formatNaira(z.revenue)}</td></tr>))}</DataTable><div className="mt-2 text-right">{exp('zones')}</div></Card>
        <Card title="By ambassador code">{r.ambassadors.length === 0 ? <p className="text-sm text-muted">No ambassador sales in this period.</p> : <DataTable caption="Sales by ambassador code" head={['Code', 'Orders', 'Revenue', 'Commission']}>{r.ambassadors.map((a) => (<tr key={a.code}><td className="px-3 py-2 font-semibold">{a.code}</td><td className="px-3 py-2">{a.orders}</td><td className="px-3 py-2">{formatNaira(a.revenue)}</td><td className="px-3 py-2">{formatNaira(a.commission)}</td></tr>))}</DataTable>}<div className="mt-2 text-right">{exp('ambassadors')}</div></Card>
      </div>
    </>
  );
}
