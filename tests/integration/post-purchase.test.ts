import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, one, pool, q, reset, variantId } from '../helpers/db';
import { ORDER_STATUSES, canTransition } from '@/lib/orders/status';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_pp';
delete process.env.RESEND_API_KEY;

const details = { email: 'ada@example.com', phone: '+2348031234567', isGift: false, address: { recipient: 'Ada Obi', phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } };

describe.skipIf(!TEST_DB)('post-purchase flows against real Postgres', () => {
  let svc: typeof import('@/lib/checkout/service');
  let ord: typeof import('@/lib/orders/service');
  let acct: typeof import('@/lib/account/service');
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null }>;
  beforeAll(async () => {
    svc = await import('@/lib/checkout/service'); ord = await import('@/lib/orders/service'); acct = await import('@/lib/account/service');
    const { getRpc } = await import('@/lib/db'); const r = (await getRpc())!; rpc = r as never;
  });
  afterAll(async () => { await pool?.end(); });
  beforeEach(reset);

  const start = async (lines: object[], extra: object = {}, who = {}) => {
    const r = await svc.createOrderAndInitPayment({ lines, state: 'Lagos', acceptFinalSale: true, ...extra } as never, details, who);
    if (!r.ok) throw new Error(`start failed: ${r.message}`);
    return r;
  };
  const pay = async (s: Awaited<ReturnType<typeof start>>) => { if (s.mode !== 'pay') return; await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} }); };
  const newCustom = async (tier = 'text_design', type = 'hoodie') => ((await rpc('custom_request_create', { tier, product_type: type, colour: 'Black', print_positions: ['back'], text_fields: { lines: ['GRACE'], size: 'M' }, type_style: 'heavy', upload_paths: [], fee_kobo: 500000 })).data as { id: string }).id;
  const customLine = (id: string) => ({ id: crypto.randomUUID(), kind: 'custom', refId: id, quantity: 1 });
  const paidCustomOrder = async (n = 1) => {
    const ids = await Promise.all(Array.from({ length: n }, () => newCustom()));
    const s = await start(ids.map(customLine)); await pay(s);
    return { s, ids, number: s.number, token: s.token };
  };
  const order = (number: string) => one<Record<string, unknown>>('select * from public.orders where number = $1', [number]);
  const reqStatus = async (id: string) => (await one<{ status: string; revisions_used: number; revisions_paid: number }>('select status, revisions_used, revisions_paid from public.custom_requests where id = $1', [id]));

  describe('the proof round trip', () => {
    it('proof -> revision -> second proof -> approval; the 5-day clock starts only at approval', async () => {
      const { ids, number, token } = await paidCustomOrder();
      const id = ids[0]!;
      let o = await order(number);
      expect(o.status).toBe('awaiting_proof'); expect(o.promised_by).toBeNull(); expect(o.production_start_at).toBeNull();

      expect((await ord.sendProof({ customRequestId: id, path: '/designs/seek-first-card.svg', message: 'First draft' })).ok).toBe(true);
      o = await order(number);
      expect(o.status).toBe('proof_sent'); expect(o.promised_by).toBeNull();
      expect((await reqStatus(id)).status).toBe('proof_sent');

      const rev = await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'Make the text bigger', token });
      expect(rev.ok).toBe(true);
      o = await order(number);
      expect(o.status).toBe('revision_requested'); expect(o.promised_by).toBeNull();
      expect(await reqStatus(id)).toMatchObject({ status: 'revision_requested', revisions_used: 1 });
      expect((await one<{ feedback: { note: string }[] }>('select feedback from public.custom_requests where id=$1', [id])).feedback[0]!.note).toBe('Make the text bigger');

      await ord.sendProof({ customRequestId: id, path: '/designs/seek-first-card.svg', message: 'Bigger now' });
      expect((await one<{ proofs: unknown[] }>('select proofs from public.custom_requests where id=$1', [id])).proofs.length).toBe(2);
      o = await order(number); expect(o.status).toBe('proof_sent'); expect(o.promised_by).toBeNull();

      const before = Date.now();
      const ok = await ord.respondToProof({ customRequestId: id, decision: 'approve', token });
      expect(ok.ok && ok.productionStarted).toBe(true);
      o = await order(number);
      expect(o.status).toBe('approved');
      expect(o.production_start_at).not.toBeNull();
      const days = (new Date(o.promised_by as string).getTime() - new Date(o.production_start_at as string).getTime()) / 86400000;
      expect(days).toBeCloseTo(5, 2);
      expect(new Date(o.production_start_at as string).getTime()).toBeGreaterThanOrEqual(before - 1000);
      const events = (await q<{ status: string }>('select status from public.order_events where order_id=$1 order by created_at', [o.id])).map((e) => e.status);
      expect(events).toEqual(expect.arrayContaining(['paid', 'awaiting_proof', 'proof_sent', 'revision_requested', 'approved']));
    });

    it('only the right person can respond; one free revision, then it must be bought', async () => {
      const { ids, number, token } = await paidCustomOrder(); const id = ids[0]!;
      await ord.sendProof({ customRequestId: id, path: '/p.svg' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'approve', token: 'wrong' }))).toMatchObject({ ok: false, error: 'not_allowed' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'approve' }))).toMatchObject({ ok: false, error: 'not_allowed' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'x', token }))).toMatchObject({ ok: false, error: 'note_required' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'Change it', token })).ok).toBe(true);
      expect((await ord.respondToProof({ customRequestId: id, decision: 'approve', token }))).toMatchObject({ ok: false, error: 'no_proof_waiting' });  // nothing to answer until a new proof
      await ord.sendProof({ customRequestId: id, path: '/p2.svg' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'Again please', token }))).toMatchObject({ ok: false, error: 'paid_revision_required' });
      expect((await reqStatus(id)).status).toBe('proof_sent');
      expect(number).toBeTruthy();
    });

    it('a signed-in owner can respond without the token', async () => {
      const uid = await makeUser('ada@example.com');
      const id = await newCustom();
      const s = await svc.createOrderAndInitPayment({ lines: [customLine(id)], state: 'Lagos', acceptFinalSale: true } as never, details, { profileId: uid });
      if (!s.ok || s.mode !== 'pay') throw new Error('setup'); await pay(s);
      await ord.sendProof({ customRequestId: id, path: '/p.svg' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'approve', profileId: uid })).ok).toBe(true);
      const other = await makeUser('other@example.com');
      const id2 = await newCustom();
      const s2 = await svc.createOrderAndInitPayment({ lines: [customLine(id2)], state: 'Lagos', acceptFinalSale: true } as never, details, { profileId: uid });
      if (!s2.ok || s2.mode !== 'pay') throw new Error('setup'); await pay(s2); await ord.sendProof({ customRequestId: id2, path: '/p.svg' });
      expect((await ord.respondToProof({ customRequestId: id2, decision: 'approve', profileId: other }))).toMatchObject({ ok: false, error: 'not_allowed' });
    });

    it('buying an extra revision grants exactly one more, and is a no-delivery digital order', async () => {
      const { ids, number, token } = await paidCustomOrder(); const id = ids[0]!;
      await ord.sendProof({ customRequestId: id, path: '/p.svg' });
      await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'First change', token });
      await ord.sendProof({ customRequestId: id, path: '/p2.svg' });
      expect((await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'Second change', token })).ok).toBe(false);

      const rev = await start([{ id: 'r', kind: 'revision', refId: id, quantity: 1 }], { state: undefined });
      expect(rev.mode === 'pay' && rev.totalKobo).toBe(200000);                 // ₦2,000, no delivery fee
      await pay(rev); await pay(rev);                                           // duplicate settle grants only once
      expect(await reqStatus(id)).toMatchObject({ revisions_paid: 1 });
      expect((await order(rev.number)).status).toBe('delivered');               // digital: nothing to ship
      expect((await ord.respondToProof({ customRequestId: id, decision: 'revise', note: 'Second change', token })).ok).toBe(true);
      expect((await order(number)).status).toBe('revision_requested');
    });

    it('an order with two custom designs and a ready item starts the clock only when ALL designs are approved', async () => {
      const [a, b] = [await newCustom(), await newCustom('personalise', 'tee')];
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([customLine(a), customLine(b), { id: 't', kind: 'variant', refId: tee, quantity: 1 }]); await pay(s);
      const number = s.number, token = s.token;
      expect((await order(number)).promised_by).toBeNull();                      // the ready tee does not start it either
      await ord.sendProof({ customRequestId: a, path: '/a.svg' });
      expect((await order(number)).status).toBe('awaiting_proof');               // b still has no proof
      await ord.sendProof({ customRequestId: b, path: '/b.svg' });
      expect((await order(number)).status).toBe('proof_sent');
      await ord.respondToProof({ customRequestId: a, decision: 'approve', token });
      let o = await order(number);
      expect(o.status).toBe('proof_sent'); expect(o.promised_by).toBeNull();     // one approved is not enough
      const last = await ord.respondToProof({ customRequestId: b, decision: 'approve', token });
      expect(last.ok && last.productionStarted).toBe(true);
      o = await order(number); expect(o.status).toBe('approved'); expect(o.promised_by).not.toBeNull();
    });

    it('proofs can only be sent for a design that is waiting on one', async () => {
      const { ids } = await paidCustomOrder(); const id = ids[0]!;
      await ord.sendProof({ customRequestId: id, path: '/p.svg' });
      expect(await ord.sendProof({ customRequestId: id, path: '/again.svg' })).toMatchObject({ ok: false, error: 'not_awaiting_proof' });
      expect(await ord.sendProof({ customRequestId: '00000000-0000-0000-0000-000000000000', path: '/x' })).toMatchObject({ ok: false });
    });
  });

  describe('order statuses', () => {
    it('SQL and TypeScript agree on every status transition', async () => {
      const mismatches: string[] = [];
      for (const f of ORDER_STATUSES) for (const t of ORDER_STATUSES) {
        const sql = (await one<{ ok: boolean }>('select public._order_transition_ok($1,$2) ok', [f, t])).ok;
        if (sql !== canTransition(f, t)) mismatches.push(`${f}->${t}: sql=${sql} ts=${canTransition(f, t)}`);
      }
      expect(mismatches).toEqual([]);
    });

    it('walks a ready order through production to delivered, and rejects skipping steps', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]); await pay(s);
      const id = (await order(s.number)).id as string;
      expect(await ord.changeOrderStatus({ orderId: id, to: 'delivered' })).toMatchObject({ ok: false, error: 'bad_transition' });
      expect((await ord.changeOrderStatus({ orderId: id, to: 'in_production' })).ok).toBe(true);
      expect(await ord.changeOrderStatus({ orderId: id, to: 'packed' })).toMatchObject({ ok: false });      // must pass quality check
      for (const to of ['quality_check', 'packed', 'out_for_delivery', 'delivered'] as const) expect((await ord.changeOrderStatus({ orderId: id, to })).ok).toBe(true);
      const o = await order(s.number);
      expect(o.status).toBe('delivered'); expect(o.delivered_at).not.toBeNull();
      expect((await q('select 1 from public.order_events where order_id=$1', [id])).length).toBeGreaterThanOrEqual(6);
    });

    it('a failed quality check goes to reprint and back to production', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]); await pay(s);
      const id = (await order(s.number)).id as string;
      for (const to of ['in_production', 'quality_check', 'reprint', 'in_production'] as const) expect((await ord.changeOrderStatus({ orderId: id, to })).ok).toBe(true);
    });

    it('production cannot begin for a custom order before its design is approved', async () => {
      const { s } = await paidCustomOrder(); const id = (await order(s.number)).id as string;
      expect(await ord.changeOrderStatus({ orderId: id, to: 'in_production' })).toMatchObject({ ok: false });
    });

    it('cancelling a live order releases its stock', async () => {
      const brace = await variantId('FAITH-BRACELET-CROSS');
      const s = await start([{ id: 'b', kind: 'variant', refId: brace, quantity: 2 }]); await pay(s);
      expect(await one(`select stock_qty from public.product_variants where id=$1`, [brace])).toMatchObject({ stock_qty: 38 });
      expect((await ord.changeOrderStatus({ orderId: (await order(s.number)).id as string, to: 'cancelled' })).ok).toBe(true);
    });
  });

  describe('reviews and store credit', () => {
    const deliveredOrder = async (who: { profileId?: string; email?: string } = {}) => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const d = { ...details, email: who.email ?? details.email };
      const s = await svc.createOrderAndInitPayment({ lines: [{ id: 't', kind: 'variant', refId: tee, quantity: 1 }], state: 'Lagos' } as never, d, who.profileId ? { profileId: who.profileId } : {});
      if (!s.ok || s.mode !== 'pay') throw new Error('setup'); await pay(s);
      await q(`update public.orders set status='delivered', delivered_at = now() where number=$1`, [s.number]);
      const item = await one<{ id: string }>('select i.id from public.order_items i join public.orders o on o.id=i.order_id where o.number=$1', [s.number]);
      return { number: s.number, token: s.token, itemId: item.id };
    };
    const review = (o: { number: string; token: string; itemId: string }, extra: object = {}) => ord.submitReview({ number: o.number, token: o.token, orderItemId: o.itemId, rating: 5, text: 'Love it', photoUrls: [], ...extra });
    const credit = async (id: string) => Number((await one<{ store_credit_kobo: string }>('select store_credit_kobo from public.profiles where id=$1', [id])).store_credit_kobo);

    it('only delivered orders, verified buyers, one review per item', async () => {
      const o = await deliveredOrder();
      expect(await ord.submitReview({ number: o.number, token: 'bad', orderItemId: o.itemId, rating: 5, photoUrls: [] })).toMatchObject({ ok: false, error: 'not_allowed' });
      expect((await review(o)).ok).toBe(true);
      expect(await review(o)).toMatchObject({ ok: false, error: 'already_reviewed' });
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-L');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]);
      const item = await one<{ id: string }>('select i.id from public.order_items i join public.orders o on o.id=i.order_id where o.number=$1', [s.number]);
      expect(await ord.submitReview({ number: s.number, token: s.token, orderItemId: item.id, rating: 5, photoUrls: [] })).toMatchObject({ ok: false, error: 'not_delivered' });
    });

    it('starts pending; approving a photo review grants ₦2,000 once, a text-only review grants none', async () => {
      const uid = await makeUser('ada@example.com');
      const o = await deliveredOrder({ profileId: uid });
      await review(o, { photoUrls: ['/placeholders/review-demo.svg'] });
      const r = await one<{ id: string; status: string }>('select id, status from public.reviews');
      expect(r.status).toBe('pending');
      expect(await credit(uid)).toBe(0);
      expect(await ord.moderateReview({ reviewId: r.id, decision: 'approve' })).toEqual({ ok: true, creditGranted: true });
      expect(await credit(uid)).toBe(200000);
      expect(await ord.moderateReview({ reviewId: r.id, decision: 'approve' })).toEqual({ ok: true, creditGranted: false });   // never twice
      expect(await credit(uid)).toBe(200000);

      const o2 = await deliveredOrder({ profileId: uid }); await review(o2);
      const r2 = await one<{ id: string }>(`select id from public.reviews where status='pending'`);
      expect((await ord.moderateReview({ reviewId: r2.id, decision: 'approve' }))).toEqual({ ok: true, creditGranted: false });
      expect(await credit(uid)).toBe(200000);
    });

    it('a rejected review grants nothing and is not public', async () => {
      const uid = await makeUser('ada@example.com');
      const o = await deliveredOrder({ profileId: uid }); await review(o, { photoUrls: ['/x.svg'] });
      const r = await one<{ id: string }>('select id from public.reviews');
      await ord.moderateReview({ reviewId: r.id, decision: 'reject' });
      expect(await credit(uid)).toBe(0);
      expect((await one<{ status: string }>('select status from public.reviews')).status).toBe('rejected');
    });

    it('a guest reviewer earns the credit when they later create an account with that email', async () => {
      const o = await deliveredOrder({ email: 'guest@example.com' }); await review(o, { photoUrls: ['/x.svg'] });
      const r = await one<{ id: string }>('select id from public.reviews');
      expect(await ord.moderateReview({ reviewId: r.id, decision: 'approve' })).toEqual({ ok: true, creditGranted: false });
      expect((await one<{ credit_pending: boolean }>('select credit_pending from public.reviews')).credit_pending).toBe(true);
      const uid = await makeUser('GUEST@example.com');                         // signs up later (trigger claims it)
      expect(await credit(uid)).toBe(200000);
      expect((await one<{ credit_issued: boolean; credit_pending: boolean }>('select credit_issued, credit_pending from public.reviews'))).toEqual({ credit_issued: true, credit_pending: false });
    });

    it('a bundle review is attached to a real product', async () => {
      const { bundleSelection } = await import('../helpers/checkout');
      const { getCatalogue } = await import('@/lib/catalogue/load');
      const sel = bundleSelection('starter', {}, await getCatalogue());
      const s = await start([{ id: 'b', kind: 'bundle', refId: 'starter', quantity: 1, selection: sel }]); await pay(s);
      await q(`update public.orders set status='delivered', delivered_at=now() where number=$1`, [s.number]);
      const item = await one<{ id: string }>('select i.id from public.order_items i join public.orders o on o.id=i.order_id where o.number=$1', [s.number]);
      expect((await ord.submitReview({ number: s.number, token: s.token, orderItemId: item.id, rating: 4, photoUrls: [] })).ok).toBe(true);
    });
  });

  describe('reminders and resuming payment', () => {
    it('sends the abandoned-checkout reminder once, after an hour, and not for expired or paid orders', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const a = await start([{ id: 'a', kind: 'variant', refId: tee, quantity: 1 }]);
      expect((await ord.runReminders()).abandoned).toBe(0);                                  // too early
      await q(`update public.orders set created_at = now() - interval '2 hours' where number=$1`, [a.number]);
      expect((await ord.runReminders()).abandoned).toBe(1);
      expect((await ord.runReminders()).abandoned).toBe(0);                                  // once only
      const b = await start([{ id: 'b', kind: 'variant', refId: tee, quantity: 1 }]); await pay(b);
      await q(`update public.orders set created_at = now() - interval '2 hours' where number=$1`, [b.number]);
      expect((await ord.runReminders()).abandoned).toBe(0);                                  // paid
    });

    it('sends the review request 3 days after delivery, once', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]); await pay(s);
      await q(`update public.orders set status='delivered', delivered_at = now() - interval '2 days' where number=$1`, [s.number]);
      expect((await ord.runReminders()).reviews).toBe(0);
      await q(`update public.orders set delivered_at = now() - interval '3 days 1 hour' where number=$1`, [s.number]);
      expect((await ord.runReminders()).reviews).toBe(1);
      expect((await ord.runReminders()).reviews).toBe(0);
    });

    it('resuming payment issues a new reference; whichever reference is paid settles the order once', async () => {
      const brace = await variantId('FAITH-BRACELET-CROSS');
      const s = await start([{ id: 'b', kind: 'variant', refId: brace, quantity: 2 }]);
      if (s.mode !== 'pay') throw new Error('x');
      const r = await ord.resumePayment({ number: s.number, token: s.token });
      if (!r.ok || r.mode !== 'pay') throw new Error('resume failed');
      expect(r.reference).not.toBe(s.reference);
      expect((await ord.resumePayment({ number: s.number, token: 'wrong' })).ok).toBe(false);
      // the customer actually completed the FIRST popup after all
      const late = await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} });
      expect(late.ok && !late.already).toBe(true);
      expect((await order(s.number)).status).toBe('paid');
      // ...and also paid the second: the order is not paid twice, it is flagged for a refund
      const dup = await svc.settlePayment(r.reference, { source: 'webhook', amountKobo: r.totalKobo, currency: 'NGN', payload: {} });
      expect(dup.ok && dup.already).toBe(true);
      expect(String((await order(s.number)).payment_note)).toMatch(/Refund needed/);
      expect(await one(`select stock_qty from public.product_variants where id=$1`, [brace])).toMatchObject({ stock_qty: 38 });  // decremented once
      expect((await ord.resumePayment({ number: s.number, token: s.token })).ok).toBe(false);                                // paid orders cannot be resumed
    });

    it('an expired order cannot be resumed', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]);
      await q(`update public.orders set expires_at = now() - interval '1 minute' where number=$1`, [s.number]);
      expect((await ord.resumePayment({ number: s.number, token: s.token })).ok).toBe(false);
    });
  });

  describe('tracking and the account', () => {
    it('tracking needs the right email or phone; the token is only returned on a match', async () => {
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const s = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]);
      expect(await ord.trackOrder(s.number, 'ada@example.com')).toBe(s.token);
      expect(await ord.trackOrder(s.number, '+2348031234567')).toBe(s.token);
      expect(await ord.trackOrder(s.number, '08031234567')).toBe(s.token);
      expect(await ord.trackOrder(s.number, 'someone@else.com')).toBeNull();
      expect(await ord.trackOrder('PM-99999', 'ada@example.com')).toBeNull();
    });

    it('account overview lists orders (by profile and by verified email), addresses, wishlist and credit', async () => {
      const uid = await makeUser('ada@example.com', 150000);
      const tee = await variantId('SEEK-FIRST-TEE-BLACK-M');
      const mine = await svc.createOrderAndInitPayment({ lines: [{ id: 't', kind: 'variant', refId: tee, quantity: 1 }], state: 'Lagos' } as never, details, { profileId: uid });
      const guest = await start([{ id: 't', kind: 'variant', refId: tee, quantity: 1 }]);                                    // placed as a guest with the same email
      const stranger = await svc.createOrderAndInitPayment({ lines: [{ id: 't', kind: 'variant', refId: tee, quantity: 1 }], state: 'Lagos' } as never, { ...details, email: 'other@example.com' }, {});
      const ov = await acct.getOverview(uid);
      const numbers = ov!.orders.map((o) => o.number);
      expect(numbers).toEqual(expect.arrayContaining([mine.ok ? mine.number : '', guest.number]));
      expect(numbers).not.toContain(stranger.ok ? stranger.number : 'x');
      expect(ov!.profile.store_credit_kobo).toBe(150000);
    });

    it('addresses: first is default, default can move, deleting the default promotes another; only the owner can change them', async () => {
      const uid = await makeUser('ada@example.com'); const other = await makeUser('o@example.com');
      const base = { recipient: 'Ada', phone: '+2348031234567', line1: '1 Street', area: null, city: 'Ikeja', state: 'Lagos' };
      const a1 = (await acct.call<{ id: string }>('address_save', { profile_id: uid, ...base }))!.id;
      const a2 = (await acct.call<{ id: string }>('address_save', { profile_id: uid, ...base, line1: '2 Street', state: 'Ogun' }))!.id;
      let rows = await q<{ id: string; is_default: boolean; delivery_zone_id: string | null }>('select id, is_default, delivery_zone_id from public.addresses where profile_id=$1', [uid]);
      expect(rows.find((r) => r.id === a1)!.is_default).toBe(true); expect(rows.find((r) => r.id === a2)!.is_default).toBe(false);
      expect(rows.every((r) => r.delivery_zone_id)).toBe(true);
      await acct.call('address_save', { profile_id: uid, id: a2, ...base, state: 'Ogun', is_default: true });
      rows = await q('select id, is_default from public.addresses where profile_id=$1', [uid]);
      expect(rows.find((r) => r.id === a2)!.is_default).toBe(true); expect(rows.find((r) => r.id === a1)!.is_default).toBe(false);
      expect(await acct.call('address_save', { profile_id: other, id: a1, ...base })).toMatchObject({ ok: false });       // not yours
      await acct.call('address_delete', { profile_id: other, id: a2 });                                                     // ignored
      expect((await q('select 1 from public.addresses where profile_id=$1', [uid])).length).toBe(2);
      await acct.call('address_delete', { profile_id: uid, id: a2 });
      expect((await one<{ is_default: boolean }>('select is_default from public.addresses where profile_id=$1', [uid])).is_default).toBe(true);
    });

    it('wishlist toggles and profile updates', async () => {
      const uid = await makeUser('ada@example.com');
      const pid = (await one<{ id: string }>(`select id from public.products where slug='seek-first-tee'`)).id;
      expect(await acct.call('wishlist_toggle', { profile_id: uid, product_id: pid })).toEqual({ on: true });
      expect((await acct.getOverview(uid))!.wishlist).toEqual([pid]);
      expect(await acct.call('wishlist_toggle', { profile_id: uid, product_id: pid })).toEqual({ on: false });
      await acct.call('profile_update', { profile_id: uid, full_name: 'Ada Obi', phone: '+2348031234567' });
      expect((await acct.getOverview(uid))!.profile).toMatchObject({ full_name: 'Ada Obi', phone: '+2348031234567' });
    });
  });
});
