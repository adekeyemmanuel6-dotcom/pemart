import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { bulkProductStatusAction } from '@/lib/admin/actions-catalogue';
import { Card, DataTable, PageTitle, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requirePerm } from '@/lib/admin/db';
import { saveCollectionAction, saveDesignAction, saveProductAction } from '@/lib/admin/actions-admin';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Catalogue' };
type Cat = {
  collections: { id: string; slug: string; name: string; intro: string | null; hero_image: string | null; sort_order: number; is_active: boolean; is_seasonal: boolean }[];
  designs: { id: string; slug: string; name: string; story_or_verse: string | null; verse_reference: string | null; collection_id: string | null; artwork_front: string | null; artwork_back: string | null; preview_image: string | null; is_customisable: boolean; customisable_fields: string[]; is_active: boolean }[];
  products: { id: string; slug: string; name: string; type: string; is_active: boolean; status?: 'draft' | 'active' | 'archived'; base_price_kobo: number; variants: number; images: number }[];
  bundles: { id: string; slug: string; name: string; kind: string; price_kobo: number; is_active: boolean; slots: number; available_until: string | null }[];
};
const TABS = ['products', 'bundles', 'designs', 'collections'] as const;
type Status = 'draft' | 'active' | 'archived';
/** Before migration 0021 there is no status column: derive it from visibility. */
const statusOf = (p: { status?: Status; is_active: boolean }): Status => p.status ?? (p.is_active ? 'active' : 'draft');
function StatusPill({ s }: { s: Status }) {
  const cls = s === 'active' ? 'bg-[#1f3d2b] text-[#bfe6cb]' : s === 'draft' ? 'bg-sand text-ink' : 'bg-transparent text-muted border border-line';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{s === 'active' ? 'Active' : s === 'draft' ? 'Draft' : 'Archived'}</span>;
}
const TYPES = ['tee', 'hoodie', 'frame', 'perfume', 'jewellery', 'bracelet', 'glasses', 'fun', 'gift_card'];

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string }> }) {
  const me = await requirePerm('catalogue', '/admin/catalogue');
  const sp = await searchParams; const tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? sp.tab! : 'products';
  const cat = await adm<Cat>('admin_catalogue_list', me);
  const q = (sp.q ?? '').toLowerCase();
  const collOpts = cat.collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>));
  return (
    <>
      <PageTitle title="Catalogue" sub="Designs, products, bundles and collections. Changes appear on the store within minutes."
        actions={<div className="flex flex-wrap gap-2"><Link href="/admin/catalogue/import" className="inline-flex min-h-11 items-center rounded-btn border border-line px-4 text-sm font-semibold">Import CSV</Link><a href="/admin/catalogue/export" className="inline-flex min-h-11 items-center rounded-btn border border-line px-4 text-sm font-semibold">Export CSV</a></div>} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Catalogue sections">{TABS.map((t) => (<Link key={t} href={`?tab=${t}`} aria-current={tab === t ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${tab === t ? 'bg-ink text-paper' : 'border border-line'}`}>{t[0]!.toUpperCase() + t.slice(1)}</Link>))}</nav>

      {tab === 'products' && (<>
        <form method="get" className="mb-3 flex gap-2"><input type="hidden" name="tab" value="products" /><label htmlFor="pq" className="sr-only">Search products</label><input id="pq" name="q" defaultValue={sp.q} placeholder="Search products" className={inputCls} /><button className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper">Search</button></form>
        <nav className="mb-3 flex flex-wrap gap-2 text-sm" aria-label="Filter by status">
          {([['', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']] as const).map(([v, l]) => (
            <Link key={v} href={`?tab=products${v ? `&status=${v}` : ''}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`} aria-current={(sp.status ?? '') === v ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-3 ${(sp.status ?? '') === v ? 'bg-ink text-paper' : 'border border-line'}`}>
              {l} <span className="ml-1 opacity-70">{cat.products.filter((p) => !v || statusOf(p) === v).length}</span>
            </Link>
          ))}
        </nav>
        <ActionForm action={bulkProductStatusAction} submitLabel="Apply to ticked products" pendingLabel="Updating…" variant="secondary">
          <DataTable caption="Products" head={['', 'Product', 'Type', 'Price', 'Variants', 'Photos', 'Status']}>
            {cat.products.filter((p) => (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q)) && (!sp.status || statusOf(p) === sp.status)).map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2.5"><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.name}`} className="size-5 accent-ink" /></td>
                <td className="px-3 py-2.5"><Link href={`/admin/catalogue/products/${p.id}`} className="font-semibold underline underline-offset-4">{p.name}</Link><div className="text-xs text-muted">{p.slug}</div></td><td className="px-3 py-2.5">{p.type}</td><td className="px-3 py-2.5">{formatNaira(p.base_price_kobo)}</td><td className="px-3 py-2.5">{p.variants}</td><td className="px-3 py-2.5">{p.images}</td>
                <td className="px-3 py-2.5"><StatusPill s={statusOf(p)} /></td>
              </tr>))}
          </DataTable>
          <div className="mt-3 flex flex-wrap items-end gap-2"><label htmlFor="bulk-status" className={labelCls}>Set ticked products to</label>
            <select id="bulk-status" name="status" className={`${inputCls} max-w-48`}><option value="active">Active (on the store)</option><option value="draft">Draft (hidden)</option><option value="archived">Archived</option></select></div>
        </ActionForm>
        <Card title="New product" className="mt-5"><ActionForm action={saveProductAction} submitLabel="Create product" pendingLabel="Creating…" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls} htmlFor="np-name">Name</label><input id="np-name" name="name" required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="np-slug">Slug (web address)</label><input id="np-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="my-new-tee" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="np-type">Type</label><select id="np-type" name="type" className={inputCls}>{TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
            <div><label className={labelCls} htmlFor="np-price">Price (₦)</label><input id="np-price" name="price" inputMode="decimal" required placeholder="22000" className={inputCls} /></div>
          </div><div className="mt-3 max-w-xs"><label className={labelCls} htmlFor="np-status">Status</label><select id="np-status" name="status" defaultValue="draft" className={inputCls}><option value="draft">Draft (hidden until ready)</option><option value="active">Active (on the store)</option></select></div><label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="is_made_to_order" defaultChecked className="size-5 accent-ink" />Made to order (no stock count)</label>
        </ActionForm></Card></>)}

      {tab === 'bundles' && (<>
        <DataTable caption="Bundles" head={['Bundle', 'Kind', 'Price', 'Items', 'Available until', 'Status']}>
          {cat.bundles.map((b) => (<tr key={b.id}><td className="px-3 py-2.5"><Link href={`/admin/catalogue/bundles/${b.id}`} className="font-semibold underline underline-offset-4">{b.name}</Link></td><td className="px-3 py-2.5">{b.kind}</td><td className="px-3 py-2.5">{formatNaira(b.price_kobo)}</td><td className="px-3 py-2.5">{b.slots}</td><td className="px-3 py-2.5">{b.available_until ? new Date(b.available_until).toLocaleDateString('en-NG') : '—'}</td><td className="px-3 py-2.5">{b.is_active ? 'Live' : 'Hidden'}</td></tr>))}
        </DataTable>
        <Link href="/admin/catalogue/bundles/new" className="mt-4 inline-flex min-h-11 items-center rounded-btn bg-ink px-5 text-sm font-semibold text-paper">New bundle</Link></>)}

      {tab === 'designs' && (<div className="space-y-2">
        {cat.designs.map((d) => (<details key={d.id} className="rounded-lg border border-line bg-sand/30 p-3"><summary className="min-h-11 cursor-pointer font-semibold">{d.name} <span className="text-sm font-normal text-muted">· {d.slug}{d.is_active ? '' : ' · hidden'}</span></summary><DesignForm d={d} collOpts={collOpts} /></details>))}
        <details className="rounded-lg border-2 border-ink p-3"><summary className="min-h-11 cursor-pointer font-semibold">+ New design</summary><DesignForm collOpts={collOpts} /></details></div>)}

      {tab === 'collections' && (<div className="space-y-2">
        {cat.collections.map((c) => (<details key={c.id} className="rounded-lg border border-line bg-sand/30 p-3"><summary className="min-h-11 cursor-pointer font-semibold">{c.name} <span className="text-sm font-normal text-muted">· {c.slug}{c.is_active ? '' : ' · hidden'}</span></summary><CollectionForm c={c} /></details>))}
        <details className="rounded-lg border-2 border-ink p-3"><summary className="min-h-11 cursor-pointer font-semibold">+ New collection</summary><CollectionForm /></details></div>)}
    </>
  );
}

