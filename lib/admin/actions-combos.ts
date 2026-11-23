'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { configIssues } from '@/lib/combos/pricing';
import { componentSaveSchema, comboSaveSchema, costsSchema } from '@/lib/combos/admin-schema';
import { ComboSettingsSchema } from '@/lib/combos/schema';
import type { ComboConfig } from '@/lib/combos/types';
import { adm, requireAdmin, requirePerm } from './db';
import { run, str } from './actions-core';
import type { AdminResult } from './types';

const ok = (message: string): AdminResult => ({ ok: true, message });
const fail = (message: string): AdminResult => ({ ok: false, message });
const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const refresh = () => { revalidateTag('combos'); revalidatePath('/admin/combos', 'layout'); revalidatePath('/combos', 'layout'); revalidatePath('/', 'layout'); };
const zmsg = (e: z.ZodError) => { const i = e.issues[0]!; return i.message && !/^Invalid|expected/i.test(i.message) ? i.message : `Please check "${i.path.join(' > ')}": ${i.message}`; };
const json = (fd: FormData, k = 'payload'): unknown => { try { return JSON.parse(String(fd.get(k) ?? '')); } catch { return undefined; } };

/** Save the whole working draft of a collection: details, package contents and prices. Nothing becomes public until Publish. */
export async function saveComboAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  let go: string | null = null;
  const r = await run('/admin/combos', async () => {
    const parsed = comboSaveSchema.safeParse(json(fd));
    if (!parsed.success) return fail(zmsg(parsed.error));
    const v = parsed.data;
    const saved = await adm<{ id: string }>('admin_combo_save', me, { id: v.id ?? null, collection: v.collection, slots: v.slots, rules: v.rules });
    refresh();
    if (!v.id) go = `/admin/combos/${saved.id}`;
    return ok('Draft saved. Customers will not see these changes until you publish.');
  });
  if (go && r?.ok) redirect(go);
  return r;
}

/** Publish: blocked when the draft has ERRORS (warnings, like a missing price, are allowed: customers then see "Price currently unavailable"). */
export async function publishComboAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  return run('/admin/combos', async () => {
    const id = uuid.parse(str(fd, 'id'));
    const got = await adm<{ config: ComboConfig }>('admin_combo_get', me, { id });
    const errors = configIssues(got.config).filter((i) => i.level === 'error');
    if (errors.length) return fail(`Fix this before publishing: ${errors[0]!.message}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ''}`);
    await adm('admin_combo_publish', me, { id });
    refresh();
    return ok('Published. Customers can now see and buy this combo (where a price is set).');
  });
}

export async function setComboStatusAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  return run('/admin/combos', async () => {
    const status = z.enum(['draft', 'archived']).parse(str(fd, 'status'));
    await adm('admin_combo_set_status', me, { id: uuid.parse(str(fd, 'id')), status });
    refresh();
    return ok(status === 'draft' ? 'Unpublished. It is no longer visible or purchasable.' : 'Archived.');
  });
}

export async function duplicateComboAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  let go: string | null = null;
  const r = await run('/admin/combos', async () => { const d = await adm<{ id: string }>('admin_combo_duplicate', me, { id: uuid.parse(str(fd, 'id')) }); refresh(); go = `/admin/combos/${d.id}`; return ok('Duplicated as a draft.'); });
  if (go && r?.ok) redirect(go);
  return r;
}

/** Creates the couples edition (two garments, everything else the same) of a collection, as a draft with no selling price. */
export async function makeCouplesAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  let go: string | null = null;
  const r = await run('/admin/combos', async () => { const d = await adm<{ id: string }>('admin_combo_make_couples', me, { id: uuid.parse(str(fd, 'id')) }); refresh(); go = `/admin/combos/${d.id}`; return ok('Couples edition ready as a draft. Set its price, then publish.'); });
  if (go && r?.ok) redirect(go);
  return r;
}

export async function moveComboAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  return run('/admin/combos', async () => {
    const ids = (JSON.parse(str(fd, 'ids') || '[]') as unknown[]).map((x) => uuid.parse(x));
    await adm('admin_combo_reorder', me, { ids }); refresh(); return ok('Order saved.');
  });
}

export async function deleteComboAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos');
  let done = false;
  const r = await run('/admin/combos', async () => {
    if (str(fd, 'confirm') !== 'yes') return fail('Tick the box to confirm.');
    await adm('admin_combo_delete', me, { id: uuid.parse(str(fd, 'id')) }); refresh(); done = true; return ok('Deleted.');
  });
  if (done && r?.ok) redirect('/admin/combos');
  return r;
}

/** Overhead costs per package. Owners only (also enforced in the database). */
export async function saveComboCostsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin('/admin/combos');
  return run('/admin/combos', async () => {
    const parsed = costsSchema.safeParse(json(fd));
    if (!parsed.success) return fail('Enter each cost as a Naira amount, like 5000.');
    await adm('admin_combo_costs_save', me, { id: uuid.parse(str(fd, 'id')), costs: parsed.data });
    revalidatePath('/admin/combos', 'layout');
    return ok('Costs saved. They are private and never shown to customers.');
  });
}

// ------------------------------------------------------------------ component library
export async function saveComponentAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos/library');
  return run('/admin/combos/library', async () => {
    const parsed = componentSaveSchema.safeParse(json(fd));
    if (!parsed.success) return fail(zmsg(parsed.error));
    await adm('admin_component_save', me, { component: parsed.data.component, options: parsed.data.options });
    refresh();
    return ok('Saved. Customers see changes to published combos straight away for availability, and after you publish for everything else.');
  });
}

export async function archiveComponentAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos/library');
  return run('/admin/combos/library', async () => {
    const archive = str(fd, 'archive') !== 'false';
    await adm('admin_component_archive', me, { id: uuid.parse(str(fd, 'id')), archive }); refresh();
    return ok(archive ? 'Archived. It is hidden from new orders immediately; existing orders are unchanged.' : 'Restored.');
  });
}

export async function deleteComponentAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue', '/admin/combos/library');
  return run('/admin/combos/library', async () => {
    if (str(fd, 'confirm') !== 'yes') return fail('Tick the box to confirm.');
    await adm('admin_component_delete', me, { id: uuid.parse(str(fd, 'id')) }); refresh(); return ok('Deleted.');
  });
}

// ------------------------------------------------------------------ storefront copy
export async function saveComboSettingsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('content', '/admin/combos/storefront');
  return run('/admin/combos/storefront', async () => {
    const parsed = ComboSettingsSchema.safeParse(json(fd));
    if (!parsed.success) return fail(zmsg(parsed.error));
    await adm('admin_combo_settings_save', me, { settings: parsed.data }); refresh();
    return ok('Saved. The homepage and combo pages update within about a minute.');
  });
}
