'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { AdminError, adm, isMissingFunction, requireAdmin, requirePerm } from './db';
import { run } from './actions-core';
import { PERMISSIONS, PRESETS, type Permission } from './permissions';
import type { AdminResult } from './types';

const ROLE_ERR: Record<string, string> = {
  account_not_found: 'No account uses that email. Ask them to create an account on the website first, then try again.',
  cannot_change_own_role: 'You cannot change your own access. Ask another admin.',
  last_admin: 'The store must keep at least one admin.',
  invalid_role: 'Choose a role.',
  not_staff: 'Permissions only apply to Staff accounts.',
  permission_required: 'Tick at least one area, or remove their access instead.',
  invalid_permission: 'Unknown permission.',
};
const roleSchema = z.object({ email: z.email('Enter a valid email address').max(254), role: z.enum(['customer', 'staff', 'admin']) });
const NEEDS_0019 = 'Detailed roles need the database update supabase/migrations/0019_staff_permissions.sql. Until then Staff have the standard staff access.';

/** Role from the form: a preset (store_manager, content_editor, …) means Staff with that preset's permissions. */
function permsFrom(fd: FormData): { preset: string | null; permissions: Permission[] } {
  const preset = String(fd.get('preset') ?? '');
  const p = PRESETS.find((x) => x.id === preset);
  if (p) return { preset: p.id, permissions: p.permissions };
  const ticked = fd.getAll('perm').map(String).filter((x): x is Permission => (PERMISSIONS as readonly string[]).includes(x));
  return { preset: null, permissions: ticked };
}

/** Grant or remove admin/staff access. The database re-checks the caller, locks out self-changes and keeps one admin. */
export async function setRoleAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin('/admin/team');
  const raw = String(fd.get('role') ?? '');
  const preset = PRESETS.find((x) => x.id === raw);
  const parsed = roleSchema.safeParse({ email: String(fd.get('email') ?? '').trim(), role: preset ? 'staff' : raw });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  return run('/admin/team', async () => {
    try {
      const r = await adm<{ id: string; role: string; previous: string }>('admin_set_role', me, parsed.data);
      let label = { customer: 'no admin access', staff: 'Staff', admin: 'Admin (owner)' }[r.role] ?? r.role;
      if (preset) {
        try {
          await adm('admin_set_permissions', me, { id: r.id, permissions: preset.permissions, preset: preset.id });
          label = preset.label;
        } catch (e) {
          if (isMissingFunction(e)) return { ok: true, message: `${parsed.data.email} now has Staff access. ${NEEDS_0019}` };
          throw e;
        }
      }
      return { ok: true, message: `${parsed.data.email} is now ${label}. They will be asked to set up two-factor sign-in on their next admin visit.` };
    } catch (e) {
      if (e instanceof AdminError && ROLE_ERR[e.code]) return { ok: false, message: ROLE_ERR[e.code]! };
      throw e;
    }
  });
}

/** Republish an earlier website version as a new version (history is never rewritten). */
export async function restoreWebsiteAction(id: number, revision: number): Promise<{ ok: boolean; message: string; revision?: number }> {
  const me = await requirePerm('content', '/admin/website');
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(revision) || revision < 0) return { ok: false, message: 'Reload the editor and try again.' };
  try {
    const r = await adm<{ revision: number }>('admin_website_restore', me, { id, revision });
    revalidateTag('settings');
    revalidatePath('/', 'layout');
    return { ok: true, message: 'That version is live again. The editor will reload with it.', revision: r.revision };
  } catch (e) {
    if (typeof e === 'object' && e && 'digest' in e) throw e;
    const code = e instanceof AdminError ? e.code : '';
    return {
      ok: false,
      message: code === 'website_conflict' ? 'Someone published in the meantime. Reload the editor, then restore again.'
        : code === 'revision_not_found' ? 'That version no longer exists.' : 'The version could not be restored. Please try again.',
    };
  }
}

/** Change what a Staff member can do (a preset or a custom set). Enforced again in every database function. */
export async function setPermissionsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin('/admin/team');
  const id = z.uuid().safeParse(String(fd.get('id') ?? ''));
  if (!id.success) return { ok: false, message: 'Reload the page and try again.' };
  const { preset, permissions } = permsFrom(fd);
  if (permissions.length === 0) return { ok: false, message: ROLE_ERR.permission_required! };
  return run('/admin/team', async () => {
    try {
      await adm('admin_set_permissions', me, { id: id.data, permissions, preset });
      return { ok: true, message: 'Saved. The change applies on their next page load.' };
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0019 };
      if (e instanceof AdminError && ROLE_ERR[e.code]) return { ok: false, message: ROLE_ERR[e.code]! };
      throw e;
    }
  });
}
