import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { logEvent } from '@/lib/log';

/**
 * Paystack, server side only. Three jobs:
 *  - initialise a transaction for an amount WE computed
 *  - verify a transaction with Paystack before we believe the browser
 *  - check the HMAC-SHA512 signature on webhooks
 * A dev-only mock exists for local work (PAYSTACK_MOCK=1) and is refused in production.
 */
const API = 'https://api.paystack.co';
const CHANNELS = ['card', 'bank_transfer', 'ussd', 'bank'];

export const paystackMock = () => process.env.PAYSTACK_MOCK === '1' && process.env.NODE_ENV !== 'production';
export const paystackConfigured = () => paystackMock() || !!process.env.PAYSTACK_SECRET_KEY;
export const paystackPublicKey = () => process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? '';

type G = typeof globalThis & { __paystackMock?: Map<string, number> };
const mockStore = () => ((globalThis as G).__paystackMock ??= new Map());

/** Constant-time HMAC-SHA512 check of the raw request body against the x-paystack-signature header. */
export function verifyPaystackSignature(rawBody: string, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type InitResult = { ok: true; accessCode: string; reference: string } | { ok: false; message: string };

export async function initializeTransaction(o: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }): Promise<InitResult> {
  if (paystackMock()) { mockStore().set(o.reference, o.amountKobo); return { ok: true, accessCode: `mock_${o.reference}`, reference: o.reference }; }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, message: 'Payments are not configured yet.' };
  try {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: o.email, amount: o.amountKobo, currency: 'NGN', reference: o.reference, callback_url: o.callbackUrl, channels: CHANNELS, metadata: o.metadata }),
      cache: 'no-store',
    });
    const j = (await res.json()) as { status: boolean; message?: string; data?: { access_code: string; reference: string } };
    if (!res.ok || !j.status || !j.data) { logEvent('paystack.init_failed', { reference: o.reference, status: res.status, message: j.message }); return { ok: false, message: 'We could not start the payment. Please try again.' }; }
    return { ok: true, accessCode: j.data.access_code, reference: j.data.reference };
  } catch (e) {
    logEvent('paystack.init_error', { reference: o.reference, error: (e as Error).message });
    return { ok: false, message: 'We could not reach the payment provider. Please try again.' };
  }
}

export type VerifyResult = { ok: true; status: string; amountKobo: number; currency: string; reference: string; raw: unknown } | { ok: false; message: string };

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (paystackMock()) {
    const amount = mockStore().get(reference);
    if (amount === undefined) return { ok: false, message: 'Unknown reference' };
    return { ok: true, status: 'success', amountKobo: amount, currency: 'NGN', reference, raw: { mock: true } };
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, message: 'Payments are not configured yet.' };
  try {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
    const j = (await res.json()) as { status: boolean; data?: { status: string; amount: number; currency: string; reference: string } };
    if (!res.ok || !j.status || !j.data) return { ok: false, message: 'Could not verify the payment.' };
    return { ok: true, status: j.data.status, amountKobo: j.data.amount, currency: j.data.currency, reference: j.data.reference, raw: j.data };
  } catch { return { ok: false, message: 'Could not reach the payment provider.' }; }
}

export type PaystackConfig = {
  mock: boolean; secretSet: boolean; publicSet: boolean;
  secretMode: 'test' | 'live' | 'unknown' | null; publicMode: 'test' | 'live' | 'unknown' | null;
};
const modeOf = (k: string | undefined, prefix: 'sk' | 'pk') => (!k ? null : k.startsWith(`${prefix}_live_`) ? 'live' : k.startsWith(`${prefix}_test_`) ? 'test' : 'unknown');

/** What is configured, WITHOUT revealing any key: only whether it is set and whether it is a test or live key. */
export function paystackConfig(): PaystackConfig {
  return {
    mock: paystackMock(),
    secretSet: !!process.env.PAYSTACK_SECRET_KEY, publicSet: !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    secretMode: modeOf(process.env.PAYSTACK_SECRET_KEY, 'sk'), publicMode: modeOf(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, 'pk'),
  };
}

/** A read-only call to Paystack to confirm the secret key is accepted. Returns no account data. */
export async function paystackPing(): Promise<{ ok: boolean; message: string; ms?: number }> {
  if (paystackMock()) return { ok: true, message: 'Mock mode (local development only)' };
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { ok: false, message: 'No secret key is set' };
  const t = Date.now();
  try {
    const res = await fetch(`${API}/transaction?perPage=1`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const ms = Date.now() - t;
    if (res.ok) return { ok: true, message: 'Paystack accepted the secret key', ms };
    if (res.status === 401) return { ok: false, message: 'Paystack rejected the secret key (401). Check it in Vercel.', ms };
    return { ok: false, message: `Paystack answered with status ${res.status}`, ms };
  } catch (e) {
    return { ok: false, message: (e as Error).name === 'TimeoutError' ? 'Paystack did not answer within 6 seconds' : 'Could not reach Paystack' };
  }
}
