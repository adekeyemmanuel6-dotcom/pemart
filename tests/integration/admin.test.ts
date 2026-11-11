import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, one, pool, q, reset, variantId } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_admin';
delete process.env.RESEND_API_KEY;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const details = (email = 'ada@example.com', name = 'Ada Obi') => ({ email, phone: '+2348031234567', isGift: false, address: { recipient: name, phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } });

describe.skipIf(!TEST_DB)('admin functions against real Postgres', () => {
  let svc: typeof import('@/lib/checkout/service');
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string, staff: string, customer: string;
  beforeAll(async () => {
    svc = await import('@/lib/checkout/service');
    rpc = (await (await import('@/lib/db')).getRpc())! as never;
  });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    await q(`delete from public.products where slug in ('test-tee','gen-tee','gen-brace'); delete from public.bundles where slug = 'test-box'`);
    admin = await makeUser('admin@example.com'); staff = await makeUser('staff@example.com'); customer = await makeUser('cust@example.com');
    await q(`update public.profiles set role='admin' where id=$1`, [admin]); await q(`update public.profiles set role='staff' where id=$1`, [staff]);
  });
  const call = (fn: string, actor: string | null, extra: Json = {}) => rpc(fn, { actor, ...extra });
  const ok = async (fn: string, actor: string, extra: Json = {}) => { const r = await call(fn, actor, extra); if (r.error) throw new Error(`${fn}: ${r.error.message}`); return r.data; };
  const forbidden = async (fn: string, actor: string | null, extra: Json = {}) => { const r = await call(fn, actor, extra); expect(r.error?.message, `${fn} as ${actor}`).toMatch(/forbidden/); };

  const place = async (lines: object[], d = details(), extra: Json = {}, pay = true) => {
    const r = await svc.createOrderAndInitPayment({ lines, state: 'Lagos', acceptFinalSale: true, ...extra } as never, d, {});
    if (!r.ok || r.mode !== 'pay') throw new Error(r.ok ? 'free' : r.message);
    if (pay) await svc.settlePayment(r.reference, { source: 'webhook', amountKobo: r.totalKobo, currency: 'NGN', payload: {} });
    return r;
  };
  const tee = async (sku = 'SEEK-FIRST-TEE-BLACK-M') => ({ id: crypto.randomUUID(), kind: 'variant', refId: await variantId(sku), quantity: 1 });

  describe('who can do what', () => {
    it('customers and anonymous callers are refused everywhere', async () => {
      for (const fn of ['admin_overview', 'admin_orders_list', 'admin_order_get', 'admin_board', 'admin_proofs_queue', 'admin_quotes_list', 'admin_reviews_list', 'admin_customers_list', 'admin_reports', 'admin_catalogue_list', 'admin_discounts_list', 'admin_settings_get'])
        for (const who of [customer, null]) await forbidden(fn, who, { number: 'PM-1', from: '2026-01-01', to: '2026-01-02' });
      await forbidden('admin_set_status', customer, { order_id: crypto.randomUUID(), to: 'in_production' });
      await forbidden('admin_save', customer, { table: 'products', row: { name: 'x' } });
    });

    it('staff can run operations but never settings, discounts, reports, catalogue or inventory edits', async () => {
      for (const fn of ['admin_overview', 'admin_orders_list', 'admin_board', 'admin_proofs_queue', 'admin_quotes_list', 'admin_reviews_list', 'admin_customers_list', 'admin_inventory_log']) await ok(fn, staff);
      const adminOnly: [string, Json][] = [
        ['admin_reports', { from: '2026-01-01', to: '2026-01-02' }], ['admin_catalogue_list', {}], ['admin_discounts_list', {}], ['admin_settings_get', {}],
        ['admin_settings_save', { settings: { announcement_text: 'hacked' } }], ['admin_save', { table: 'discount_codes', row: { code: 'FREE', type: 'percentage', value: 100 } }],
        ['admin_save', { table: 'products', row: { name: 'x' } }], ['admin_bundle_save', { bundle: { slug: 'x', name: 'x', kind: 'combo', price_kobo: 1 } }],
        ['admin_images_save', { product_id: crypto.randomUUID(), images: [] }], ['admin_variants_generate', { product_id: crypto.randomUUID() }],
        ['admin_inventory_adjust', { variant_id: crypto.randomUUID(), delta: 5, reason: 'free stock' }], ['admin_ambassador_create', { name: 'x', code: 'HACK10' }],
        ['admin_commissions_pay', { ambassador_id: crypto.randomUUID() }], ['admin_product_get', { id: crypto.randomUUID() }], ['admin_bundle_get', { id: crypto.randomUUID() }],
      ];
      for (const [fn, extra] of adminOnly) await forbidden(fn, staff, extra);
      expect((await one<{ announcement_text: string }>('select announcement_text from public.settings')).announcement_text).not.toBe('hacked');
      expect((await q(`select 1 from public.discount_codes where code='FREE'`)).length).toBe(0);
    });

    it('admins can do everything above', async () => {
      for (const fn of ['admin_catalogue_list', 'admin_discounts_list', 'admin_settings_get']) await ok(fn, admin);
      await ok('admin_reports', admin, { from: '2026-01-01', to: '2026-01-02' });
    });

    it('a role change takes effect immediately (no stale permissions)', async () => {
      await ok('admin_orders_list', staff);
      await q(`update public.profiles set role='customer' where id=$1`, [staff]);
      await forbidden('admin_orders_list', staff);
    });
  });

  describe('overview', () => {
    it('staff get operational numbers only; admins also get revenue', async () => {
      expect((await ok('admin_overview', staff)).revenue).toBeNull();
      expect((await ok('admin_overview', admin)).revenue).not.toBeNull();
    });
    it('computes revenue, AOV, bundle share, conversion, at-risk, proofs and low stock', async () => {
      const a = await place([await tee()]);
      await place([{ id: 'b', kind: 'bundle', refId: 'starter', quantity: 1, selection: (await import('../helpers/checkout')).bundleSelection('starter', {}, await (await import('@/lib/catalogue/load')).getCatalogue()) }], details('b@example.com', 'Bola'));
      await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('c@example.com', 'Chi'), {}, false);          // started, never paid
      await q(`update public.orders set promised_by = now() + interval '10 hours' where number=$1`, [a.number]);
      await q(`update public.product_variants set stock_qty = 3 where sku='FAITH-BRACELET-DOVE'`);
      const o = await ok('admin_overview', admin);
      expect(o.revenue.today_orders).toBe(2);
      expect(o.revenue.today_revenue).toBe(2550000 + 2500000 + 350000);
      expect(o.revenue.aov).toBe(Math.round((2550000 + 2850000) / 2));
      expect(o.revenue.bundle_share).toBe(50);
      expect(o.revenue.conversion).toBe(67);                                                                   // 2 of 3 checkouts paid
      expect(o.at_risk.map((x: Json) => x.number)).toContain(a.number);
      expect(o.due_48h).toBeGreaterThanOrEqual(1);
      expect(o.low_stock.map((x: Json) => x.sku)).toContain('FAITH-BRACELET-DOVE');
    });
    it('counts proofs waiting and overdue against each tier\'s promise', async () => {
      const mk = async (tier: string) => ((await rpc('custom_request_create', { actor: null, tier, product_type: 'tee', colour: 'Black', print_positions: ['back'], text_fields: { size: 'M' }, upload_paths: [], fee_kobo: 300000 })).data as Json).id as string;
      const [p1, p2] = [await mk('personalise'), await mk('text_design')];
      const r = await place([{ id: 'a', kind: 'custom', refId: p1, quantity: 1 }, { id: 'b', kind: 'custom', refId: p2, quantity: 1 }]);
      await q(`update public.orders set paid_at = now() - interval '13 hours' where number=$1`, [r.number]);
      const o = await ok('admin_overview', staff);
      expect(o.proofs_waiting).toBe(2);
      expect(o.proofs_overdue).toBe(1);                                                                        // personalise promised 12h, text design 24h
    });
  });

  describe('orders', () => {
    it('search by number, name, email and phone; filters by status, zone, custom, promise dates; pagination; unpaid hidden by default', async () => {
      const a = await place([await tee()], details('ada@example.com', 'Ada Obi'));
      const b = await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('tunde@example.com', 'Tunde Bello'), { state: 'Ogun' });
      await place([await tee('SEEK-FIRST-TEE-BLACK-XL')], details('pending@example.com', 'Pending Person'), {}, false);
      const list = async (f: Json = {}) => (await ok('admin_orders_list', staff, f)) as { total: number; rows: Json[] };
      expect((await list()).total).toBe(2);
      expect((await list({ include_unpaid: true })).total).toBe(3);
      expect((await list({ q: a.number.slice(3) })).rows.map((r) => r.number)).toEqual([a.number]);
      expect((await list({ q: 'tunde' })).rows.map((r) => r.number)).toEqual([b.number]);
      expect((await list({ q: 'Bello' })).total).toBe(1);
      expect((await list({ q: '803 123 4567' })).total).toBe(2);
      expect((await list({ status: ['paid'] })).total).toBe(2);
      expect((await list({ status: ['pending_payment'] })).total).toBe(1);
      expect((await list({ zone: 'Lagos' })).total).toBe(1);
      expect((await list({ custom: 'true' })).total).toBe(0);
      expect((await list({ custom: 'false' })).total).toBe(2);
      const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      expect((await list({ promised_from: day, promised_to: day })).total).toBeGreaterThanOrEqual(1);
      expect((await list({ promised_from: '2030-01-01' })).total).toBe(0);
      const page1 = await list({ per_page: 1, page: 1 }), page2 = await list({ per_page: 1, page: 2 });
      expect(page1.total).toBe(2); expect(page1.rows[0]!.number).not.toBe(page2.rows[0]!.number);
    });
    it('order detail has items, events, payments, custom briefs and commission', async () => {
      const r = await place([await tee()], details(), { code: 'GRACE10' });
      const o = await ok('admin_order_get', staff, { number: r.number });
      expect(o.items.length).toBe(1); expect(o.events.map((e: Json) => e.status)).toEqual(expect.arrayContaining(['pending_payment', 'paid']));
      expect(o.payments[0]).toMatchObject({ status: 'success' }); expect(o.commission.status).toBe('pending');
      expect(o.reservations).toBeUndefined();
      expect(await ok('admin_order_get', staff, { number: 'PM-99999' })).toBeNull();
    });
    it('staff can write internal notes and move statuses, and every change is recorded with who did it', async () => {
      const r = await place([await tee()]); const id = (await one<{ id: string }>('select id from public.orders where number=$1', [r.number])).id;
      await ok('admin_order_note', staff, { order_id: id, notes: 'Customer wants a call' });
      expect((await one<{ notes: string }>('select notes from public.orders where id=$1', [id])).notes).toBe('Customer wants a call');
      expect((await ok('admin_set_status', staff, { order_id: id, to: 'in_production', note: 'Started' })).ok).toBe(true);
      expect((await ok('admin_set_status', staff, { order_id: id, to: 'delivered' })).ok).toBe(false);
      const ev = await one<{ actor: string }>(`select actor from public.order_events where order_id=$1 and status='in_production'`, [id]);
      expect(ev.actor).toBe(staff);
    });
  });

  describe('production board', () => {
    it('lists live orders sorted by promise, flags due-soon, and drops old deliveries', async () => {
      const a = await place([await tee()]); const b = await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('b@example.com', 'Bola'));
      const c = await place([await tee('SEEK-FIRST-TEE-BLACK-XL')], details('c@example.com', 'Chi'));
      await q(`update public.orders set promised_by = now() + interval '8 hours' where number=$1`, [a.number]);
      await q(`update public.orders set status='delivered', delivered_at = now() - interval '9 days' where number=$1`, [c.number]);
      const board = await ok('admin_board', staff) as Json[];
      expect(board.map((o) => o.number)).toEqual([a.number, b.number]);
      expect(board[0]!.due_soon).toBe(true); expect(board[1]!.due_soon).toBe(false);
    });
  });

  describe('proofs queue', () => {
    it('shows briefs, uploads and how long each has waited versus the tier promise', async () => {
      const id = ((await rpc('custom_request_create', { actor: null, tier: 'full_custom', product_type: 'hoodie', colour: 'Black', print_positions: ['back'], text_fields: { size: 'M' }, notes: 'A lion with a crown', upload_paths: ['guest/x/y.png'], fee_kobo: 1500000 })).data as Json).id;
      const r = await place([{ id: 'a', kind: 'custom', refId: id, quantity: 1 }]);
      const queue = await ok('admin_proofs_queue', staff) as Json[];
      expect(queue.length).toBe(1);
      expect(queue[0]).toMatchObject({ order_number: r.number, tier: 'full_custom', promise_hours: 48, overdue: false, notes: 'A lion with a crown', status: 'awaiting_proof' });
      expect(queue[0]!.upload_paths).toEqual(['guest/x/y.png']);
      await q(`update public.orders set paid_at = now() - interval '50 hours' where number=$1`, [r.number]);
      expect(((await ok('admin_proofs_queue', staff)) as Json[])[0]!.overdue).toBe(true);
      expect((await ok('admin_proof_send', staff, { custom_request_id: id, path: '/p.svg', message: 'v1' })).ok).toBe(true);
      expect(((await ok('admin_proofs_queue', staff)) as Json[])[0]!.status).toBe('proof_sent');           // still listed, now waiting on the customer
    });
  });

  describe('reports (admin)', () => {
    it('totals, by-day with zero days, bestsellers, bundles, zones, ambassadors and the date range', async () => {
      await place([await tee()], details(), { code: 'GRACE10' });
      await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('b@example.com', 'Bola'), { state: 'Ogun' });
      const old = await place([await tee('SEEK-FIRST-TEE-BLACK-XL')], details('old@example.com', 'Old'));
      await q(`update public.orders set paid_at = now() - interval '20 days' where number=$1`, [old.number]);
      const today = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const rep = await ok('admin_reports', admin, { from, to: today });
      expect(rep.totals.orders).toBe(2);
      expect(rep.totals.revenue).toBe((2550000 - 220000) + 2750000);
      expect(rep.by_day.length).toBe(4);
      expect(rep.by_day.filter((d: Json) => d.orders === 0).length).toBe(3);
      expect(rep.designs[0]).toMatchObject({ name: 'Seek First', qty: 2 });
      expect(rep.products[0].name).toBe('Seek First Oversized Tee');
      expect(rep.collections[0]).toMatchObject({ name: 'Kingdom' });
      expect(rep.zones.map((z: Json) => z.name).sort()).toEqual(['Lagos', 'South-West']);
      expect(rep.ambassadors[0]).toMatchObject({ code: 'GRACE10', orders: 1, commission: 220000 });
      const wide = await ok('admin_reports', admin, { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today });
      expect(wide.totals.orders).toBe(3);
    });
  });

  describe('customers', () => {
    it('groups by email with order count, lifetime spend, last order and store credit; searchable; exportable size', async () => {
      await place([await tee()], details('ada@example.com', 'Ada Obi')); await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('ada@example.com', 'Ada Obi'));
      await place([await tee('SEEK-FIRST-TEE-BLACK-XL')], details('tunde@example.com', 'Tunde'));
      await q(`insert into auth.users (email) values ('ada@example.com')`); await q(`update public.profiles set store_credit_kobo = 200000 where lower(email)='ada@example.com'`);
      const r = await ok('admin_customers_list', staff) as { total: number; rows: Json[] };
      expect(r.total).toBe(2);
      const ada = r.rows.find((x) => x.email === 'ada@example.com')!;
      expect(ada).toMatchObject({ orders: 2, spend: 5100000, store_credit_kobo: 200000, has_account: true });
      expect((await ok('admin_customers_list', staff, { q: 'tund' })).total).toBe(1);
      expect((await ok('admin_customers_list', staff, { per_page: 5000 })).rows.length).toBe(2);
    });
  });

  describe('catalogue editing (admin)', () => {
    it('saves only whitelisted columns of whitelisted tables', async () => {
      expect((await call('admin_save', admin, { table: 'profiles', row: { role: 'admin' } })).error?.message).toMatch(/bad_table/);
      const code = (await ok('admin_save', admin, { table: 'discount_codes', row: { code: 'SAVE5', type: 'fixed', value: 500000, times_used: 99, ambassador_id: crypto.randomUUID() } })).id;
      expect(await one<Json>('select times_used, ambassador_id from public.discount_codes where id=$1', [code])).toEqual({ times_used: 0, ambassador_id: null });
      await ok('admin_save', admin, { table: 'discount_codes', row: { id: code, value: 700000, is_active: false } });
      expect(await one<Json>('select value, is_active, code from public.discount_codes where id=$1', [code])).toMatchObject({ value: '700000', is_active: false, code: 'SAVE5' });
      expect((await call('admin_save', admin, { table: 'discount_codes', row: { code: 'SAVE5', type: 'fixed', value: 1 } })).error?.message).toMatch(/duplicate|unique/i);
      expect((await call('admin_save', admin, { table: 'discount_codes', row: { code: 'BAD', type: 'percentage', value: 500 } })).error?.message).toMatch(/check/i);
      expect((await call('admin_save', admin, { table: 'products', row: { id: crypto.randomUUID(), name: 'ghost' } })).error?.message).toMatch(/not_found/);
    });
    it('creates and edits products; editing keeps untouched fields', async () => {
      const id = (await ok('admin_save', admin, { table: 'products', row: { slug: 'test-tee', name: 'Test Tee', type: 'tee', base_price_kobo: 2200000, description: 'Nice', is_made_to_order: true } })).id;
      await ok('admin_save', admin, { table: 'products', row: { id, name: 'Test Tee v2', compare_at_kobo: 2500000 } });
      expect(await one<Json>('select name, description, compare_at_kobo, is_active from public.products where id=$1', [id])).toMatchObject({ name: 'Test Tee v2', description: 'Nice', compare_at_kobo: '2500000', is_active: true });
      await ok('admin_save', admin, { table: 'products', row: { id, compare_at_kobo: null } });
      expect((await one<Json>('select compare_at_kobo from public.products where id=$1', [id])).compare_at_kobo).toBeNull();
    });
    it('bulk-generates colour x size variants idempotently', async () => {
      const id = (await ok('admin_save', admin, { table: 'products', row: { slug: 'gen-tee', name: 'Gen Tee', type: 'tee', base_price_kobo: 2200000, is_made_to_order: true } })).id;
      const r1 = await ok('admin_variants_generate', admin, { product_id: id, colours: ['Black', 'Sand'], sizes: ['S', 'M', 'L'] });
      expect(r1.created).toBe(6);
      expect((await ok('admin_variants_generate', admin, { product_id: id, colours: ['Black', 'Sand', 'Navy'], sizes: ['S', 'M', 'L'] })).created).toBe(3);
      const skus = (await q<{ sku: string }>('select sku from public.product_variants where product_id=$1', [id])).map((s) => s.sku);
      expect(skus).toContain('GEN-TEE-BLACK-S'); expect(new Set(skus).size).toBe(9);
      const pid = (await ok('admin_save', admin, { table: 'products', row: { slug: 'gen-brace', name: 'Gen Bracelet', type: 'bracelet', base_price_kobo: 600000 } })).id;
      expect((await ok('admin_variants_generate', admin, { product_id: pid, options: ['Cross', 'Dove'], stock_qty: 10 })).created).toBe(2);
      expect((await one<Json>(`select stock_qty from public.product_variants where sku='GEN-BRACE-CROSS'`)).stock_qty).toBe(10);
    });
    it('inventory adjustments need a reason, cannot go below zero, skip made-to-order, and leave a log', async () => {
      const v = await variantId('FAITH-BRACELET-CROSS'), mto = await variantId('SEEK-FIRST-TEE-BLACK-M');
      expect((await ok('admin_inventory_adjust', admin, { variant_id: v, delta: 5, reason: '' })).error).toBe('reason_required');
      expect((await ok('admin_inventory_adjust', admin, { variant_id: v, delta: -999, reason: 'damaged' })).error).toBe('below_zero');
      expect((await ok('admin_inventory_adjust', admin, { variant_id: mto, delta: 5, reason: 'count' })).error).toBe('made_to_order');
      expect(await ok('admin_inventory_adjust', admin, { variant_id: v, delta: -3, reason: 'Damaged in storage' })).toEqual({ ok: true, stock_qty: 37 });
      const log = await ok('admin_inventory_log', staff, { variant_id: v }) as Json[];
      expect(log[0]).toMatchObject({ delta: -3, reason: 'Damaged in storage', sku: 'FAITH-BRACELET-CROSS' }); expect(log[0]!.actor).toBeTruthy();
    });
    it('saves images in order, with alt text, and removes the ones dropped', async () => {
      const pid = (await one<{ id: string }>(`select id from public.products where slug='faith-bracelet'`)).id;
      await ok('admin_images_save', admin, { product_id: pid, images: [{ url: '/a.jpg', alt: 'A', view: 'front' }, { url: '/b.jpg', alt: 'B', view: 'back' }, { url: '/c.jpg', alt: 'C', view: 'detail' }] });
      let rows = await q<{ id: string; url: string; alt: string; sort_order: number }>('select id, url, alt, sort_order from public.product_images where product_id=$1 order by sort_order', [pid]);
      expect(rows.map((r) => r.url)).toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
      await ok('admin_images_save', admin, { product_id: pid, images: [{ id: rows[2]!.id, url: '/c.jpg', alt: 'C new alt', view: 'detail' }, { id: rows[0]!.id, url: '/a.jpg', alt: 'A', view: 'front' }] });
      rows = await q('select id, url, alt, sort_order from public.product_images where product_id=$1 order by sort_order', [pid]);
      expect(rows.map((r) => [r.url, r.alt])).toEqual([['/c.jpg', 'C new alt'], ['/a.jpg', 'A']]);
    });
    it('saves a bundle with its slot rules and replaces the slots on edit', async () => {
      const id = (await ok('admin_bundle_save', admin, { bundle: { slug: 'test-box', name: 'Test Box', kind: 'combo', price_kobo: 3000000 }, slots: [{ label: 'A tee', product_type: 'tee', requires_size: true, requires_colour: true }, { label: 'A pendant', product_type: 'jewellery', requires_option: true, option_label: 'Style' }] })).id;
      expect((await q('select 1 from public.bundle_slots where bundle_id=$1', [id])).length).toBe(2);
      await ok('admin_bundle_save', admin, { bundle: { id, price_kobo: 3200000 }, slots: [{ label: 'Only tee', product_type: 'tee', quantity: 2 }] });
      expect(await one<Json>('select price_kobo, name from public.bundles where id=$1', [id])).toMatchObject({ price_kobo: '3200000', name: 'Test Box' });
      expect((await q<{ label: string; quantity: number }>('select label, quantity from public.bundle_slots where bundle_id=$1', [id]))).toEqual([{ label: 'Only tee', quantity: 2 }]);
    });
    it('the public catalogue export reflects admin edits and hides inactive items', async () => {
      const id = (await one<{ id: string }>(`select id from public.products where slug='faith-bracelet'`)).id;
      await ok('admin_save', admin, { table: 'products', row: { id, name: 'Faith Bracelet Renamed', is_active: false } });
      const cat = (await ok('admin_overview', admin), (await rpc('catalogue_export', {})).data) as Json;
      expect(cat.products.find((p: Json) => p.id === id)).toBeUndefined();
      await ok('admin_save', admin, { table: 'products', row: { id, is_active: true } });
      expect(((await rpc('catalogue_export', {})).data as Json).products.find((p: Json) => p.id === id).name).toBe('Faith Bracelet Renamed');
    });
  });

  describe('ambassadors and discounts', () => {
    it('an ambassador gets a personal 10% code; duplicates are refused; "mark as paid" settles exactly what is owed', async () => {
      const r = await ok('admin_ambassador_create', admin, { name: 'Tolu', code: 'tolu 10!', email: 't@example.com' });
      expect(r).toMatchObject({ ok: true, code: 'TOLU10' });
      expect(await one<Json>(`select type, value, ambassador_id is not null as linked from public.discount_codes where code='TOLU10'`)).toMatchObject({ type: 'percentage', value: '10', linked: true });
      expect((await ok('admin_ambassador_create', admin, { name: 'Dup', code: 'TOLU10' })).error).toBe('code_taken');
      expect((await ok('admin_ambassador_create', admin, { name: 'Dup', code: 'PEMART10' })).error).toBe('code_taken');
      expect((await ok('admin_ambassador_create', admin, { name: 'Short', code: 'ab' })).error).toBe('bad_code');
      await place([await tee()], details(), { code: 'TOLU10' }); await place([await tee('SEEK-FIRST-TEE-BLACK-L')], details('b@example.com'), { code: 'TOLU10' });
      let list = await ok('admin_discounts_list', admin) as { ambassadors: Json[] };
      expect(list.ambassadors.find((a) => a.code === 'TOLU10')).toMatchObject({ orders: 2, sales_kobo: 4400000, owed_kobo: 440000, paid_kobo: 0 });
      expect(await ok('admin_commissions_pay', admin, { ambassador_id: r.id })).toEqual({ ok: true, paid_kobo: 440000 });
      expect(await ok('admin_commissions_pay', admin, { ambassador_id: r.id })).toEqual({ ok: true, paid_kobo: 0 });
      list = await ok('admin_discounts_list', admin);
      expect(list.ambassadors.find((a) => a.code === 'TOLU10')).toMatchObject({ owed_kobo: 0, paid_kobo: 440000 });
    });
    it('a refunded order stops counting toward what is owed', async () => {
      const a = await ok('admin_ambassador_create', admin, { name: 'Tolu', code: 'TOLU10' });
      const o = await place([await tee()], details(), { code: 'TOLU10' });
      const id = (await one<{ id: string }>('select id from public.orders where number=$1', [o.number])).id;
      await ok('admin_set_status', admin, { order_id: id, to: 'refunded', note: 'Refunded in Paystack' });
      expect(await ok('admin_commissions_pay', admin, { ambassador_id: a.id })).toEqual({ ok: true, paid_kobo: 0 });
    });
  });

  describe('bulk quotes', () => {
    const quote = async () => (await one<{ id: string }>(`insert into public.bulk_quotes (name, organisation, phone, email, product_type, quantity, sizes) values ('Pastor Ade','Grace Church','+2348031234567','ade@church.org','tee',40,'{"L":20,"M":20}') returning id`)).id;
    it('moves through the pipeline and turns a won quote into an unpaid order the customer can pay', async () => {
      const id = await quote();
      expect((await ok('admin_quote_to_order', staff, { id, address: { recipient: 'Pastor Ade', phone: '+2348031234567', line1: '1 Church Rd', city: 'Ikeja', state: 'Lagos' } })).error).toBe('no_quoted_amount');
      await ok('admin_quote_update', staff, { id, status: 'quoted', quoted_amount_kobo: 80000000 });
      expect((await call('admin_quote_update', staff, { id, status: 'nonsense' })).error?.message).toMatch(/bad_status/);
      const o = await ok('admin_quote_to_order', staff, { id, address: { recipient: 'Pastor Ade', phone: '+2348031234567', line1: '1 Church Rd', city: 'Ikeja', state: 'Lagos' } });
      expect(o).toMatchObject({ ok: true, total: 80000000 });
      const row = await one<Json>('select status, total_kobo, expires_at, delivery_zone_name from public.orders where number=$1', [o.number]);
      expect(row).toMatchObject({ status: 'pending_payment', total_kobo: '80000000', delivery_zone_name: 'Lagos' });
      expect((new Date(row.expires_at).getTime() - Date.now()) / 86400000).toBeGreaterThan(6.9);
      expect((await one<Json>('select status, order_id from public.bulk_quotes where id=$1', [id])).status).toBe('won');
      expect((await ok('admin_quote_to_order', staff, { id, address: {} })).error).toBe('already_converted');
      // the customer pays through the normal resume-payment link
      const ord = await import('@/lib/orders/service');
      const pay = await ord.resumePayment({ number: o.number, token: o.token });
      if (!pay.ok || pay.mode !== 'pay') throw new Error('resume failed');
      await svc.settlePayment(pay.reference, { source: 'webhook', amountKobo: pay.totalKobo, currency: 'NGN', payload: {} });
      expect((await one<Json>('select status from public.orders where number=$1', [o.number])).status).toBe('paid');
      expect((await ok('admin_quotes_list', staff) as Json[])[0]).toMatchObject({ status: 'won', order_number: o.number });
    });
  });

  describe('reviews and settings', () => {
    it('staff can moderate reviews (credit follows the Phase 5 rules)', async () => {
      const r = await place([await tee()], details('cust@example.com'), {}, true);
      await q(`update public.orders set status='delivered', delivered_at=now() where number=$1`, [r.number]);
      const item = await one<{ id: string }>('select i.id from public.order_items i join public.orders o on o.id=i.order_id where o.number=$1', [r.number]);
      const ord = await import('@/lib/orders/service');
      await ord.submitReview({ number: r.number, token: r.token, orderItemId: item.id, rating: 5, photoUrls: ['/x.jpg'] });
      const list = await ok('admin_reviews_list', staff, { status: 'pending' }) as Json[];
      expect(list[0]).toMatchObject({ rating: 5, order_number: r.number, product: 'Seek First Oversized Tee' });
      expect((await ok('admin_review_moderate', staff, { review_id: list[0]!.id, decision: 'approve' })).credit_granted).toBe(true);
      expect(Number((await one<{ c: string }>(`select store_credit_kobo c from public.profiles where lower(email)='cust@example.com'`)).c)).toBe(200000);
    });
    it('admins save whitelisted settings; ids and unknown fields are ignored; the storefront view updates', async () => {
      await ok('admin_settings_save', admin, { settings: { announcement_text: 'New banner', gift_wrap_kobo: 250000, express_enabled: false, id: false, hacker: 'x', pay_on_delivery_enabled: true } });
      const s = (await rpc('settings_public', {})).data as Json;
      expect(s).toMatchObject({ announcement_text: 'New banner', gift_wrap_kobo: '250000' === s.gift_wrap_kobo ? '250000' : 250000, express_enabled: false });
      expect(Number((await one<{ n: string }>('select count(*) n from public.settings')).n)).toBe(1);
      const full = await ok('admin_settings_get', admin) as Json;
      expect(full.zones.length).toBe(3); expect(full.products.length).toBeGreaterThan(10);
    });
    it('delivery zone fees and cutoffs are editable and used by pricing', async () => {
      const lagos = await one<{ id: string }>(`select id from public.delivery_zones where name='Lagos'`);
      await ok('admin_save', admin, { table: 'delivery_zones', row: { id: lagos.id, fee_kobo: 400000, free_over_kobo: 5000000, christmas_cutoff_date: '2026-12-16' } });
      const r = await svc.quoteCart({ lines: [await tee()], state: 'Lagos' } as never);
      expect(r.deliveryFeeKobo).toBe(400000);
      expect(r.freeDeliveryThresholdKobo).toBe(5000000);
    });
  });
});
