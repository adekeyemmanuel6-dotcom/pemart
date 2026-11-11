import 'server-only';
import { getRpc } from '@/lib/db';
import { publicEnv, isSupabaseConfigured } from '@/lib/env';
import { fetchOrder, type StartResult } from '@/lib/checkout/service';
import { logEvent } from '@/lib/log';
import { initializeTransaction, paystackConfigured, paystackMock, paystackPublicKey } from '@/lib/paystack';
import { getSettings } from '@/lib/settings';
import { notifyAbandoned, notifyAdmin, notifyOrderStatus, notifyProofApproved, notifyProofReady, notifyReviewRequest } from '@/lib/notifications';
import { staffUpdateLink } from '@/lib/notifications/whatsapp';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransition, NOTIFY_ON, type OrderStatus } from './status';

type Res = Record<string, unknown> & { ok?: boolean; error?: string };
const call = async <T extends Res>(fn: string, arg: Record<string, unknown>): Promise<T | null> => {
  const rpc = await getRpc();
  if (!rpc) return null;
  const r = await rpc<T>(fn, arg);
  if (r.error) { logEvent('rpc.error', { fn, error: r.error.message }); return null; }
  return r.data;
};

// ------------------------------------------------------------------ proofs
/** Staff: attach a proof to a custom request and email the customer. (Called by the admin screen in Phase 6.) */
export async function sendProof(a: { customRequestId: string; path: string; message?: string; actor?: string | null }) {
  const r = await call<Res & { version: number; number: string; token: string; email: string; phone: string }>(a.actor ? 'admin_proof_send' : 'proof_send', { custom_request_id: a.customRequestId, path: a.path, message: a.message ?? null, actor: a.actor ?? null });
  if (!r?.ok) return { ok: false as const, error: r?.error ?? 'db_error' };
  await notifyProofReady({ to: r.email, number: r.number, token: r.token, version: r.version, message: a.message });
  return { ok: true as const, version: r.version, whatsapp: staffUpdateLink(r.phone, r.number, 'proof sent') };
}

export type ProofDecision = { customRequestId: string; decision: 'approve' | 'revise'; note?: string; token?: string; profileId?: string | null };
/** Customer: approve a proof or ask for a revision. Approving the last design starts the 5-day clock. */
export async function respondToProof(a: ProofDecision) {
  const r = await call<Res & { order_status: string; number: string; token: string; email: string; promised_by: string | null; production_started: boolean }>('proof_respond',
    { custom_request_id: a.customRequestId, decision: a.decision, note: a.note ?? null, token: a.token ?? null, profile_id: a.profileId ?? null });
  if (!r) return { ok: false as const, error: 'db_error' };
  if (!r.ok) return { ok: false as const, error: r.error ?? 'failed' };
  if (a.decision === 'approve' && r.production_started) await notifyProofApproved({ to: r.email, number: r.number, token: r.token, promisedBy: r.promised_by });
  if (a.decision === 'revise') await notifyAdmin(`Revision requested on ${r.number}`, `Customer asked for changes on order ${r.number}:\n\n${a.note}`);
  return { ok: true as const, orderStatus: r.order_status, productionStarted: r.production_started, promisedBy: r.promised_by };
}

