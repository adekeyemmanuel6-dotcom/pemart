import 'server-only';
import { cookies } from 'next/headers';
import { getRpc, dbMode } from '@/lib/db';
import type { Profile } from '@/lib/auth';

/**
 * DEVELOPMENT ONLY. When running against a plain local Postgres (DATABASE_URL, no Supabase) there is no
 * Supabase Auth, so /api/dev/login sets a cookie naming a profile. This lets the account area and the
 * staff/admin role gates be exercised locally. dbMode() is never 'pg' in production, so none of this runs there.
 */
export const DEV_COOKIE = 'pemart-dev-user';

export async function devProfile(): Promise<Profile | null> {
  if (dbMode() !== 'pg') return null;
  const id = (await cookies()).get(DEV_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rpc = await getRpc();
  const r = await rpc?.<Profile | null>('profile_get', { id });
  return r?.data ?? null;
}
