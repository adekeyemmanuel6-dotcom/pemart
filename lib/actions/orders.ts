'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { publicEnv } from '@/lib/env';
import { fetchOrder } from '@/lib/checkout/service';
import { respondToProof, resumePayment, submitReview, trackOrder } from '@/lib/orders/service';
import { rateLimit } from '@/lib/rate-limit';
import { normaliseNigerianPhone } from '@/lib/validators/phone';

const ip = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

// ------------------------------------------------------------------ track an order (no login)
export type TrackState = { message: string; number?: string; contact?: string } | null;
export async function trackOrderAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const number = String(fd.get('number') ?? '').trim().toUpperCase().replace(/^PM(?=\d)/, 'PM-');
  const contact = String(fd.get('contact') ?? '').trim();
  const echo = { number, contact };
  // Brute-force guard: lookups need a valid number AND the matching email/phone, and are rate limited per visitor.
  if (!rateLimit(`track:${await ip()}`, 10, 10 * 60_000).ok) return { message: 'Too many attempts. Please wait a few minutes and try again.', ...echo };
  if (!/^PM-\d{4,8}$/.test(number) || contact.length < 5) return { message: 'Enter your order number (like PM-10001) and the email or phone you ordered with.', ...echo };
  const isEmail = contact.includes('@');
  const normalised = isEmail ? contact.toLowerCase() : normaliseNigerianPhone(contact);
  if (!normalised) return { message: 'Enter the email address or Nigerian phone number you used for the order.', ...echo };
  const token = await trackOrder(number, normalised);
  // One generic message for "no such order" and "wrong contact", so nobody can probe which order numbers exist.
  if (!token) return { message: "We couldn't find an order with those details. Check the number and the email or phone you used.", ...echo };
  redirect(`/order/${number}?t=${token}`);
}

// ------------------------------------------------------------------ proofs
export type ProofResult = { ok: boolean; message: string; paidRevision?: boolean } | null;
const proofSchema = z.object({ number: z.string().regex(/^PM-\d+$/), token: z.string().max(80).optional(), customRequestId: z.uuid(), decision: z.enum(['approve', 'revise']), note: z.string().trim().max(1000).optional() });

export async function respondToProofAction(_prev: ProofResult, fd: FormData): Promise<ProofResult> {
  if (!rateLimit(`proof:${await ip()}`, 30, 10 * 60_000).ok) return { ok: false, message: 'Too many attempts. Please wait a moment.' };
  const parsed = proofSchema.safeParse({ number: fd.get('number'), token: fd.get('token') || undefined, customRequestId: fd.get('customRequestId'), decision: fd.get('decision'), note: fd.get('note') || undefined });
  if (!parsed.success) return { ok: false, message: 'Something went wrong. Please refresh and try again.' };
  const profile = await getProfile();
  const r = await respondToProof({ customRequestId: parsed.data.customRequestId, decision: parsed.data.decision, note: parsed.data.note, token: parsed.data.token, profileId: profile?.id });
  revalidatePath(`/order/${parsed.data.number}`);
  if (r.ok) return { ok: true, message: parsed.data.decision === 'approve' ? (r.productionStarted ? 'Approved. Your 5-day delivery clock has started.' : 'Approved. We will start once your other designs are approved too.') : "Thanks. We'll send a new proof soon." };
  const m: Record<string, string> = {
    paid_revision_required: 'You have used your free revision. You can buy an extra revision below.', note_required: 'Please tell us what to change.',
    no_proof_waiting: 'There is no proof waiting for a response.', not_allowed: 'You are not allowed to respond to this proof.',
  };
  return { ok: false, message: m[r.error] ?? 'We could not save that. Please try again.', paidRevision: r.error === 'paid_revision_required' };
}

// ------------------------------------------------------------------ resume payment for an unpaid order
export async function resumePaymentAction(number: string, token: string) {
  if (!rateLimit(`resume:${await ip()}`, 10, 10 * 60_000).ok) return { ok: false as const, message: 'Too many attempts. Please wait a few minutes.' };
  if (!/^PM-\d+$/.test(number)) return { ok: false as const, message: 'Invalid order.' };
  return resumePayment({ number, token });
}

// ------------------------------------------------------------------ reviews
export type ReviewState = { ok: boolean; message: string } | null;
const reviewSchema = z.object({ number: z.string().regex(/^PM-\d+$/), token: z.string().max(80).optional(), orderItemId: z.uuid(), rating: z.coerce.number().int().min(1).max(5), text: z.string().trim().max(1500).optional(), displayName: z.string().trim().max(60).optional(), photoPaths: z.array(z.string().regex(/^(guest\/[0-9a-f-]{36}\/[\w.-]+|demo\/.+)$/)).max(3) });

export async function submitReviewAction(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  if (!rateLimit(`review:${await ip()}`, 10, 30 * 60_000).ok) return { ok: false, message: 'Too many attempts. Please try again later.' };
  let photoPaths: string[] = [];
  try { photoPaths = JSON.parse(String(fd.get('photoPaths') ?? '[]')); } catch { /* empty */ }
  const parsed = reviewSchema.safeParse({ number: fd.get('number'), token: fd.get('token') || undefined, orderItemId: fd.get('orderItemId'), rating: fd.get('rating'), text: fd.get('text') || undefined, displayName: fd.get('displayName') || undefined, photoPaths });
  if (!parsed.success) return { ok: false, message: 'Please choose a star rating (and check your photos).' };
  const v = parsed.data;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const photoUrls = v.photoPaths.map((p) => (p.startsWith('demo/') || !base ? '/placeholders/review-demo.svg' : `${base}/storage/v1/object/public/review-photos/${p}`));
  const profile = await getProfile();
  const r = await submitReview({ number: v.number, orderItemId: v.orderItemId, rating: v.rating, text: v.text, displayName: v.displayName, photoUrls, token: v.token, profileId: profile?.id });
  revalidatePath(`/order/${v.number}/review`);
  if (r.ok) return { ok: true, message: photoUrls.length ? 'Thank you! Once we approve your photo review, your store credit will be added.' : 'Thank you! Your review will appear once we approve it.' };
  const m: Record<string, string> = { already_reviewed: 'You have already reviewed this item.', not_delivered: 'You can review once your order is delivered.', not_allowed: 'We could not verify this order.', not_reviewable: 'This item cannot be reviewed.' };
  return { ok: false, message: m[r.error] ?? 'We could not save your review. Please try again.' };
}

export async function orderForPage(number: string, token?: string) {
  const profile = await getProfile();
  return fetchOrder({ number, token, profileId: profile?.id });
}
