import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { settlePayment } from '@/lib/checkout/service';
import { logEvent } from '@/lib/log';
import { verifyTransaction } from '@/lib/paystack';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({ reference: z.string().regex(/^[A-Za-z0-9_.=-]{6,80}$/) });

/**
 * Called by the browser after the Paystack popup reports success. The browser's word is NOT enough:
 * we ask Paystack directly, then the database checks the amount and currency against the order.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`verify:${ip}`, 40, 10 * 60_000).ok) return NextResponse.json({ ok: false, message: 'Too many requests.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });

  const v = await verifyTransaction(parsed.data.reference);
  if (!v.ok) { logEvent('payment.verify_unreachable', { reference: parsed.data.reference }); return NextResponse.json({ ok: false, pending: true, message: 'We could not confirm your payment yet. If you were charged, your order will be confirmed shortly.' }, { status: 202 }); }
  if (v.status !== 'success') return NextResponse.json({ ok: false, status: v.status, message: 'Your payment was not completed.' }, { status: 402 });

  const r = await settlePayment(parsed.data.reference, { source: 'verify', amountKobo: v.amountKobo, currency: v.currency, payload: v.raw });
  if (!r.ok) return NextResponse.json({ ok: false, message: r.error === 'amount_mismatch' ? 'The amount paid did not match your order. Please contact us.' : 'We could not confirm your order. Please contact us.' }, { status: 409 });
  return NextResponse.json({ ok: true, number: r.number, token: r.token, status: r.status });
}
