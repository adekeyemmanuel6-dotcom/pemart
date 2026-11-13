'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { imageHref } from '@/lib/website/schema';
import { dbMode } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/log';
import { AdminError, adm, isMissingFunction, requirePerm } from './db';

export type MediaItem = {
  id: string; url: string; filename: string; alt: string; mime: string | null; size_bytes: number | null; created_at: string;
  uploaded_by: string | null; used: { type: string; label: string; href: string }[] | null;
};
export type MediaPage = { total: number; items: MediaItem[] } | { missing: true };

const NEEDS_0020 = 'The media library needs the database update supabase/migrations/0020_media_library.sql.';
const perm = ['content', 'catalogue'] as const;

export async function listMedia(q = '', offset = 0, withUsage = true): Promise<MediaPage> {
  const me = await requirePerm([...perm], '/admin/media');
  try {
    return await adm<{ total: number; items: MediaItem[] }>('admin_media_list', me, { q: q.slice(0, 80), offset: Math.max(0, offset | 0), limit: 48, with_usage: withUsage });
  } catch (e) {
    if (isMissingFunction(e)) return { missing: true };
    throw e;
  }
}

/** Called by the uploader after a successful upload. Best effort: an upload never fails because of the library. */
export async function registerMedia(input: { url: string; path: string; filename: string; size: number; mime: string }): Promise<void> {
  const me = await requirePerm([...perm]);
  const ok = z.object({ url: imageHref, path: z.string().max(300), filename: z.string().max(200), size: z.number().int().nonnegative(), mime: z.string().max(80) }).safeParse(input);
  if (!ok.success) return;
  try { await adm('admin_media_register', me, ok.data); } catch (e) { if (!isMissingFunction(e)) logEvent('media.register_failed', { error: (e as Error).message }); }
}

export async function updateMediaAlt(id: string, alt: string): Promise<{ ok: boolean; message: string }> {
  const me = await requirePerm([...perm], '/admin/media');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Reload and try again.' };
  try {
    await adm('admin_media_update', me, { id, alt: alt.trim().slice(0, 300) });
    revalidatePath('/admin/media');
    return { ok: true, message: 'Description saved.' };
  } catch (e) {
    if (isMissingFunction(e)) return { ok: false, message: NEEDS_0020 };
    return { ok: false, message: 'Could not save the description.' };
  }
}

/** Delete an unused image (the database refuses images still in use) and its file in storage. */
export async function deleteMedia(id: string): Promise<{ ok: boolean; message: string }> {
  const me = await requirePerm([...perm], '/admin/media');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Reload and try again.' };
  try {
    const r = await adm<{ ok: boolean; error?: string; used?: { label: string }[]; path?: string | null }>('admin_media_delete', me, { id });
    if (!r.ok) return { ok: false, message: `Still in use: ${(r.used ?? []).map((u) => u.label).join(', ')}. Replace it there first.` };
    if (r.path && dbMode() === 'supabase') {
      const { error } = await createAdminClient().storage.from('product-images').remove([r.path]);
      if (error) logEvent('media.storage_delete_failed', { path: r.path, error: error.message });
    }
    revalidatePath('/admin/media');
    return { ok: true, message: 'Image deleted.' };
  } catch (e) {
    if (isMissingFunction(e)) return { ok: false, message: NEEDS_0020 };
    if (e instanceof AdminError && e.code === 'not_found') return { ok: false, message: 'That image was already deleted.' };
    return { ok: false, message: 'Could not delete the image.' };
  }
}
