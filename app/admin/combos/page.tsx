import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card, Empty, PageTitle } from '@/components/admin/ui';
import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import { duplicateComboAction, moveComboAction, setComboStatusAction } from '@/lib/admin/actions-combos';
import { configIssues, startingPrice } from '@/lib/combos/pricing';
import type { ComboConfig } from '@/lib/combos/types';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Combo Management' };
type Row = { id: string; slug: string; name: string; label: string | null; status: 'draft' | 'published' | 'archived'; sort_order: number; version: number; published_at: string | null; has_unpublished_changes: boolean; config: ComboConfig; orders: number };
const STATUS = { draft: 'Draft', published: 'Published', archived: 'Archived' } as const;

export default async function CombosAdmin() {
  const me = await requirePerm('catalogue', '/admin/combos');
  let rows: Row[];
  try { rows = await adm<Row[]>('admin_combos_list', me); }
  catch (e) { if (isMissingFunction(e)) return (<><PageTitle title="Combo Management" /><NeedsMigration migration="0024_combos.sql" what="Combo Management" /></>); throw e; }
  const live = rows.filter((r) => r.status !== 'archived');
  return (
    <>
      <PageTitle title="Combo Management" sub="Build customisable collections (Behold, Abide, The Doer’s), set what is included and what each choice costs the customer."
        actions={<><Link href="/admin/combos/new" className="inline-flex min-h-11 items-center rounded-btn bg-ink px-5 text-sm font-semibold text-paper">New combo</Link>
          <Link href="/admin/combos/library" className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-5 text-sm font-semibold">Item library</Link>
          <Link href="/admin/combos/storefront" className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-5 text-sm font-semibold">Website text</Link></>} />
      <p className="mb-4 rounded-lg border border-line bg-sand/40 p-3 text-sm">Drafts and unpublished changes are <strong>never</strong> visible to customers. A combo with no selling price shows “Price currently unavailable” and cannot be bought.</p>
      {rows.length === 0 ? <Empty>No combos yet. Create one to get started.</Empty> : (
        <ul className="space-y-3">
          {rows.map((r, i) => {
            const issues = configIssues(r.config), errs = issues.filter((x) => x.level === 'error').length;
            const from = startingPrice(r.config);
            const ids = live.map((x) => x.id);
            const idx = ids.indexOf(r.id);
            const swap = (d: number) => { const n = [...ids]; const j = idx + d; if (idx < 0 || j < 0 || j >= n.length) return null; [n[idx], n[j]] = [n[j]!, n[idx]!]; return JSON.stringify(n); };
            return (
              <li key={r.id}><Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="display text-2xl"><Link href={`/admin/combos/${r.id}`} className="underline-offset-4 hover:underline">{r.name}</Link>{r.label && <span className="ml-2 text-sm font-normal text-muted">{r.label}</span>}</h2>
                    <p className="mt-1 text-sm text-muted">/{r.slug} · order {i + 1} · {r.orders} order line{r.orders === 1 ? '' : 's'}</p>
                    <p className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className={`rounded-full px-2.5 py-1 ${r.status === 'published' ? 'bg-ink text-paper' : 'bg-line text-ink'}`}>{STATUS[r.status]}</span>
                      {r.has_unpublished_changes && <span className="rounded-full bg-mocha px-2.5 py-1 text-[#141414]">Unpublished changes</span>}
                      <span className={`rounded-full px-2.5 py-1 ${from === null ? 'bg-ember text-[#141414]' : 'bg-denim text-[#141414]'}`}>{from === null ? 'No price set' : `From ${formatNaira(from)}`}</span>
                      {errs > 0 && <span className="rounded-full bg-ember px-2.5 py-1 text-[#141414]">{errs} to fix</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/combos/${r.id}`} className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-4 text-sm font-semibold">Edit</Link>
                    <Link href={`/admin/combos/${r.id}/preview`} className="inline-flex min-h-11 items-center rounded-btn border-2 border-line px-4 text-sm font-semibold hover:border-ink">Preview</Link>
                    {r.status === 'published' && <Link href={`/combos/${r.slug}`} target="_blank" className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">View live</Link>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {r.status === 'published' && (<ActionForm action={setComboStatusAction} submitLabel="Unpublish" variant="secondary" confirm="Unpublish this combo? It disappears from the website straight away."><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="draft" /></ActionForm>)}
                  {r.status === 'archived' && (<ActionForm action={setComboStatusAction} submitLabel="Restore as draft" variant="secondary"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="draft" /></ActionForm>)}
                  {r.status !== 'archived' && (<ActionForm action={setComboStatusAction} submitLabel="Archive" variant="secondary" confirm="Archive this combo? Past orders keep their details."><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="archived" /></ActionForm>)}
                  <ActionForm action={duplicateComboAction} submitLabel="Duplicate" variant="secondary"><input type="hidden" name="id" value={r.id} /></ActionForm>
                  {r.status !== 'archived' && swap(-1) && (<ActionForm action={moveComboAction} submitLabel="Move up" variant="secondary"><input type="hidden" name="ids" value={swap(-1)!} /></ActionForm>)}
                  {r.status !== 'archived' && swap(1) && (<ActionForm action={moveComboAction} submitLabel="Move down" variant="secondary"><input type="hidden" name="ids" value={swap(1)!} /></ActionForm>)}
                </div>
              </Card></li>
            );
          })}
        </ul>
      )}
    </>
  );
}
