'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { AdminError, adm, requireAdmin } from './db';
import { run } from './actions-core';
import type { AdminResult } from './types';

const ROLE_ERR: Record<string, string> = {
  account_not_found: 'No account uses that email. Ask them to create an account on the website first, then try again.',
  cannot_change_own_role: 'You cannot change your own access. Ask another admin.',
  last_admin: 'The store must keep at least one admin.',
  invalid_role: 'Choose Staff, Admin or No access.',
};
const roleSchema = z.object({ email: z.email('Enter a valid email address').max(254), role: z.enum(['customer', 'staff', 'admin']) });

/** Grant or remove admin/staff access. The database re-checks the caller, locks out self-changes and keeps one admin. */
export async function setRoleAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin('/admin/team');
  const parsed = roleSchema.safeParse({ email: String(fd.get('email') ?? '').trim(), role: fd.get('role') });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  return run('/admin/team', async () => {
    try {
      const r = await adm<{ role: string; previous: string }>('admin_set_role', me, parsed.data);
      const label = { customer: 'no admin access', staff: 'Staff', admin: 'Admin' }[r.role] ?? r.role;
      return { ok: true, message: `${parsed.data.email} now has ${label}. They will be asked to set up two-factor sign-in on their next admin visit.` };
    } catch (e) {
      if (e instanceof AdminError && ROLE_ERR[e.code]) return { ok: false, message: ROLE_ERR[e.code]! };
      throw e;
    }
  });
}

/** Republish an earlier website version as a new version (history is never rewritten). */
export async function restoreWebsiteAction(id: number, revision: number): Promise<{ ok: boolean; message: string; revision?: number }> {
  const me = await requireAdmin('/admin/website');
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
