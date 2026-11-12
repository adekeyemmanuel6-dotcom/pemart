import Link from 'next/link';
import { Card, Empty, Stat, StatusBadge, fmtDate } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { formatNaira } from '@/lib/money';

type Overview = {
  revenue: {
    today_orders: number;
    today_revenue: number;
    week_orders: number;
    week_revenue: number;
    aov: number;
    bundle_share: number;
    conversion: number;
    checkouts_started: number;
    checkouts_paid: number;
  } | null;
  due_48h: number;
  at_risk: { number: string; status: string; promised_by: string; recipient: string }[];
  proofs_waiting: number;
  proofs_overdue: number;
  low_stock: {
    id: string;
    product: string;
    sku: string;
    colour: string | null;
    size: string | null;
    option: string | null;
    available: number;
  }[];
  new_quotes: number;
  pending_reviews: number;
  refunds_needed: number;
};

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireStaff('/admin');
  const sp = await searchParams;
  const o = await adm<Overview>('admin_overview', me);
  const r = o.revenue;
  return (
    <>
      <div className="mb-5 mt-6">
        <h1 className="display text-4xl sm:text-5xl">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <strong className="text-ink">{me.role}</strong>.
        </p>
      </div>
      {me.role === 'admin' && (
        <Link href="/admin/website" className="mb-5 block rounded-lg border border-line bg-sand/40 p-5">
          <h2 className="display text-2xl">Edit your website →</h2>
          <p className="mt-2 text-sm text-muted">
            Homepage, pages, menus, brand colours, images and search descriptions.
          </p>
        </Link>
      )}
      {sp.denied && (
        <p role="alert" className="mb-4 rounded-lg border border-ember bg-ember/15 p-3 text-sm font-semibold">
          That area is for admins only.
        </p>
      )}

      {r ? (
        <section aria-label="Sales" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Revenue today" value={formatNaira(r.today_revenue)} />
          <Stat label="Orders today" value={r.today_orders} />
          <Stat label="Revenue this week" value={formatNaira(r.week_revenue)} />
          <Stat label="Orders this week" value={r.week_orders} />
          <Stat label="Average order" value={formatNaira(r.aov)} />
          <Stat label="Orders with a bundle" value={`${r.bundle_share}%`} />
          <Stat label="Checkout to paid (7 days)" value={`${r.conversion}%`} />
          <Stat label="Started / paid" value={`${r.checkouts_started} / ${r.checkouts_paid}`} />
        </section>
      ) : (
        <p className="mb-6 rounded-lg border border-line bg-sand/40 p-3 text-sm text-muted">
          Sales figures are visible to admins. Your dashboard shows what needs doing.
        </p>
      )}

      <section aria-label="Needs attention" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Due in 48 hours"
          value={o.due_48h}
          href="/admin/production"
          tone={o.due_48h ? 'warn' : undefined}
        />
        <Stat
          label="Proofs waiting"
          value={`${o.proofs_waiting}${o.proofs_overdue ? ` (${o.proofs_overdue} late)` : ''}`}
          href="/admin/proofs"
          tone={o.proofs_overdue ? 'bad' : o.proofs_waiting ? 'warn' : undefined}
        />
        <Stat
          label="New bulk quotes"
          value={o.new_quotes}
          href="/admin/quotes"
          tone={o.new_quotes ? 'warn' : undefined}
        />
        <Stat
          label="Reviews to approve"
          value={o.pending_reviews}
          href="/admin/reviews"
          tone={o.pending_reviews ? 'warn' : undefined}
        />
        {o.refunds_needed > 0 && (
          <Stat label="Refunds needed" value={o.refunds_needed} href="/admin/orders?q=" tone="bad" />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="At risk of missing the promise">
          {o.at_risk.length === 0 ? (
            <Empty>Nothing at risk. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {o.at_risk.map((x) => {
                const late = new Date(x.promised_by) < new Date();
                return (
                  <li
                    key={x.number}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2 ${late ? 'text-ember' : ''}`}
                  >
                    <Link href={`/admin/orders/${x.number}`} className="font-semibold underline underline-offset-4">
                      {x.number}
                    </Link>
                    <span className="text-sm">{x.recipient}</span>
                    <StatusBadge status={x.status} />
                    <span className="text-sm font-semibold">
                      {late ? 'Overdue since ' : 'Due '}
                      {fmtDate(x.promised_by, true)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Low stock">
          {o.low_stock.length === 0 ? (
            <Empty>Stock looks healthy.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {o.low_stock.map((v) => (
                <li key={v.id} className="flex justify-between gap-2 py-2 text-sm">
                  <span>
                    {v.product}{' '}
                    <span className="text-muted">({[v.colour, v.size, v.option].filter(Boolean).join(', ')})</span>
                  </span>
                  <span className={`font-bold ${v.available <= 0 ? 'text-ember' : ''}`}>{v.available} left</span>
                </li>
              ))}
            </ul>
          )}
          {me.role === 'admin' && (
            <Link
              href="/admin/catalogue"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
            >
              Adjust stock
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
