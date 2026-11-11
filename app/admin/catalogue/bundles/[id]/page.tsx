import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { SlotEditor, type Slot } from '@/components/admin/slot-editor';
import { Card, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireAdmin } from '@/lib/admin/db';
import { saveBundleAction } from '@/lib/admin/actions-admin';

export const metadata: Metadata = { title: 'Edit bundle' };
type B = { id: string; slug: string; name: string; kind: string; description: string | null; price_kobo: number; available_from: string | null; available_until: string | null; image: string | null; badge: string | null; sort_order: number; is_active: boolean; slots: (Slot & { id: string })[] };
const naira = (k: number | null) => (k === null ? '' : String(k / 100));
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 16) : ''); // Lagos (UTC+1) wall time for datetime-local

export default async function BundleEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin(`/admin/catalogue/bundles/${id}`);
  const isNew = id === 'new';
  const [b, cat, settings] = await Promise.all([isNew ? null : adm<B | null>('admin_bundle_get', me, { id }), adm<{ collections: { id: string; name: string }[] }>('admin_catalogue_list', me), adm<{ products: { id: string; name: string }[] }>('admin_settings_get', me)]);
  if (!isNew && !b) notFound();
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href="/admin/catalogue?tab=bundles" className="underline underline-offset-4">← Bundles</Link>{b && <> · <Link href={`/bundles/${b.slug}`} target="_blank" className="underline underline-offset-4">View on store</Link></>}</p><h1 className="display text-4xl sm:text-5xl">{b ? b.name : 'New bundle'}</h1></div>
      <ActionForm action={saveBundleAction} submitLabel="Save bundle" pendingLabel="Saving…">
        {b && <input type="hidden" name="id" value={b.id} />}
        <Card title="Details"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={labelCls} htmlFor="bn">Name</label><input id="bn" name="name" defaultValue={b?.name} required className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bs">Slug</label><input id="bs" name="slug" defaultValue={b?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bk">Kind</label><select id="bk" name="kind" defaultValue={b?.kind ?? 'combo'} className={inputCls}><option value="combo">Combo</option><option value="couple">Couple pack</option><option value="gift_box">Gift box</option></select></div>
          <div><label className={labelCls} htmlFor="bp">Bundle price (₦)</label><input id="bp" name="price" defaultValue={naira(b?.price_kobo ?? null)} inputMode="decimal" required className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bb">Badge (e.g. Most popular)</label><input id="bb" name="badge" defaultValue={b?.badge ?? ''} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bo">Sort order</label><input id="bo" name="sort_order" type="number" defaultValue={b?.sort_order ?? 0} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bf">Available from</label><input id="bf" name="available_from" type="datetime-local" defaultValue={local(b?.available_from ?? null)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bu">Available until</label><input id="bu" name="available_until" type="datetime-local" defaultValue={local(b?.available_until ?? null)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="bi">Image URL</label><input id="bi" name="image" defaultValue={b?.image ?? ''} className={inputCls} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor="bd">Description</label><textarea id="bd" name="description" defaultValue={b?.description ?? ''} rows={2} className={`${inputCls} py-2`} /></div></div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={b?.is_active ?? true} className="size-5 accent-ink" />Visible on the store</label>
          <p className="mt-1 text-sm text-muted">Gift boxes are hidden automatically after their &ldquo;available until&rdquo; time (Lagos time).</p></Card>
        <Card title="What the customer chooses" className="mt-4"><SlotEditor initial={(b?.slots ?? []).map(({ id: _id, ...s }) => { void _id; return s; })} collections={cat.collections} products={settings.products} /></Card>
      </ActionForm>
    </>
  );
}