function CollectionForm({ c }: { c?: Cat['collections'][number] }) {
  return (<ActionForm action={saveCollectionAction} submitLabel="Save collection" className="mt-3">{c && <input type="hidden" name="id" value={c.id} />}
    <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelCls}>Name</label><input name="name" defaultValue={c?.name} required className={inputCls} /></div><div><label className={labelCls}>Slug</label><input name="slug" defaultValue={c?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Intro (shown at the top of the page)</label><textarea name="intro" defaultValue={c?.intro ?? ''} rows={2} className={`${inputCls} py-2`} /></div>
      <div><label className={labelCls}>Hero image URL</label><input name="hero_image" defaultValue={c?.hero_image ?? ''} className={inputCls} /></div><div><label className={labelCls}>Sort order</label><input name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} className={inputCls} /></div></div>
    <div className="mt-2 flex gap-5 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-5 accent-ink" />Visible</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="is_seasonal" defaultChecked={c?.is_seasonal} className="size-5 accent-ink" />Seasonal</label></div></ActionForm>);
}
function DesignForm({ d, collOpts }: { d?: Cat['designs'][number]; collOpts: React.ReactNode }) {
  return (<ActionForm action={saveDesignAction} submitLabel="Save design" className="mt-3">{d && <input type="hidden" name="id" value={d.id} />}
    <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelCls}>Name</label><input name="name" defaultValue={d?.name} required className={inputCls} /></div><div><label className={labelCls}>Slug</label><input name="slug" defaultValue={d?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></div>
      <div><label className={labelCls}>Collection</label><select name="collection_id" defaultValue={d?.collection_id ?? ''} className={inputCls}><option value="">None</option>{collOpts}</select></div><div><label className={labelCls}>Verse reference</label><input name="verse_reference" defaultValue={d?.verse_reference ?? ''} className={inputCls} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Story or verse (KJV wording for scripture)</label><textarea name="story_or_verse" defaultValue={d?.story_or_verse ?? ''} rows={2} className={`${inputCls} py-2`} /></div>
      <div><label className={labelCls}>Back artwork (URL)</label><input name="artwork_back" defaultValue={d?.artwork_back ?? ''} className={inputCls} /></div><div><label className={labelCls}>Front artwork (URL)</label><input name="artwork_front" defaultValue={d?.artwork_front ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>Preview image (URL)</label><input name="preview_image" defaultValue={d?.preview_image ?? ''} className={inputCls} /></div><div><label className={labelCls}>Personalise fields (name, date, verse)</label><input name="customisable_fields" defaultValue={(d?.customisable_fields ?? []).join(', ')} className={inputCls} /></div></div>
    <div className="mt-2 flex gap-5 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="is_customisable" defaultChecked={d?.is_customisable} className="size-5 accent-ink" />Can be personalised</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={d?.is_active ?? true} className="size-5 accent-ink" />Visible</label></div></ActionForm>);
}