/** A URL the customer can open for a stored proof. Supabase: a 1-hour signed URL. Paths starting with "/" are served as-is (demo/dev). */
export async function proofUrl(path: string): Promise<string | null> {
  if (path.startsWith('/')) return path;
  if (isSupabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await createAdminClient().storage.from('proofs').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  return '/placeholders/tee.svg';
}

// ------------------------------------------------------------------ order status (production board, Phase 6)
export async function changeOrderStatus(a: { orderId: string; to: OrderStatus; note?: string; actor?: string | null }) {
  const r = await call<Res & { number: string; token: string; email: string; phone: string; status: string; promised_by: string | null; from?: string }>(a.actor ? 'admin_set_status' : 'order_set_status', { order_id: a.orderId, to: a.to, note: a.note ?? null, actor: a.actor ?? null });
  if (!r?.ok) return { ok: false as const, error: r?.error ?? 'db_error' };
  if (NOTIFY_ON.includes(a.to)) await notifyOrderStatus({ to: r.email, number: r.number, token: r.token, status: a.to, promisedBy: r.promised_by });
  return { ok: true as const, whatsapp: staffUpdateLink(r.phone, r.number, a.to, r.promised_by) };
}
export { canTransition };

// ------------------------------------------------------------------ reviews and credit
export async function submitReview(a: { number: string; orderItemId: string; rating: number; text?: string; displayName?: string; photoUrls: string[]; token?: string; profileId?: string | null }) {
  const r = await call<Res & { id: string }>('review_submit', { number: a.number, order_item_id: a.orderItemId, rating: a.rating, text: a.text ?? null, display_name: a.displayName ?? null, photo_urls: a.photoUrls.slice(0, 3), token: a.token ?? null, profile_id: a.profileId ?? null });
  if (!r) return { ok: false as const, error: 'db_error' };
  if (r.ok) await notifyAdmin('New review to moderate', `Order ${a.number}, ${a.rating} stars${a.photoUrls.length ? ' with photos' : ''}.`);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? 'failed' };
}

export async function moderateReview(a: { reviewId: string; decision: 'approve' | 'reject'; actor?: string | null }) {
  const r = await call<Res & { credit_granted: boolean }>(a.actor ? 'admin_review_moderate' : 'review_moderate', { review_id: a.reviewId, decision: a.decision, actor: a.actor ?? null });
  return r?.ok ? { ok: true as const, creditGranted: !!r.credit_granted } : { ok: false as const, error: r?.error ?? 'db_error' };
}

// ------------------------------------------------------------------ reminders (hourly cron)
export async function runReminders() {
  const r = await call<{ abandoned: { number: string; token: string; email: string; total: number }[]; reviews: { number: string; token: string; email: string }[] } & Res>('reminders_due', {});
  if (!r) return { abandoned: 0, reviews: 0 };
  const credit = (await getSettings()).review_credit_kobo;
  for (const o of r.abandoned) await notifyAbandoned({ to: o.email, number: o.number, token: o.token, totalKobo: o.total });
  for (const o of r.reviews) await notifyReviewRequest({ to: o.email, number: o.number, token: o.token, creditKobo: credit });
  logEvent('reminders.sent', { abandoned: r.abandoned.length, reviews: r.reviews.length });
  return { abandoned: r.abandoned.length, reviews: r.reviews.length };
}

// ------------------------------------------------------------------ resume an unpaid order
export async function resumePayment(a: { number: string; token: string }): Promise<StartResult> {
  if (!paystackConfigured()) return { ok: false, message: 'Payments are not set up yet.' };
  const reference = `pm_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const r = await call<Res & { total: number; email: string; order_id: string }>('checkout_new_reference', { number: a.number, token: a.token, reference });
  if (!r?.ok) return { ok: false, message: 'This order can no longer be paid. It may have expired. Please place a new order.' };
  const init = await initializeTransaction({ email: r.email, amountKobo: r.total, reference, callbackUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/order/${a.number}?t=${a.token}`, metadata: { order_id: r.order_id, order_number: a.number, resumed: true } });
  if (!init.ok) return { ok: false, message: init.message };
  return { ok: true, mode: 'pay', reference, accessCode: init.accessCode, publicKey: paystackPublicKey(), mock: paystackMock(), number: a.number, token: a.token, totalKobo: r.total, email: r.email };
}

// ------------------------------------------------------------------ guest tracking
/** Number plus the email or phone used. Returns the private token only when both match. */
export async function trackOrder(number: string, contact: string): Promise<string | null> {
  const o = await fetchOrder({ number: number.trim(), contact: contact.trim() });
  return o ? o.token : null;
}
