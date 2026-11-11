import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, one, pool, q, reset, variantId } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_offers';
delete process.env.RESEND_API_KEY;

const details = { email: 'ada@example.com', phone: '+2348031234567', isGift: false, address: { recipient: 'Ada Obi', phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } };

describe.skipIf(!TEST_DB)('first-order offer (single-use 10% code)', () => {
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  let svc: typeof import('@/lib/checkout/service');
  beforeAll(async () => { const { getRpc } = await import('@/lib/db'); rpc = (await getRpc())! as never; svc = await import('@/lib/checkout/service'); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => { await reset(); await q('delete from public.subscribers'); });

  it('issues a PEM- code, stores the consent timestamp and re-shows the same code on a repeat claim', async () => {
    const a = (await rpc('offer_claim', { email: 'New@Example.com', source: 'popup' })).data as { code: string; is_new: boolean };
    expect(a.code).toMatch(/^PEM-[A-Z2-9]{6}$/);
    expect(a.is_new).toBe(true);
    const sub = await one<{ consent_at: string; offer_code: string }>("select consent_at, offer_code from public.subscribers where lower(email) = 'new@example.com'");
    expect(sub.offer_code).toBe(a.code);
    expect(sub.consent_at).toBeTruthy();
    const b = (await rpc('offer_claim', { email: 'new@example.com', source: 'footer' })).data as { code: string; is_new: boolean };
    expect(b.code).toBe(a.code);
    expect(b.is_new).toBe(false);
    expect((await q('select 1 from public.discount_codes where code = $1', [a.code])).length).toBe(1);
  });

  it('works with a phone number alone and rejects an empty claim', async () => {
    const p = (await rpc('offer_claim', { phone: '0803 123 4567', source: 'popup' })).data as { code: string };
    expect(p.code).toMatch(/^PEM-/);
    const bad = await rpc('offer_claim', { source: 'popup' });
    expect(bad.error?.message).toMatch(/email_or_phone_required/);
  });

  it('takes 10% off once, then the code is spent', async () => {
    const { code } = (await rpc('offer_claim', { email: 'ada@example.com' })).data as { code: string };
    const line = { id: crypto.randomUUID(), kind: 'variant', refId: await variantId('SEEK-FIRST-TEE-BLACK-M'), quantity: 1 };
    const first = await svc.createOrderAndInitPayment({ lines: [line], state: 'Lagos', acceptFinalSale: true, code } as never, details, {});
    expect(first.ok).toBe(true);
    if (!first.ok || first.mode !== 'pay') throw new Error('expected a payable order');
    const row = await one<{ discount_kobo: string; subtotal_kobo: string }>('select discount_kobo, subtotal_kobo from public.orders order by created_at desc limit 1');
    expect(Number(row.discount_kobo)).toBe(Math.round(Number(row.subtotal_kobo) * 0.1));
    await svc.settlePayment(first.reference, { source: 'webhook', amountKobo: first.totalKobo, currency: 'NGN', payload: {} });
    expect((await one<{ times_used: number }>('select times_used from public.discount_codes where code = $1', [code])).times_used).toBe(1);
    const again = await svc.createOrderAndInitPayment({ lines: [line], state: 'Lagos', acceptFinalSale: true, code } as never, details, {});
    expect(again.ok).toBe(false);
    const claim = (await rpc('offer_claim', { email: 'ada@example.com' })).data as { used: boolean };
    expect(claim.used).toBe(true);
  });
});
