import { NextResponse, type NextRequest } from 'next/server';
import { expireUnpaidOrders } from '@/lib/checkout/service';

/** Hourly (see vercel.json). Cancels orders unpaid after 24 hours and releases their stock, credit and gift card balance. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, cancelled: await expireUnpaidOrders() });
}
