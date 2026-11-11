import { NextResponse } from 'next/server';
import { settlePayment } from '@/lib/checkout/service';
import { logEvent } from '@/lib/log';
import { verifyPaystackSignature } from '@/lib/paystack';

/**
 * Paystack webhook. Order of operations matters:
 *  1. Read the RAW body (the signature is over the exact bytes).
 *  2. Verify x-paystack-signature (HMAC-SHA512 with our secret key). Anything else is rejected with 401.
 *  3. Handle charge.success idempotently: the database function ignores a payment it has already settled,
 *     so retries and the browser-verify race can never double-process an order.
 * We answer 200 to every validly signed event (even ones we ignore) so Paystack stops retrying.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-paystack-signature');
  if (!verifyPaystackSignature(raw, signature, process.env.PAYSTACK_SECRET_KEY)) {
    logEvent('webhook.rejected', { reason: 'bad_signature', hasSignature: !!signature });
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  logEvent('webhook.received', { event: event.event, reference: event.data?.reference });

  if (event.event === 'charge.success' && event.data?.reference && typeof event.data.amount === 'number') {
    const r = await settlePayment(event.data.reference, { source: 'webhook', amountKobo: event.data.amount, currency: event.data.currency ?? 'NGN', payload: event.data });
    // A database hiccup is worth a retry from Paystack; a business rejection (e.g. amount mismatch) is not.
    if (!r.ok && r.error === 'db_error') return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
