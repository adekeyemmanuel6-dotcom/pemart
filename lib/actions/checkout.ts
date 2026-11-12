'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { NIGERIAN_STATES, normalizeDestination } from '@/lib/shipping';
import { createOrderAndInitPayment, publicQuote, quoteCart, type PublicQuote, type StartResult } from '@/lib/checkout/service';
import type { PricingInput } from '@/lib/checkout/types';
import { getProfile } from '@/lib/auth';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { normaliseNigerianPhone } from '@/lib/validators/phone';

const id = z.string().min(1).max(64);
const choice = z.object({ key: z.string().max(80), designSlug: z.string().max(80).optional(), colour: z.string().max(40).optional(), size: z.string().max(10).optional(), option: z.string().max(80).optional(), customText: z.string().max(60).optional() });
// Unknown keys (such as a price someone adds in dev tools) are stripped by zod before anything is priced.
const lineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('variant'), id, refId: id, quantity: z.number(), upsell: z.boolean().optional(), giftCard: z.object({ recipientEmail: z.string().max(254).optional(), message: z.string().max(300).optional() }).optional() }),
  z.object({ kind: z.literal('bundle'), id, refId: id, quantity: z.number(), selection: z.object({ bundleSlug: z.string().max(80), choices: z.array(choice).max(30), giftMessage: z.string().max(400).optional(), giftWrap: z.boolean().optional() }) }),
  z.object({ kind: z.literal('custom'), id, refId: id, quantity: z.number() }),
  z.object({ kind: z.literal('revision'), id, refId: id, quantity: z.number() }),
]);
const pricingSchema = z.object({
  lines: z.array(lineSchema).max(50), code: z.string().max(40).optional(), giftCode: z.string().max(40).optional(), useCredit: z.boolean().optional(),
  state: z.string().max(40).optional(), city: z.string().max(80).optional(), shippingRateId: z.uuid().optional(), acceptFinalSale: z.boolean().optional(), giftMessage: z.string().max(400).optional(),
  extras: z.object({ giftWrap: z.boolean().optional(), surpriseNote: z.boolean().optional(), express: z.boolean().optional(), shipReadyFirst: z.boolean().optional() }).optional(),
});

const ip = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

/** Price a bag for display (bag drawer, bag page, checkout summary). Never trusted for charging. */
export async function quoteBag(raw: unknown): Promise<{ ok: true; quote: PublicQuote } | { ok: false; message: string }> {
  if (!rateLimit(`quote:${await ip()}`, 120, 60_000).ok) return { ok: false, message: 'Too many requests. Please slow down.' };
  const parsed = pricingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Something is wrong with your bag. Please refresh.' };
  const profile = await getProfile();
  const quote = await quoteCart(parsed.data as PricingInput, { profileId: profile?.id, email: profile?.email });
  return { ok: true, quote: publicQuote(quote) };
}

const phone = z.string().trim().refine((v) => normaliseNigerianPhone(v) !== null, 'Enter a valid Nigerian phone number, e.g. 0803 123 4567').transform((v) => normaliseNigerianPhone(v)!);
const detailsSchema = z.object({
  email: z.email('Enter a valid email address').max(254).transform((v) => v.toLowerCase()), phone,
  isGift: z.boolean(), giftMessage: z.string().trim().max(300).optional(),
  address: z.object({ recipient: z.string().trim().min(2, 'Enter the recipient name').max(80), phone, line1: z.string().trim().min(4, 'Enter the street address').max(160), area: z.string().trim().max(80).optional(), city: z.string().trim().min(2, 'Enter the city or town').max(80), state: z.string().min(2, 'Choose a state'), instructions: z.string().trim().max(300).optional() }),
  createAccount: z.boolean().optional(),
});

export type StartCheckoutResult = Extract<StartResult, { ok: true }> | { ok: false; message: string; fieldErrors: Record<string, string>; issues?: string[] };

/** The real checkout. Re-validates and re-prices everything on the server, creates the order, starts payment. */
export async function startCheckout(rawPricing: unknown, rawDetails: unknown): Promise<StartCheckoutResult> {
  if (!rateLimit(`checkout:${await ip()}`, 15, 10 * 60_000).ok) return { ok: false, message: 'Too many attempts. Please wait a few minutes.', fieldErrors: {} };
  if ((await getSettings()).maintenance_mode) return { ok: false, message: 'We are making a few updates and are not taking orders right now. Please try again shortly.', fieldErrors: {} };
  const pricing = pricingSchema.safeParse(rawPricing);
  if (!pricing.success) return { ok: false, message: 'Something is wrong with your bag. Please refresh and try again.', fieldErrors: {} };
  const details = detailsSchema.safeParse(rawDetails);
  const fieldErrors: Record<string, string> = {};
  if (!details.success) for (const i of details.error.issues) fieldErrors[i.path.join('.')] ??= i.message;
  const state = details.success ? NIGERIAN_STATES.find((s) => normalizeDestination(s) === normalizeDestination(details.data.address.state)) ?? '' : '';
  if (details.success && !NIGERIAN_STATES.some((s) => normalizeDestination(s) === normalizeDestination(state))) fieldErrors['address.state'] = 'Choose a state from the list';
  if (Object.keys(fieldErrors).length) return { ok: false, message: 'Please check the highlighted fields.', fieldErrors };

  const d = details.data!;
  const profile = await getProfile();
  const result = await createOrderAndInitPayment({ ...(pricing.data as PricingInput), state, city: d.address.city }, { email: d.email, phone: d.phone, isGift: d.isGift, giftMessage: d.giftMessage || pricing.data.giftMessage, address: { ...d.address, state } }, { profileId: profile?.id, email: d.email });
  // Optional account: email a magic link so the buyer can follow the order from an account. Never blocks the order.
  if (result.ok && d.createAccount && !profile && isSupabaseConfigured) {
    try { await (await createClient()).auth.signInWithOtp({ email: d.email, options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent('/account')}`, shouldCreateUser: true } }); }
    catch { /* the order is already placed; ignore */ }
  }
  return result.ok ? result : { ...result, fieldErrors: {} };
}
