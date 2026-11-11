import { NextResponse, type NextRequest } from 'next/server';
import { runReminders } from '@/lib/orders/service';

/** Hourly: the 1-hour abandoned-checkout email, and the review request 3 days after delivery. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runReminders()) });
}
