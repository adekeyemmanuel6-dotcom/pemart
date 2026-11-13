import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, one, pool, q, reset, variantId } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_integration';
delete process.env.RESEND_API_KEY;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const details = { email: 'ada@example.com', phone: '+2348031234567', isGift: false, address: { recipient: 'Ada Obi', phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } };
const L = (variant: string, quantity = 1) => ({ id: crypto.randomUUID(), kind: 'variant' as const, refId: variant, quantity });
const WALLET = { asset: 'USDT', network: 'TRC20', address: 'TXYZabcdefghijklmnopqrstuvwxyz1234', note: 'Tron only' };
const HASH = '0x' + 'a1'.repeat(32);

/** Migration 0018: crypto payments with manual admin confirmation, against real Postgres. */
describe.skipIf(!TEST_DB)('pay with crypto (0018)', () => {
  let svc: typeof import('@/lib/checkout/service');
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string, staff: string;
  beforeAll(async () => {
    svc = await import('@/lib/checkout/service');
    rpc = (await (await import('@/lib/db')).getRpc())! as never;
  });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    admin = await makeUser('owner@example.com'); staff = await makeUser('staff@example.com');
    await q(`update public.profiles set role='admin' where id=$1`, [admin]);
    await q(`update public.profiles set role='staff' where id=$1`, [staff]);
  });
  const call = (fn: string, arg: Json) => rpc(fn, arg);
  const enable = () => call('admin_crypto_settings_save', { actor: admin, enabled: true, wallets: [WALLET], instructions: 'Use the rate on Binance P2P', window_hours: 48 });
  const startCrypto = async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const r = await svc.createOrderAndInitPayment({ lines: [L(tee)], state: 'Lagos', acceptFinalSale: true } as never, details, {}, new Date(), 'crypto');
    if (!r.ok || r.mode !== 'crypto') throw new Error(`expected crypto mode: ${JSON.stringify(r)}`);
    return { ...r, order: await one<Json>('select * from public.orders where number=$1', [r.number]) };
  };

  it('is refused until an admin switches it on with a wallet', async () => {
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const r = await svc.createOrderAndInitPayment({ lines: [L(tee)], state: 'Lagos' } as never, details, {}, new Date(), 'crypto');
    expect(r.ok).toBe(false);
    expect(Number((await one<Json>('select count(*) n from public.orders')).n)).toBe(0);
  });

  it('only admins can change wallets, and bad addresses are rejected', async () => {
    expect((await call('admin_crypto_settings_save', { actor: staff, enabled: true, wallets: [WALLET] })).error?.message).toMatch(/forbidden|not_allowed|permission/i);
    expect((await call('admin_crypto_settings_save', { actor: admin, enabled: true, wallets: [] })).error?.message).toContain('wallet_required');
    expect((await call('admin_crypto_settings_save', { actor: admin, enabled: true, wallets: [{ ...WALLET, address: '<script>' }] })).error?.message).toContain('invalid_wallet');
    expect((await enable()).error).toBeNull();
    const s = await one<Json>('select crypto_enabled, crypto_wallets from public.settings');
    expect(s.crypto_enabled).toBe(true);
    expect(s.crypto_wallets).toEqual([WALLET]);
  });

  it('creates a priced, stock-holding order with the wallet snapshot and a longer payment window', async () => {
    await enable();
    const { order: o } = await startCrypto();
    expect(o).toMatchObject({ status: 'pending_payment', payment_method: 'crypto' });
    expect(Number(o.total_kobo)).toBe(2200000 + 350000);
    expect(o.crypto_payment.wallets).toEqual([WALLET]);
    const hours = (new Date(o.expires_at).getTime() - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(47); expect(hours).toBeLessThan(49);
    // Same order record as a Paystack order (tees are printed to order, so nothing is reserved).
    expect(o.reservations).toEqual([]);
    // A later address change never changes where this order was told to pay.
    await call('admin_crypto_settings_save', { actor: admin, enabled: true, wallets: [{ ...WALLET, address: 'TNEWaddressaaaaaaaaaaaaaaaaaaaaaaa' }] });
    expect((await svc.fetchCryptoPayment(o.id))!.wallets[0]!.address).toBe(WALLET.address);
  });

  it('the buyer can attach a transaction hash, which never marks the order paid', async () => {
    await enable();
    const { order: o } = await startCrypto();
    expect((await call('checkout_crypto_submit', { order_id: o.id, asset: 'USDT', network: 'TRC20', hash: 'not a hash' })).data).toMatchObject({ ok: false, error: 'bad_hash' });
    expect((await call('checkout_crypto_submit', { order_id: o.id, asset: 'BTC', network: 'Bitcoin', hash: HASH })).data).toMatchObject({ ok: false, error: 'bad_wallet' });
    expect((await call('checkout_crypto_submit', { order_id: o.id, asset: 'USDT', network: 'TRC20', hash: HASH })).data).toMatchObject({ ok: true });
    expect((await call('checkout_crypto_submit', { order_id: o.id, asset: 'USDT', network: 'TRC20', hash: HASH })).data).toMatchObject({ ok: true, already: true });
    const after = await one<Json>('select status, paid_at, crypto_payment from public.orders where id=$1', [o.id]);
    expect(after.status).toBe('pending_payment'); expect(after.paid_at).toBeNull();
    expect(after.crypto_payment.submissions).toHaveLength(1);
  });

  it('staff cannot confirm; an admin confirmation settles it exactly once', async () => {
    await enable();
    const { order: o } = await startCrypto();
    expect((await call('admin_crypto_confirm', { actor: staff, order_id: o.id })).error?.message).toBeTruthy();
    expect((await call('admin_crypto_confirm', { actor: null, order_id: o.id })).error?.message).toBeTruthy();
    const r = await call('admin_crypto_confirm', { actor: admin, order_id: o.id, note: '25 USDT received' });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ ok: true, status: 'paid' });
    const paid = await one<Json>('select status, paid_at from public.orders where id=$1', [o.id]);
    expect(paid.status).toBe('paid'); expect(paid.paid_at).toBeTruthy();
    const v = await one<Json>("select stock_qty, reserved_qty from public.product_variants where sku='SEEK-FIRST-TEE-BLACK-M'");
    expect(v.reserved_qty).toBe(0);
    const pay = await one<Json>('select provider, status, raw_payload from public.payments where order_id=$1', [o.id]);
    expect(pay).toMatchObject({ provider: 'crypto', status: 'success' });
    expect(pay.raw_payload).toMatchObject({ source: 'crypto', confirmed_by: admin, note: '25 USDT received' });
    expect((await call('admin_crypto_confirm', { actor: admin, order_id: o.id })).data).toMatchObject({ ok: true, already: true });
    expect((await call('checkout_crypto_submit', { order_id: o.id, asset: 'USDT', network: 'TRC20', hash: HASH })).data).toMatchObject({ ok: false, error: 'not_pending' });
  });

  it('cannot be used to mark a Paystack order paid', async () => {
    await enable();
    const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
    const s = await svc.createOrderAndInitPayment({ lines: [L(tee)], state: 'Lagos' } as never, details, {});
    if (!s.ok) throw new Error('start failed');
    const o = await one<Json>('select id, payment_method from public.orders where number=$1', [s.number]);
    expect(o.payment_method).toBe('paystack');
    expect((await call('admin_crypto_confirm', { actor: admin, order_id: o.id })).error?.message).toContain('not_crypto');
    expect(await svc.fetchCryptoPayment(o.id)).toBeNull();
  });

  it('customers and the public cannot call the crypto functions directly', async () => {
    const grants = await q<Json>(`select routine_name, grantee from information_schema.routine_privileges
      where routine_schema='public' and routine_name like '%crypto%' and grantee in ('anon','authenticated','PUBLIC')`);
    expect(grants).toEqual([]);
  });
});
