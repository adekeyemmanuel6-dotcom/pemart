import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, one, pool, q, reset, makeUser, variantId } from '../helpers/db';
import { bundleSelection } from '../helpers/checkout';

// The app code reads these at call time.
process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_integration';
delete process.env.RESEND_API_KEY;

const details = { email: 'ada@example.com', phone: '+2348031234567', isGift: false, address: { recipient: 'Ada Obi', phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } };
const L = (variant: string, quantity = 1, extra: object = {}) => ({ id: crypto.randomUUID(), kind: 'variant' as const, refId: variant, quantity, ...extra });

describe.skipIf(!TEST_DB)('checkout against real Postgres', () => {
  let svc: typeof import('@/lib/checkout/service');
  beforeAll(async () => { svc = await import('@/lib/checkout/service'); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(reset);

  const start = async (lines: object[], extra: object = {}, who = {}) => {
    const r = await svc.createOrderAndInitPayment({ lines, state: 'Lagos', acceptFinalSale: true, ...extra } as never, details, who);
    if (!r.ok) throw new Error(`start failed: ${r.message}`);
    return r;
  };
  const pay = (ref: string, amount: number, source: 'verify' | 'webhook' = 'webhook', currency = 'NGN') => svc.settlePayment(ref, { source, amountKobo: amount, currency, payload: { test: true } });
  const order = (number: string) => one<Record<string, unknown>>('select * from public.orders where number = $1', [number]);

  it('a guest buys a ready tee with a code: server total, pending then paid with a 5-day promise', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await start([L(tee)], { code: 'PEMART10' });
    if (s.mode !== 'pay') throw new Error('expected pay mode');
    expect(s.totalKobo).toBe(2200000 - 220000 + 350000);
    let o = await order(s.number);
    expect(o.status).toBe('pending_payment');
    expect(Number(o.total_kobo)).toBe(2330000);
    expect(o.expires_at).toBeTruthy();

    const r = await pay(s.reference, 2330000, 'verify');
    expect(r.ok && r.status).toBe('paid');
    o = await order(s.number);
    expect(o.status).toBe('paid');
    const days = (new Date(o.promised_by as unknown as string).getTime() - new Date(o.paid_at as unknown as string).getTime()) / 86400000;
    expect(days).toBeCloseTo(5, 1);
    expect(o.production_start_at).toBeTruthy();
    expect((await one<{ times_used: number }>(`select times_used from public.discount_codes where code='PEMART10'`)).times_used).toBe(1);
    expect((await q('select status from public.payments where reference = $1', [s.reference]))[0]).toMatchObject({ status: 'success' });
  });

  it('prices come from the server even if the caller sends a price', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await start([{ ...L(tee), priceKobo: 1, unitKobo: 1, total: 1 }]);
    expect(s.mode === 'pay' && s.totalKobo).toBe(2550000);
    expect(Number((await order(s.number)).total_kobo)).toBe(2550000);
  });

  it('holds stock on creation, decrements once on payment, and a duplicate webhook changes nothing', async () => {
    const brace = await variantId('FAITH-BRACELET-CROSS');
    const s = await start([L(brace, 3)]);
    expect(await one(`select stock_qty, reserved_qty from public.product_variants where id = $1`, [brace])).toMatchObject({ stock_qty: 40, reserved_qty: 3 });
    const first = await pay(s.mode === 'pay' ? s.reference : '', 3 * 600000 + 350000);
    expect(first.ok && !first.already).toBe(true);
    const second = await pay(s.mode === 'pay' ? s.reference : '', 3 * 600000 + 350000);
    expect(second.ok && second.already).toBe(true);
    expect(await one(`select stock_qty, reserved_qty from public.product_variants where id = $1`, [brace])).toMatchObject({ stock_qty: 37, reserved_qty: 0 });
    expect((await q('select 1 from public.payments where order_id = (select id from public.orders limit 1)')).length).toBe(1);
  });

  it('refuses to oversell and rolls back every hold when one item is short', async () => {
    const cross = await variantId('FAITH-BRACELET-CROSS'), dove = await variantId('FAITH-BRACELET-DOVE');
    await q(`update public.product_variants set stock_qty = 2 where id = $1`, [dove]);
    const r = await svc.createOrderAndInitPayment({ lines: [L(cross, 5), L(dove, 3)], state: 'Lagos' } as never, details, {});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/sold out|Only/);
    expect(await one(`select reserved_qty from public.product_variants where id = $1`, [cross])).toMatchObject({ reserved_qty: 0 });
    expect((await q('select 1 from public.orders')).length).toBe(0);
    // Server-side race: the catalogue (cached) can be stale, so the database itself must stop it.
    await q(`update public.product_variants set stock_qty = 1 where id = $1`, [cross]);
    const a = await start([L(cross, 1)]);
    const b = await svc.createOrderAndInitPayment({ lines: [L(cross, 1)], state: 'Lagos' } as never, details, {});
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });

  it('rejects a payment whose amount or currency does not match the order, then accepts the right one', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await start([L(tee)]); const ref = s.mode === 'pay' ? s.reference : '';
    const low = await pay(ref, 100);
    expect(low.ok).toBe(false); expect(low.error).toBe('amount_mismatch');
    expect((await order(s.number)).status).toBe('pending_payment');
    expect((await pay(ref, 2550000, 'webhook', 'USD')).ok).toBe(false);
    expect((await order(s.number)).status).toBe('pending_payment');
    expect((await pay(ref, 2550000)).ok).toBe(true);
    expect((await order(s.number)).status).toBe('paid');
  });

  it('an unknown reference is rejected', async () => { expect((await pay('pm_does_not_exist', 5)).ok).toBe(false); });

  it('ambassador code: 10% off and one pending commission of 10% of the goods, even with a duplicate webhook', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await start([L(tee)], { code: 'GRACE10' }); const ref = s.mode === 'pay' ? s.reference : '';
    expect(s.mode === 'pay' && s.totalKobo).toBe(2200000 - 220000 + 350000);
    await pay(ref, 2330000); await pay(ref, 2330000);
    const c = await q<{ amount_kobo: string; status: string }>('select * from public.commissions');
    expect(c.length).toBe(1);
    expect(Number(c[0]!.amount_kobo)).toBe(220000);
    expect(c[0]!.status).toBe('pending');
  });

  it('a custom order waits for its proof: no production start or promise yet', async () => {
    const created = await svc.createOrderAndInitPayment({ lines: [], state: 'Lagos' } as never, details, {}).catch(() => null); void created;
    const { getRpc } = await import('@/lib/db');
    const rpc = (await getRpc())!;
    const cr = await rpc<{ id: string }>('custom_request_create', { tier: 'text_design', product_type: 'hoodie', colour: 'Black', print_positions: ['back'], text_fields: { lines: ['GRACE'], size: 'M' }, type_style: 'heavy', upload_paths: [], fee_kobo: 500000 });
    const s = await start([{ id: 'c', kind: 'custom', refId: cr.data!.id, quantity: 1 }]);
    expect(s.mode === 'pay' && s.totalKobo).toBe(4200000 + 500000 + 350000);
    await pay(s.mode === 'pay' ? s.reference : '', 5050000);
    const o = await order(s.number);
    expect(o.status).toBe('awaiting_proof');
    expect(o.production_start_at).toBeNull();
    expect(o.promised_by).toBeNull();
    expect((await one<{ status: string }>('select status from public.custom_requests where id = $1', [cr.data!.id])).status).toBe('awaiting_proof');
    // the same brief cannot be sold twice
    const again = await svc.createOrderAndInitPayment({ lines: [{ id: 'c', kind: 'custom', refId: cr.data!.id, quantity: 1 }], state: 'Lagos', acceptFinalSale: true } as never, details, {});
    expect(again.ok).toBe(false);
  });

  it('a configured bundle stores every selection and holds only stocked parts', async () => {
    const { getCatalogue } = await import('@/lib/catalogue/load');
    const live = await getCatalogue();
    const sel = bundleSelection('couples-christmas-box', { giftMessage: 'Merry Christmas!', giftWrap: true }, live);
    const s = await start([{ id: 'b', kind: 'bundle', refId: 'couples-christmas-box', quantity: 1, selection: sel }]);
    expect(s.mode === 'pay' && s.totalKobo).toBe(8900000 + 200000);               // box + gift wrap; delivery is free over ₦75,000
    const o = await order(s.number);
    expect(o.has_bundle).toBe(true);
    expect((o.reservations as unknown[]).length).toBe(4);                          // 2 perfumes, couple bracelets, orb (tees are made to order)
    await pay(s.mode === 'pay' ? s.reference : '', 9100000);
    const item = await one<{ selections: { label: string }[]; kind: string; gift_message: string }>('select * from public.order_items where order_id = $1', [o.id]);
    expect(item.kind).toBe('bundle');
    expect(item.selections.length).toBe(6);
    expect(item.selections.map((x) => x.label)).toEqual(expect.arrayContaining(['His tee', 'Her tee', 'His perfume', 'Her perfume', 'Couple bracelets', 'Flying orb ball']));
    expect(item.gift_message).toBe('Merry Christmas!');
    expect(Number((await one<{ n: string }>(`select count(*) n from public.product_variants where reserved_qty > 0`)).n)).toBe(0);
  });

  it('expiry after 24h cancels the order and releases stock, store credit and the gift card', async () => {
    const brace = await variantId('FAITH-BRACELET-CROSS'); const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const uid = await makeUser('ada@example.com', 500000);
    await q(`insert into public.gift_cards (code, initial_kobo, balance_kobo) values ('PG-TEST-0001-AAAA', 1000000, 1000000)`);
    const s = await start([L(brace, 2), L(tee)], { giftCode: 'PG-TEST-0001-AAAA', useCredit: true }, { profileId: uid, email: 'ada@example.com' });
    expect(await one<{ balance_kobo: string }>(`select balance_kobo from public.gift_cards where code='PG-TEST-0001-AAAA'`)).toMatchObject({ balance_kobo: '0' });
    expect(Number((await one<{ store_credit_kobo: string }>('select store_credit_kobo from public.profiles where id=$1', [uid])).store_credit_kobo)).toBe(0);
    expect(s.ok).toBe(true);
    expect(await svc.expireUnpaidOrders(new Date(Date.now() + 23 * 3600_000))).toBe(0);      // not yet
    expect(await svc.expireUnpaidOrders(new Date(Date.now() + 25 * 3600_000))).toBe(1);      // after 24h
    expect((await order(s.number)).status).toBe('cancelled');
    expect(await one(`select reserved_qty from public.product_variants where id=$1`, [brace])).toMatchObject({ reserved_qty: 0 });
    expect(await one<{ balance_kobo: string }>(`select balance_kobo from public.gift_cards where code='PG-TEST-0001-AAAA'`)).toMatchObject({ balance_kobo: '1000000' });
    expect(Number((await one<{ store_credit_kobo: string }>('select store_credit_kobo from public.profiles where id=$1', [uid])).store_credit_kobo)).toBe(500000);
    expect(await svc.expireUnpaidOrders(new Date(Date.now() + 26 * 3600_000))).toBe(0);     // idempotent
  });

  it('a gift card that covers everything completes the order with no payment step', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    await q(`insert into public.gift_cards (code, initial_kobo, balance_kobo) values ('PG-FREE-0001-AAAA', 5000000, 5000000)`);
    const s = await start([L(tee)], { giftCode: 'PG-FREE-0001-AAAA' });
    expect(s.mode).toBe('paid');
    expect((await order(s.number)).status).toBe('paid');
    expect(await one<{ balance_kobo: string }>(`select balance_kobo from public.gift_cards where code='PG-FREE-0001-AAAA'`)).toMatchObject({ balance_kobo: String(5000000 - 2550000) });
  });

  it('buying a gift card issues a code worth the amount, once', async () => {
    const gc = await variantId('GIFTCARD-25000');
    const s = await start([L(gc, 1, { giftCard: { recipientEmail: 'friend@example.com', message: 'Enjoy' } })], { state: undefined }); const ref = s.mode === 'pay' ? s.reference : '';
    await pay(ref, 2500000); await pay(ref, 2500000);
    const cards = await q<{ code: string; balance_kobo: string; recipient_email: string }>('select * from public.gift_cards');
    expect(cards.length).toBe(1);
    expect(cards[0]!.code).toMatch(/^PG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(Number(cards[0]!.balance_kobo)).toBe(2500000);
    expect(cards[0]!.recipient_email).toBe('friend@example.com');
  });

  it('a payment that arrives after the order expired restores it when stock allows', async () => {
    const brace = await variantId('FAITH-BRACELET-CROSS');
    const s = await start([L(brace, 2)]); const ref = s.mode === 'pay' ? s.reference : '';
    await svc.expireUnpaidOrders(new Date(Date.now() + 25 * 3600_000));
    const r = await pay(ref, 2 * 600000 + 350000);
    expect(r.ok).toBe(true);
    expect((await order(s.number)).status).toBe('paid');
    expect(await one(`select stock_qty, reserved_qty from public.product_variants where id=$1`, [brace])).toMatchObject({ stock_qty: 38, reserved_qty: 0 });
  });

  it('...and flags a refund when the stock went to someone else', async () => {
    const brace = await variantId('FAITH-BRACELET-CROSS');
    await q(`update public.product_variants set stock_qty = 2 where id = $1`, [brace]);
    const s = await start([L(brace, 2)]); const ref = s.mode === 'pay' ? s.reference : '';
    await svc.expireUnpaidOrders(new Date(Date.now() + 25 * 3600_000));
    await start([L(brace, 2)]);                                  // another customer takes the stock
    const r = await pay(ref, 2 * 600000 + 350000);
    expect(r.ok && r.needsRefund).toBe(true);
    expect((await order(s.number)).status).toBe('cancelled');
    expect(String((await order(s.number)).payment_note)).toMatch(/Refund needed/);
  });

  it('guest order lookup needs the token, the email or the phone', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await start([L(tee)]);
    expect(await svc.fetchOrder({ number: s.number })).toBeNull();
    expect(await svc.fetchOrder({ number: s.number, token: 'wrong' })).toBeNull();
    expect((await svc.fetchOrder({ number: s.number, token: s.token }))?.number).toBe(s.number);
    expect((await svc.fetchOrder({ number: s.number.toLowerCase(), contact: 'ADA@example.com' }))?.number).toBe(s.number);
    expect((await svc.fetchOrder({ number: s.number, contact: '0803 123 4567' }))?.number).toBe(s.number);
    expect(await svc.fetchOrder({ number: s.number, contact: 'other@example.com' })).toBeNull();
  });

  it('SQL functions are not callable by browser roles', async () => {
    const { rows } = await pool.query(`select has_function_privilege('anon', 'public.checkout_mark_paid(jsonb)', 'execute') a, has_function_privilege('authenticated', 'public.checkout_create_order(jsonb)', 'execute') b, has_function_privilege('service_role', 'public.checkout_mark_paid(jsonb)', 'execute') c`);
    expect(rows[0]).toEqual({ a: false, b: false, c: true });
  });
});
