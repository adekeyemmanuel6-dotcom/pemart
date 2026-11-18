import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { ComboEditor } from '@/components/admin/combo-editor';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card, PageTitle } from '@/components/admin/ui';
import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import { deleteComboAction } from '@/lib/admin/actions-combos';
import type { CollectionRow, LibraryItem, RuleRow, SlotRow } from '@/lib/combos/build';
import type { ComboOverheads } from '@/lib/combos/types';

export const metadata: Metadata = { title: 'Edit combo' };
type Got = { collection: Record<string, unknown> & { slug: string; name: string; status: 'draft' | 'published' | 'archived' }; has_unpublished_changes: boolean; slots: Record<string, unknown>[]; rules: Record<string, unknown>[]; config: { overheads?: ComboOverheads }; is_owner: boolean; orders: number };
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (v == null ? null : Number(v));

export default async function ComboEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePerm('catalogue', `/admin/combos/${id}`);
  const isNew = id === 'new';
  let got: Got | null = null, library: LibraryItem[], bundles: { id: string; name: string }[];
  try {
    [got, library, bundles] = await Promise.all([
      isNew ? null : adm<Got | null>('admin_combo_get', me, { id }),
      adm<LibraryItem[]>('admin_components_list', me),
      adm<{ bundles: { id: string; name: string }[] }>('admin_catalogue_list', me).then((c) => c.bundles),
    ]);
  } catch (e) { if (isMissingFunction(e)) return (<><PageTitle title="Combo Management" /><NeedsMigration migration="0024_combos.sql" what="Combo Management" /></>); throw e; }
  if (!isNew && !got) notFound();

  const c = got?.collection;
  const collection: CollectionRow = {
    slug: s(c?.slug), name: s(c?.name), label: s(c?.label), tagline: s(c?.tagline), scripture_ref: s(c?.scripture_ref), scripture_text: s(c?.scripture_text),
    description: s(c?.description), image_url: s(c?.image_url), legacy_bundle_id: (c?.legacy_bundle_id as string | null) ?? null, sort_order: Number(c?.sort_order ?? 0), base_price_kobo: n(c?.base_price_kobo),
  };
  const slots: SlotRow[] = (got?.slots ?? []).map((r) => ({
    id: s(r.id), kind: r.kind as SlotRow['kind'], label: s(r.label), component_id: (r.component_id as string | null) ?? null, allowed_component_ids: (r.allowed_component_ids as string[] | null) ?? [],
    quantity: Number(r.quantity ?? 1), mode: r.mode as SlotRow['mode'], min_qty: Number(r.min_qty ?? 0), max_qty: Number(r.max_qty ?? 1), same_size_only: !!r.same_size_only, customise: !!r.customise, extra_price_kobo: n(r.extra_price_kobo),
  }));
  const rules: RuleRow[] = (got?.rules ?? []).map((r) => ({
    id: s(r.id), kind: r.kind as RuleRow['kind'], component_id: (r.component_id as string | null) ?? null, option_id: (r.option_id as string | null) ?? null, frame_signature: (r.frame_signature as string | null) ?? null,
    amount_kobo: n(r.amount_kobo), discount_type: (r.discount_type as RuleRow['discount_type']) ?? null, discount_value: n(r.discount_value), label: (r.label as string | null) ?? null,
    starts_at: (r.starts_at as string | null) ?? null, ends_at: (r.ends_at as string | null) ?? null, is_active: r.is_active !== false,
  }));
  // A new combo starts from a sensible shape: one garment choice plus one frame, so the editor is never empty.
  const starter: SlotRow[] = isNew ? [{ id: crypto.randomUUID(), kind: 'garment', label: 'Customised garment', component_id: null, allowed_component_ids: library.filter((l) => l.kind === 'garment' && l.is_active && !l.archived_at).map((l) => l.id), quantity: 1, mode: 'required', min_qty: 0, max_qty: 1, same_size_only: false, customise: true, extra_price_kobo: null }] : slots;
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href="/admin/combos" className="underline underline-offset-4">← Combo Management</Link></p><h1 className="display text-4xl sm:text-5xl">{got ? s(c?.name) : 'New combo'}</h1></div>
      <ComboEditor key={id} id={isNew ? null : id} initial={{ collection, slots: starter, rules, overheads: got?.config.overheads }} library={library} bundles={bundles}
        status={got?.collection.status ?? 'draft'} hasUnpublishedChanges={got?.has_unpublished_changes ?? false} isOwner={got?.is_owner ?? me.role === 'admin'} orders={got?.orders ?? 0} />
      {got && (
        <Card title="Delete this combo" className="mt-8">
          <p className="mb-2 text-sm text-muted">{got.orders > 0 ? 'This combo has been ordered, so it cannot be deleted. Archive it instead; past orders keep every detail.' : 'Only combos that have never been ordered can be deleted.'}</p>
          {got.orders === 0 && (<ActionForm action={deleteComboAction} submitLabel="Delete combo" variant="danger" confirm="Delete this combo permanently?"><input type="hidden" name="id" value={id} />
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-5 accent-ink" />Yes, delete it</label></ActionForm>)}
        </Card>
      )}
    </>
  );
}
