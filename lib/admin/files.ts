import 'server-only';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/** A 1-hour link for staff to open a customer's private upload. Local dev has no storage, so it returns null. */
export async function privateFileUrl(bucket: 'design-uploads' | 'bulk-uploads' | 'proofs', path: string): Promise<string | null> {
  if (path.startsWith('/')) return path;
  if (path.startsWith('demo/') || !isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
