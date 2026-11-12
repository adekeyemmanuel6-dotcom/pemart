import { WORD_THEMES, BRAND_COLLECTIONS } from '@/lib/brand';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { ImageManager } from '@/components/admin/image-manager';
import { Card, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireAdmin } from '@/lib/admin/db';
import { adjustStockAction, generateVariantsAction, saveProductAction, saveVariantAction } from '@/lib/admin/actions-admin';

export const metadata: Metadata = { title: 'Edit product' };
type P = { themes?: string[]; brand_collections?: string[]; weight_grams?: number | null; id: string; slug: string; name: string; type: string; design_id: string | null; collection_id: string | null; description: string | null; care: string | null; base_price_kobo: number; compare_at_kobo: number | null; is_made_to_order: boolean; is_active: boolean; is_featured: boolean; is_seasonal: boolean; seo_title: string | null; seo_description: string | null;
  variants: { id: string; sku: string; colour: string | null; size: string | null; option: string | null; option_group: string | null; price_kobo: number | null; stock_qty: number | null; reserved_qty: number; is_active: boolean }[]; images: { id: string; url: string; alt: string; view: 'front' | 'back' | 'model' | 'detail' }[] };
const naira = (k: number | null) => (k === null ? '' : String(k / 100));
const TYPES = ['tee', 'hoodie', 'frame', 'perfume', 'jewellery', 'bracelet', 'glasses', 'fun', 'gift_card'];

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin(`/admin/catalogue/products/${id}`);
  const [p, cat] = await Promise.all([adm<P | null>('admin_product_get', me, { id }), adm<{ collections: { id: string; name: string }[]; designs: { id: string; name: string }[] }>('admin_catalogue_list', me)]);
  if (!p) notFound();
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href="/admin/catalogue" className="underline underline-offset-4">← Catalogue</Link> · <Link href={`/products/${p.slug}`} target="_blank" className="underline underline-offset-4">View on store</Link></p><h1 className="display text-4xl sm:text-5xl">{p.name}</h1></div>
      <div className="space-y-4">
        <Card title="Details"><ActionForm action={saveProductAction} submitLabel="Save product"><input type="hidden" name="id" value={p.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={labelCls} htmlFor="n">Name</label><input id="n" name="name" defaultValue={p.name} required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="s">Slug</label><input id="s" name="slug" defaultValue={p.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="t">Type</label><select id="t" name="type" defaultValue={p.type} className={inputCls}>{TYPES.map((t) => (<option key={t}>{t}</option>))}</select></div>
            <div><label className={labelCls} htmlFor="pr">Price (₦)</label><input id="pr" name="price" defaultValue={naira(p.base_price_kobo)} inputMode="decimal" required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="cp">Compare-at price (₦, optional)</label><input id="cp" name="compare_at" defaultValue={naira(p.compare_at_kobo)} inputMode="decimal" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="co">Collection</label><select id="co" name="collection_id" defaultValue={p.collection_id ?? ''} className={inputCls}><option value="">None</option>{cat.collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
            <div><label className={labelCls} htmlFor="d">Design</label><select id="d" name="design_id" defaultValue={p.design_id ?? ''} className={inputCls}><option value="">None</option>{cat.designs.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor="de">Description</label><textarea id="de" name="description" defaultValue={p.description ?? ''} rows={3} className={`${inputCls} py-2`} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor="ca">Fabric and care</label><textarea id="ca" name="care" defaultValue={p.care ?? ''} rows={2} className={`${inputCls} py-2`} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="themes">Messages (comma-separated)</label><input id="themes" name="themes" defaultValue={p.themes?.join(', ') ?? ''} className={inputCls} /><p className="text-xs text-muted">{WORD_THEMES.join(', ')}</p></div>
            <div><label className={labelCls} htmlFor="brand-collections">Brand collections (comma-separated slugs)</label><input id="brand-collections" name="brand_collections" defaultValue={p.brand_collections?.join(', ') ?? ''} className={inputCls} /><p className="text-xs text-muted">{BRAND_COLLECTIONS.map((c) => c.slug).join(', ')}</p></div>
            <div><label className={labelCls} htmlFor="weight">Verified packed weight (grams, optional)</label><input id="weight" type="number" min="1" name="weight_grams" defaultValue={p.weight_grams ?? ''} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="st">SEO title</label><input id="st" name="seo_title" defaultValue={p.seo_title ?? ''} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="sd">SEO description</label><input id="sd" name="seo_description" defaultValue={p.seo_description ?? ''} className={inputCls} /></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 text-sm">{([['is_active', 'Visible on the store', p.is_active], ['is_made_to_order', 'Made to order', p.is_made_to_order], ['is_featured', 'Featured product', p.is_featured], ['is_seasonal', 'Seasonal', p.is_seasonal]] as const).map(([k, l, v]) => (<label key={k} className="flex min-h-11 items-center gap-2"><input type="checkbox" name={k} defaultChecked={v} className="size-5 accent-ink" />{l}</label>))}</div>
        </ActionForm></Card>

        <Card title="Photos"><ImageManager productId={p.id} initial={p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, view: i.view }))} /></Card>

        <Card title={`Variants (${p.variants.length})`}>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><caption className="sr-only">Variants and stock</caption>
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th scope="col" className="py-2">Variant</th><th scope="col">Stock</th><th scope="col">Adjust stock (needs a reason)</th><th scope="col">Price / visible</th></tr></thead>
            <tbody className="divide-y divide-line align-top">{p.variants.map((v) => (
              <tr key={v.id} className={v.is_active ? '' : 'opacity-50'}>
                <td className="py-2 pr-2"><p className="font-semibold">{[v.colour, v.size, v.option].filter(Boolean).join(' · ') || 'Default'}</p><p className="text-xs text-muted">{v.sku}</p></td>
                <td className="pr-2">{v.stock_qty === null ? <span className="text-muted">Made to order</span> : <><strong>{v.stock_qty}</strong>{v.reserved_qty > 0 && <span className="text-muted"> ({v.reserved_qty} held)</span>}</>}</td>
                <td className="pr-2">{v.stock_qty === null ? '—' : (
                  <ActionForm action={adjustStockAction} hideSubmit className="flex flex-wrap items-start gap-1"><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="variantId" value={v.id} />
                    <label className="sr-only" htmlFor={`d-${v.id}`}>Change for {v.sku}</label><input id={`d-${v.id}`} name="delta" type="number" placeholder="+5 / -2" className={`${inputCls} w-24`} />
                    <label className="sr-only" htmlFor={`r-${v.id}`}>Reason for {v.sku}</label><input id={`r-${v.id}`} name="reason" placeholder="Reason" className={`${inputCls} w-40`} /><button className="min-h-11 rounded-btn bg-ink px-3 text-sm font-semibold text-paper">Adjust</button></ActionForm>)}</td>
                <td>
                  <ActionForm action={saveVariantAction} hideSubmit className="flex flex-wrap items-center gap-1"><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="id" value={v.id} />
                    <label className="sr-only" htmlFor={`p-${v.id}`}>Price override for {v.sku}</label><input id={`p-${v.id}`} name="price" defaultValue={naira(v.price_kobo)} placeholder="Base price" inputMode="decimal" className={`${inputCls} w-28`} />
                    <label className="flex min-h-11 items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-5 accent-ink" />Live</label><button className="min-h-11 rounded-btn border-2 border-ink px-3 text-sm font-semibold">Save</button></ActionForm></td>
              </tr>))}</tbody></table></div>
          <p className="mt-3 text-sm text-muted">Every stock change is logged with who made it and why.</p>
        </Card>

        <Card title="Add colours, sizes or options in bulk">
          <ActionForm action={generateVariantsAction} submitLabel="Create combinations" pendingLabel="Creating…"><input type="hidden" name="productId" value={p.id} />
            <div className="grid gap-3 sm:grid-cols-4">
              <div><label className={labelCls} htmlFor="g1">Colours</label><input id="g1" name="colours" placeholder="Black, Sand, Navy" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="g2">Sizes</label><input id="g2" name="sizes" placeholder="S, M, L, XL" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="g3">Options (scent, style…)</label><input id="g3" name="options" placeholder="Cross, Dove" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="g4">Starting stock (blank = made to order)</label><input id="g4" name="stock_qty" type="number" min={0} className={inputCls} /></div></div>
            <p className="mt-2 text-sm text-muted">Creates every colour × size × option combination that does not exist yet. Existing variants are never changed.</p></ActionForm>
        </Card>
      </div>
    </>
  );
}
