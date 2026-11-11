import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { dbMode } from '@/lib/db';
import { devProfile } from '@/lib/dev-auth';

export type Role = 'customer' | 'staff' | 'admin';
export type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null; role: Role; store_credit_kobo: number };

/** The signed-in profile, or null for visitors (and when Supabase is not configured yet). */
export async function getProfile(): Promise<Profile | null> {
  if (dbMode() === 'pg') return devProfile();   // local Postgres dev mode only
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('profiles').select('id,email,full_name,phone,role,store_credit_kobo').eq('id', auth.user.id).single();
  return (data as Profile | null) ?? null;
}

export async function requireProfile(next = '/account'): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  return profile;
}

/** Server-side role gate. Call at the top of every admin page and server action. */
export async function requireRole(allowed: Role[], next = '/admin'): Promise<Profile> {
  const profile = await requireProfile(next);
  if (!allowed.includes(profile.role)) redirect('/?denied=1');
  return profile;
}

export const requireStaff = (next?: string) => requireRole(['staff', 'admin'], next);
export const requireAdmin = (next?: string) => requireRole(['admin'], next);

/** Only allow redirects to paths on this site. */
export const safeNext = (value: string | null | undefined, fallback = '/account') =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
