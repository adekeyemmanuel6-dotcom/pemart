'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { safeNext } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { ok: boolean; message: string; email?: string } | null;

const emailSchema = z.object({ email: z.email('Enter a valid email address').max(254) });

async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

const callbackUrl = (next: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

/** Password-free sign-in: emails a magic link. Rate limited per IP and per address. */
export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { ok: false, email: String(formData.get('email') ?? ''), message: 'Sign-in is not connected yet.' };
  const parsed = emailSchema.safeParse({ email: String(formData.get('email') ?? '').trim().toLowerCase() });
  if (!parsed.success) return { ok: false, email: String(formData.get('email') ?? ''), message: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };

  const ip = await clientIp();
  if (!rateLimit(`auth-ip:${ip}`, 10, 10 * 60_000).ok || !rateLimit(`auth-email:${parsed.data.email}`, 3, 10 * 60_000).ok) {
    return { ok: false, email: String(formData.get('email') ?? ''), message: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
  });
  if (error) return { ok: false, email: String(formData.get('email') ?? ''), message: 'We could not send the link. Please try again.' };
  return { ok: true, message: 'Check your email. We sent you a sign-in link.' };
}

export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/auth/sign-in?error=not-configured');
  if (!rateLimit(`auth-ip:${await clientIp()}`, 10, 10 * 60_000).ok) redirect('/auth/sign-in?error=rate');
  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl(next) } });
  if (error || !data.url) redirect('/auth/sign-in?error=oauth');
  redirect(data.url);
}

/** Email + password sign-in. Accounts are created by you in Supabase (Authentication > Users > Add user) or via the reset flow. */
export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!isSupabaseConfigured) return { ok: false, email, message: 'Sign-in is not connected yet.' };
  const parsed = emailSchema.safeParse({ email });
  const password = String(formData.get('password') ?? '');
  if (!parsed.success || !password) return { ok: false, email, message: 'Enter your email and password.' };
  if (!rateLimit(`auth-pw-ip:${await clientIp()}`, 10, 10 * 60_000).ok || !rateLimit(`auth-pw-email:${email}`, 6, 10 * 60_000).ok) {
    return { ok: false, email, message: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, email, message: 'That email and password do not match.' };
  redirect(safeNext(String(formData.get('next') ?? '')));
}
