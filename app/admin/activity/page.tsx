import type { Metadata } from 'next';
import Link from 'next/link';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Empty, PageTitle, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { adm, isMissingFunction, requireAdmin } from '@/lib/admin/db';

export const metadata: Metadata = { title: 'Activity log' };

type Entry = { id: number; at: string; actor_email: string | null; table_name: string; row_id: string | null; label: string | null; action: 'insert' | 'update' | 'delete'; changes: Record<string, unknown> };

const TABLES: Record<string, string> = {
  products: 'Products', product_variants: 'Variants & stock', product_images: 'Product photos', designs: 'Designs', collections: 'Collections',
  bundles: 'Gift boxes & bundles', bundle_slots: 'Bundle contents', discount_codes: 'Discount codes', delivery_zones: 'Delivery',
  settings: 'Settings & website', reviews: 'Reviews', profiles: 'Team access',
};
const VERB = { insert: 'created', update: 'changed', delete: 'deleted' } as const;

const show = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Read-only trail of admin changes: who, when, what. Written by the database itself, so it cannot be skipped. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ table?: string; q?: string; page?: string }> }) {
  const me = await requireAdmin('/admin/activity');
  const sp = await searchParams;
  const table = sp.table && sp.table in TABLES ? sp.table : '';
  const q = (sp.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  let log: { total: number; per_page: number; rows: Entry[] } | null = null;
  try { log = await adm('admin_activity_list', me, { table, q, page, per_page: 50 }); } catch (e) { if (!isMissingFunction(e)) throw e; }
  const pages = log ? Math.max(1, Math.ceil(log.total / log.per_page)) : 1;
  const qs = (p: number) => `?${new URLSearchParams({ ...(table ? { table } : {}), ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageTitle title="Activity log" sub="Every change made in the admin, newest first." />
      {!log ? <NeedsMigration migration="0017_admin_control.sql" what="The activity log" /> : (
        <>
          <form method="get" className="mb-4 grid gap-3 rounded-lg border border-line bg-sand/40 p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <div><label htmlFor="a-q" className={labelCls}>Search</label><input id="a-q" name="q" defaultValue={q} placeholder="Item name or team member email" className={inputCls} /></div>
            <div><label htmlFor="a-t" className={labelCls}>Area</label>
              <select id="a-t" name="table" defaultValue={table} className={inputCls}><option value="">Everything</option>{Object.entries(TABLES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select>
            </div>
            <div className="flex gap-2"><button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Filter</button><Link href="/admin/activity" className="inline-flex min-h-11 items-center px-2 text-sm underline">Clear</Link></div>
          </form>
          {log.rows.length === 0 ? <Empty>No changes recorded yet. Changes appear here as soon as someone edits something in the admin.</Empty> : (
            <ol className="divide-y divide-line rounded-lg border border-line" aria-label="Changes">
              {log.rows.map((e) => {
                const entries = Object.entries(e.changes ?? {});
                return (
                  <li key={e.id} className="p-4">
                    <p className="text-sm">
                      <strong>{e.actor_email ?? 'Unknown'}</strong> {VERB[e.action]} <span className="text-muted">{TABLES[e.table_name] ?? e.table_name}</span>
                      {e.label && <> · <strong>{e.label}</strong></>}
                      <span className="block text-xs text-muted sm:float-right sm:inline">{fmtDate(e.at, true)}</span>
                    </p>
                    {e.action === 'update' && entries.length > 0 && (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-muted">{entries.length} field{entries.length === 1 ? '' : 's'}: {entries.map(([k]) => k.replace(/_/g, ' ')).slice(0, 4).join(', ')}{entries.length > 4 ? '…' : ''}</summary>
                        <dl className="mt-2 grid gap-1">
                          {entries.map(([k, v]) => (
                            <div key={k} className="grid gap-2 sm:grid-cols-[180px_1fr]">
                              <dt className="font-semibold">{k.replace(/_/g, ' ')}</dt>
                              <dd className="break-words text-muted">{Array.isArray(v) ? <><s>{show(v[0])}</s> → <span className="text-ink">{show(v[1])}</span></> : show(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {pages > 1 && <nav className="mt-4 flex justify-between text-sm" aria-label="Pages">{page > 1 ? <Link href={qs(page - 1)} className="min-h-11 font-semibold underline">← Newer</Link> : <span />}<span className="text-muted">Page {page} of {pages}</span>{page < pages ? <Link href={qs(page + 1)} className="min-h-11 font-semibold underline">Older →</Link> : <span />}</nav>}
        </>
      )}
    </>
  );
}
