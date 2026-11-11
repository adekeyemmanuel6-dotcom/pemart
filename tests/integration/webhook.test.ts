import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, one, pool, reset, variantId } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_webhook';
process.env.CRON_SECRET = 'cron-secret';
delete process.env.RESEND_API_KEY;

const sign = (body: string, key = 'sk_test_webhook') => createHmac('sha512', key).update(body).digest('hex');
const req = (body: string, sig?: string | null) => new Request('http://localhost/api/webhooks/paystack', { method: 'POST', body, headers: sig === null ? {} : { 'x-paystack-signature': sig ?? sign(body) } });
const event = (reference: string, amount: number, extra: object = {}) => JSON.stringify({ event: 'charge.success', data: { reference, amount, currency: 'NGN', status: 'success', ...extra } });

describe.skipIf(!TEST_DB)('Paystack webhook route', () => {
  let webhook: typeof import('@/app/api/webhooks/paystack/route');
  let svc: typeof import('@/lib/checkout/service');
  beforeAll(async () => { webhook = await import('@/app/api/webhooks/paystack/route'); svc = await import('@/lib/checkout/service'); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(reset);

  const newOrder = async (sku = 'FAITH-BRACELET-CROSS', qty = 2) => {
    const v = await variantId(sku);
    const r = await svc.createOrderAndInitPayment({ lines: [{ id: 'x', kind: 'variant', refId: v, quantity: qty }], state: 'Lagos' }, { email: 'a@b.co', phone: '+2348031234567', isGift: false, address: { recipient: 'A B', phone: '+2348031234567', line1: '1 Test Street', city: 'Ikeja', state: 'Lagos' } }, {});
    if (!r.ok || r.mode !== 'pay') throw new Error('setup failed');
    return r;
  };
  const status = async (number: string) => (await one<{ status: string }>('select status from public.orders where number=$1', [number])).status;
  const stock = async () => (await one<{ stock_qty: number; reserved_qty: number }>(`select stock_qty, reserved_qty from public.product_variants where sku='FAITH-BRACELET-CROSS'`));

  it('rejects an unsigned request, a wrong-key signature and a forged body; the order stays unpaid', async () => {
    const o = await newOrder(); const body = event(o.reference, o.totalKobo);
    expect((await webhook.POST(req(body, null))).status).toBe(401);
    expect((await webhook.POST(req(body, 'deadbeef'))).status).toBe(401);
    expect((await webhook.POST(req(body, sign(body, 'sk_test_wrong')))).status).toBe(401);
    const forged = event(o.reference, 1);                      // someone changes the amount but replays the old signature
    expect((await webhook.POST(req(forged, sign(body)))).status).toBe(401);
    expect(await status(o.number)).toBe('pending_payment');
  });

  it('accepts a valid charge.success, and a replay of the same event does not double-process', async () => {
    const o = await newOrder(); const body = event(o.reference, o.totalKobo);
    expect((await webhook.POST(req(body))).status).toBe(200);
    expect(await status(o.number)).toBe('paid');
    expect(await stock()).toMatchObject({ stock_qty: 38, reserved_qty: 0 });
    expect((await webhook.POST(req(body))).status).toBe(200);
    expect((await webhook.POST(req(body))).status).toBe(200);
    expect(await status(o.number)).toBe('paid');
    expect(await stock()).toMatchObject({ stock_qty: 38, reserved_qty: 0 });                // decremented exactly once
    expect(Number((await one<{ n: string }>('select count(*) n from public.payments')).n)).toBe(1);
  });

  it('a correctly signed event with the wrong amount does not pay the order', async () => {
    const o = await newOrder(); const body = event(o.reference, 1);
    expect((await webhook.POST(req(body))).status).toBe(200);        // acknowledged so Paystack stops retrying...
    expect(await status(o.number)).toBe('pending_payment');          // ...but never marked paid
    expect((await one<{ status: string }>('select status from public.payments')).status).toBe('failed');
  });

  it('ignores other events and malformed bodies safely', async () => {
    const o = await newOrder();
    const other = JSON.stringify({ event: 'transfer.success', data: { reference: o.reference, amount: o.totalKobo } });
    expect((await webhook.POST(req(other))).status).toBe(200);
    expect(await status(o.number)).toBe('pending_payment');
    expect((await webhook.POST(req('not json'))).status).toBe(400);
  });

  it('verify route: the browser alone cannot mark an order paid (Paystack is asked)', async () => {
    const verify = await import('@/app/api/payments/verify/route');
    const o = await newOrder();
    const bad = await verify.POST(new Request('http://localhost/api/payments/verify', { method: 'POST', body: JSON.stringify({ reference: 'pm_unknown_reference_123' }) }) as never);
    expect(bad.status).toBe(202);
    expect(await status(o.number)).toBe('pending_payment');
    const good = await verify.POST(new Request('http://localhost/api/payments/verify', { method: 'POST', body: JSON.stringify({ reference: o.reference }) }) as never);
    expect(good.status).toBe(200);
    expect(await status(o.number)).toBe('paid');
    const again = await verify.POST(new Request('http://localhost/api/payments/verify', { method: 'POST', body: JSON.stringify({ reference: o.reference }) }) as never);
    expect(again.status).toBe(200);
    expect(await stock()).toMatchObject({ stock_qty: 38, reserved_qty: 0 });
  });

  it('verify and webhook racing for the same payment settle it once', async () => {
    const verify = await import('@/app/api/payments/verify/route');
    const o = await newOrder();
    const body = event(o.reference, o.totalKobo);
    await Promise.all([
      webhook.POST(req(body)), webhook.POST(req(body)),
      verify.POST(new Request('http://localhost/api/payments/verify', { method: 'POST', body: JSON.stringify({ reference: o.reference }) }) as never),
    ]);
    expect(await status(o.number)).toBe('paid');
    expect(await stock()).toMatchObject({ stock_qty: 38, reserved_qty: 0 });
    expect(Number((await one<{ n: string }>(`select count(*) n from public.order_events where status='paid'`)).n)).toBe(1);
  });

  it('cron route needs the secret and cancels expired orders', async () => {
    const cron = await import('@/app/api/cron/expire/route');
    const o = await newOrder();
    await pool.query(`update public.orders set expires_at = now() - interval '1 hour' where number = $1`, [o.number]);
    const noAuth = await cron.GET(new Request('http://localhost/api/cron/expire') as never);
    expect(noAuth.status).toBe(401);
    const ok = await cron.GET(new Request('http://localhost/api/cron/expire', { headers: { authorization: 'Bearer cron-secret' } }) as never);
    expect(ok.status).toBe(200);
    expect(await status(o.number)).toBe('cancelled');
  });
});
