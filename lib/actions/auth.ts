'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { safeNext } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { ok: boolean; message: string; email?: string; name?: string } | null;

const emailSchema = z.object({ email: z.email('Enter a valid email address').max(254) });


const callbackUrl = (next: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/auth/sign-in?error=not-configured');
  if (!(await rateLimit(`auth-ip:${await clientIp()}`, 10, 10 * 60_000)).ok) redirect('/auth/sign-in?error=rate');
  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl(next) } });
  if (error || !data.url) redirect('/auth/sign-in?error=oauth');
  redirect(data.url);
}

/** Email + password sign-in. */
export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!isSupabaseConfigured) return { ok: false, email, message: 'Sign-in is not connected yet.' };
  const parsed = emailSchema.safeParse({ email });
  const password = String(formData.get('password') ?? '');
  if (!parsed.success || !password) return { ok: false, email, message: 'Enter your email and password.' };
  if (!(await rateLimit(`auth-pw-ip:${await clientIp()}`, 10, 10 * 60_000)).ok || !(await rateLimit(`auth-pw-email:${email}`, 6, 10 * 60_000)).ok) {
    return { ok: false, email, message: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, email, message: 'That email and password do not match.' };
  redirect(safeNext(String(formData.get('next') ?? '')));
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
});

/** Create an account with email + password. If the project requires email confirmation we say so; otherwise we sign straight in. */
export async function signUpWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { name: String(formData.get('name') ?? ''), email: String(formData.get('email') ?? '').trim().toLowerCase(), password: String(formData.get('password') ?? '') };
  if (!isSupabaseConfigured) return { ok: false, email: raw.email, name: raw.name, message: 'Sign-in is not connected yet.' };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, email: raw.email, name: raw.name, message: parsed.error.issues[0]?.message ?? 'Check your details.' };
  if (!(await rateLimit(`auth-up-ip:${await clientIp()}`, 8, 10 * 60_000)).ok) return { ok: false, email: raw.email, name: raw.name, message: 'Too many attempts. Please wait a few minutes and try again.' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { full_name: parsed.data.name }, emailRedirectTo: callbackUrl('/account') },
  });
  if (error) return { ok: false, email: raw.email, name: raw.name, message: /registered|exists/i.test(error.message) ? 'An account with this email already exists. Try signing in.' : 'We could not create your account. Please try again.' };
  if (data.session) redirect(safeNext(String(formData.get('next') ?? '')));
  return { ok: true, email: raw.email, message: 'Account created. Check your email to confirm it, then sign in.' };
}

/** "Forgot password": emails a reset link. Always answers the same way so it can't be used to find out who has an account. */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const generic: AuthState = { ok: true, email, message: 'If an account exists for that email, we have sent a link to reset the password.' };
  if (!isSupabaseConfigured) return { ok: false, email, message: 'Sign-in is not connected yet.' };
  if (!emailSchema.safeParse({ email }).success) return { ok: false, email, message: 'Enter a valid email address.' };
  if (!(await rateLimit(`auth-reset-ip:${await clientIp()}`, 6, 10 * 60_000)).ok || !(await rateLimit(`auth-reset:${email}`, 3, 10 * 60_000)).ok) {
    return { ok: false, email, message: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl('/auth/reset') });
  return generic;
}

/** Set a new password for the person who followed the reset link (they are signed in by the callback). */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { ok: false, message: 'Use at least 8 characters.' };
  if (password.length > 72) return { ok: false, message: 'Use 72 characters or fewer.' };
  if (password !== String(formData.get('confirm') ?? '')) return { ok: false, message: 'The two passwords do not match.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: 'That reset link has expired. Please request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: 'We could not update your password. Please try again.' };
  redirect('/account');
}
