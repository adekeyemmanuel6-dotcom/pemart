'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

export type NewsletterState = { ok: boolean; message: string } | null;

const schema = z.object({ email: z.email('Enter a valid email address').max(254) });

/** Footer sign-up. Records the email with a consent timestamp (subscribers.consent_at). */
export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`newsletter:${ip}`, 5, 10 * 60_000);
  if (!limit.ok) return { ok: false, message: 'Too many attempts. Please try again in a few minutes.' };

  const parsed = schema.safeParse({ email: String(formData.get('email') ?? '').trim().toLowerCase() });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, message: 'Sign-ups open very soon. Please check back.' };

  const { error } = await createAdminClient().from('subscribers').insert({ email: parsed.data.email, source: 'footer' });
  if (error && error.code !== '23505') return { ok: false, message: 'Something went wrong. Please try again.' };
  return { ok: true, message: "You're on the list. Thank you!" };
}
