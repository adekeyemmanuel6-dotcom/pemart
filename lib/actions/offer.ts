'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getRpc } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { notifyWelcomeOffer } from '@/lib/notifications';

export type OfferState = { ok: boolean; message: string; email?: string; phone?: string; code?: string } | null;

const email = z.email('Enter a valid email address').max(254);
const phone = z.string().regex(/^(\+?234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number');
const fmt = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso)) : undefined);

/**
 * Newsletter sign-up and first-order popup share this. Records the contact with a consent timestamp
 * and issues (or re-shows) a single-use 10% code. The code is emailed when we have an email address.
 */
export async function claimFirstOrderOffer(source: 'popup' | 'footer', formData: FormData): Promise<OfferState> {
  const rawEmail = String(formData.get('email') ?? '').trim().toLowerCase();
  const rawPhone = String(formData.get('phone') ?? '').replace(/[\s-]/g, '');
  const echo = { email: rawEmail, phone: rawPhone };
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`offer:${ip}`, 5, 10 * 60_000).ok) return { ok: false, ...echo, message: 'Too many attempts. Please try again in a few minutes.' };

  if (!rawEmail && !rawPhone) return { ok: false, ...echo, message: 'Enter your email or phone number.' };
  if (rawEmail) { const r = email.safeParse(rawEmail); if (!r.success) return { ok: false, ...echo, message: r.error.issues[0]!.message }; }
  else { const r = phone.safeParse(rawPhone); if (!r.success) return { ok: false, ...echo, message: r.error.issues[0]!.message }; }

  const rpc = await getRpc();
  if (!rpc) return { ok: false, ...echo, message: 'Sign-ups open very soon. Please check back.' };
  const { data, error } = await rpc<{ code: string; is_new: boolean; expires_at: string | null; used: boolean }>('offer_claim', { email: rawEmail || null, phone: rawEmail ? null : rawPhone, source });
  if (error || !data) return { ok: false, ...echo, message: 'Something went wrong. Please try again.' };

  if (data.used) return { ok: true, ...echo, code: data.code, message: `Welcome back. Your code ${data.code} has already been used on an order.` };
  if (data.is_new && rawEmail) await notifyWelcomeOffer({ to: rawEmail, code: data.code, expires: fmt(data.expires_at) });
  return { ok: true, ...echo, code: data.code, message: rawEmail && data.is_new ? `Your code is ${data.code}. We have also emailed it to you.` : `Your code is ${data.code}.` };
}
