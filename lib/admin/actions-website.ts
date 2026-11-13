'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { websiteSchema } from '@/lib/website/schema';
import { adm, isMissingFunction, requireAdmin } from './db';

export async function publishWebsite(
  content: unknown,
  revision: number,
): Promise<{ ok: boolean; message: string; revision?: number }> {
  const me = await requireAdmin('/admin/website');
  const parsed = websiteSchema.safeParse(content);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .slice(0, 3)
        .join(' • '),
    };
  if (!Number.isSafeInteger(revision) || revision < 0)
    return { ok: false, message: 'Reload the editor before publishing.' };
  try {
    const result = await adm<{ revision: number }>('admin_website_save', me, { content: parsed.data, revision });
    revalidateTag('settings');
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message: 'Website published. Your changes are now live on the storefront.',
      revision: result.revision,
    };
  } catch (e) {
    if (typeof e === 'object' && e && 'digest' in e) throw e;
    const message = e instanceof Error ? e.message : '';
    if (isMissingFunction(e))
      return {
        ok: false,
        message:
          'Publishing is switched off until the database update 0014 has been applied (supabase/migrations/0014_wear_the_word.sql). Your changes are still in this editor.',
      };
    return {
      ok: false,
      message: message.includes('website_conflict')
        ? 'Someone published a newer version. Your edits are still here. Open the editor in a new tab to compare before reapplying them.'
        : 'Your changes could not be published. They are still in this editor. Please try again.',
    };
  }
}
