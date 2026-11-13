import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, one, pool, q, reset } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Migrations 0019–0022: detailed staff roles, media library, product status + CSV import, payments health. */
describe.skipIf(!TEST_DB)('admin capabilities (0019–0022)', () => {
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let owner: string, staff: string, editor: string;
  beforeAll(async () => { rpc = (await (await import('@/lib/db')).getRpc())! as never; });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    owner = await makeUser('owner@example.com'); staff = await makeUser('staff@example.com'); editor = await makeUser('editor@example.com');
    await q(`update public.profiles set role='admin' where id=$1`, [owner]);
    await q(`update public.profiles set role='staff' where id = any($1)`, [[staff, editor]]);
  });
  const call = (fn: string, actor: string | null, extra: Json = {}) => rpc(fn, { actor, ...extra });
  const allowed = async (fn: string, actor: string, extra: Json = {}) => { const r = await call(fn, actor, extra); return !r.error || !/forbidden/.test(r.error.message); };
  const setPerms = (id: string, permissions: string[], preset: string | null = null) => call('admin_set_permissions', owner, { id, permissions, preset });

  describe('detailed roles', () => {
    it('staff without a role keep exactly the old Staff access', async () => {
      expect(await allowed('admin_orders_list', staff)).toBe(true);
      expect(await allowed('admin_board', staff)).toBe(true);
      expect(await allowed('admin_customers_list', staff)).toBe(true);
      expect(await allowed('admin_reviews_list', staff)).toBe(true);
      expect(await allowed('admin_catalogue_list', staff)).toBe(false);
      expect(await allowed('admin_website_history', staff)).toBe(false);
      expect(await allowed('admin_reports', staff)).toBe(false);
    });

    it('a Content Editor can edit the website and media but not orders, money or settings', async () => {
      expect((await setPerms(editor, ['content', 'marketing', 'reviews'], 'content_editor')).error).toBeNull();
      expect(await allowed('admin_website_history', editor)).toBe(true);
      expect(await allowed('admin_media_list', editor)).toBe(true);
      expect(await allowed('admin_discounts_list', editor)).toBe(true);
      expect((await call('admin_save', editor, { table: 'discount_codes', row: { code: 'EDITOR5', type: 'percentage', value: 5 } })).error).toBeNull();
      for (const fn of ['admin_orders_list', 'admin_customers_list', 'admin_catalogue_list', 'admin_settings_get', 'admin_team_list', 'admin_activity_list', 'admin_commissions_pay', 'admin_crypto_confirm', 'admin_payments_health'])
        expect(await allowed(fn, editor), fn).toBe(false);
      expect((await call('admin_save', editor, { table: 'products', row: { slug: 'x', name: 'X', type: 'tee', base_price_kobo: 1 } })).error?.message).toContain('forbidden');
      expect((await call('admin_save', editor, { table: 'delivery_zones', row: { name: 'X' } })).error?.message).toContain('forbidden');
    });

    it('a Store Manager can run the catalogue and reports', async () => {
      await setPerms(staff, ['orders', 'fulfilment', 'customers', 'reviews', 'catalogue', 'reports'], 'store_manager');
      expect(await allowed('admin_catalogue_list', staff)).toBe(true);
      expect(await allowed('admin_reports', staff, { from: '2026-01-01', to: '2026-12-31' })).toBe(true);
      expect(await allowed('admin_products_import', staff, { rows: [], dry_run: true })).toBe(true);
      expect(await allowed('admin_website_history', staff)).toBe(false);
      expect(await allowed('admin_settings_get', staff)).toBe(false);
    });

    it('only admins change permissions; bad input is refused; changes are audited', async () => {
      expect((await call('admin_set_permissions', staff, { id: editor, permissions: ['content'] })).error?.message).toContain('forbidden');
      expect((await setPerms(editor, ['everything'])).error?.message).toContain('invalid_permission');
      expect((await setPerms(editor, [])).error?.message).toContain('permission_required');
      expect((await setPerms(owner, ['content'])).error?.message).toContain('not_staff');
      await setPerms(editor, ['content']);
      const log = (await call('admin_activity_list', owner, { table: 'staff_permissions' })).data;
      expect(log.rows[0]).toMatchObject({ actor_email: 'owner@example.com', action: 'insert' });
    });

    it('staff cannot read or write the permissions table directly', async () => {
      const grants = await q<Json>(`select grantee from information_schema.role_table_grants where table_name in ('staff_permissions','admin_function_permissions','media_assets','payment_events') and grantee in ('anon','authenticated')`);
      expect(grants).toEqual([]);
    });

    it('a customer or a missing actor is always refused', async () => {
      const cust = await makeUser('cust@example.com');
      expect(await allowed('admin_orders_list', cust)).toBe(false);
      expect((await call('admin_orders_list', null)).error?.message).toContain('forbidden');
    });

    it('team list shows each staff member\'s permissions', async () => {
      await setPerms(editor, ['content'], null);
      const team = (await call('admin_team_list', owner)).data as Json[];
      expect(team.find((m) => m.email === 'editor@example.com')).toMatchObject({ permissions: ['content'] });
      expect(team.find((m) => m.email === 'staff@example.com')).toMatchObject({ permissions: ['orders', 'fulfilment', 'customers', 'reviews'] });
      expect((await rpc('staff_permissions_get', { id: owner })).data).toMatchObject({ role: 'admin' });
    });
  });

  describe('media library', () => {
    it('registers uploads, edits alt text, shows usage and refuses deleting images in use', async () => {
      const reg = await call('admin_media_register', owner, { url: '/uploads/test-a.jpg', path: 'test-a.jpg', filename: 'a.jpg', size: 1234, mime: 'image/jpeg' });
      expect(reg.error).toBeNull();
      expect((await call('admin_media_update', owner, { id: reg.data.id, alt: 'A black tee' })).error).toBeNull();
      const list = (await call('admin_media_list', owner, { q: 'black tee' })).data;
      expect(list.items[0]).toMatchObject({ url: '/uploads/test-a.jpg', alt: 'A black tee', used: [] });
      // In use by a product photo: delete is refused and says where.
      const prod = await one<{ id: string }>(`select id from public.products where slug like '%tee%' limit 1`);
      await q(`insert into public.product_images (product_id, url, alt) values ($1, '/uploads/test-a.jpg', 'x')`, [prod.id]);
      const refused = (await call('admin_media_delete', owner, { id: reg.data.id })).data;
      expect(refused).toMatchObject({ ok: false, error: 'in_use' });
      await q(`delete from public.product_images where url = '/uploads/test-a.jpg'`);
      expect((await call('admin_media_delete', owner, { id: reg.data.id })).data).toMatchObject({ ok: true, path: 'test-a.jpg' });
    });

    it('the migration adds images the store already uses to the library', async () => {
      // In production the catalogue exists before 0020 runs; here the seed runs after migrations, so run the backfill again.
      const sql = readFileSync('supabase/migrations/0020_media_library.sql', 'utf8');
      const backfill = sql.slice(sql.indexOf('insert into public.media_assets (url, filename, alt)'), sql.indexOf('on conflict (url) do nothing;') + 'on conflict (url) do nothing;'.length);
      await q(backfill);
      const n = Number((await one<{ n: string }>(`select count(*) n from public.media_assets`)).n);
      expect(n).toBeGreaterThan(5);
      expect(await one(`select 1 x from public.media_assets where url like '/placeholders/%'`)).toBeUndefined();
    });

    it('rejects unsafe URLs', async () => {
      expect((await call('admin_media_register', owner, { url: 'javascript:alert(1)', filename: 'x' })).error?.message).toMatch(/media_url_safe|check/);
    });
  });

  describe('product status and CSV import', () => {
    const row = (over: Json = {}) => ({ line: 2, slug: 'csv-tee', name: 'CSV Tee', type: 'tee', price_kobo: 2000000, status: 'draft', variants: [{ line: 2, sku: 'CSV-TEE-M', size: 'M', stock_qty: 5 }], ...over });

    it('dry run changes nothing; import is all-or-nothing', async () => {
      const dry = (await call('admin_products_import', owner, { rows: [row()], dry_run: true })).data;
      expect(dry).toMatchObject({ products_created: 1, variants_created: 1, errors: [] });
      expect(await one(`select 1 x from public.products where slug='csv-tee'`)).toBeUndefined();

      const bad = await call('admin_products_import', owner, { rows: [row(), row({ line: 3, slug: 'csv-other', collection_slug: 'nope', variants: [] })], dry_run: false });
      expect(bad.error?.message).toContain('import_errors');
      expect(await one(`select 1 x from public.products where slug='csv-tee'`)).toBeUndefined();

      expect((await call('admin_products_import', owner, { rows: [row()], dry_run: false })).error).toBeNull();
      const p = await one<Json>(`select status, is_active from public.products where slug='csv-tee'`);
      expect(p).toMatchObject({ status: 'draft', is_active: false });
      expect(await one<Json>(`select delta, reason from public.inventory_adjustments where reason like 'CSV%'`)).toMatchObject({ delta: 5 });
    });

    it('re-importing updates by slug and SKU, and logs stock changes', async () => {
      await call('admin_products_import', owner, { rows: [row()], dry_run: false });
      const r = (await call('admin_products_import', owner, { rows: [row({ price_kobo: 2500000, status: 'active', variants: [{ line: 2, sku: 'CSV-TEE-M', stock_qty: 8 }] })], dry_run: false })).data;
      expect(r).toMatchObject({ products_updated: 1, variants_updated: 1, stock_changes: 1 });
      expect(await one<Json>(`select base_price_kobo::int p, status, is_active from public.products where slug='csv-tee'`)).toMatchObject({ p: 2500000, status: 'active', is_active: true });
      expect(await one<Json>(`select stock_qty from public.product_variants where sku='CSV-TEE-M'`)).toMatchObject({ stock_qty: 8 });
    });

    it('refuses to move a SKU that belongs to another product', async () => {
      const sku = (await one<{ sku: string }>(`select sku from public.product_variants limit 1`)).sku;
      const r = (await call('admin_products_import', owner, { rows: [row({ variants: [{ line: 2, sku }] })], dry_run: true })).data;
      expect(r.errors[0].message).toContain('belongs to another product');
    });

    it('status and visibility stay in step both ways; archived products stay archived when hidden', async () => {
      await call('admin_products_import', owner, { rows: [row({ status: 'active' })], dry_run: false });
      const id = (await one<{ id: string }>(`select id from public.products where slug='csv-tee'`)).id;
      await call('admin_products_set_status', owner, { ids: [id], status: 'archived' });
      expect(await one<Json>(`select status, is_active from public.products where id=$1`, [id])).toMatchObject({ status: 'archived', is_active: false });
      await q(`update public.products set is_active = false where id=$1`, [id]);
      expect((await one<Json>(`select status from public.products where id=$1`, [id])).status).toBe('archived');
      await call('admin_save', owner, { table: 'products', row: { id, is_active: true } });
      expect((await one<Json>(`select status from public.products where id=$1`, [id])).status).toBe('active');
    });

    it('exports one row per variant', async () => {
      const rows = (await call('admin_products_export', owner)).data as Json[];
      expect(rows.length).toBeGreaterThan(10);
      expect(rows[0]).toHaveProperty('sku');
      expect(rows.every((r) => r.type !== 'gift_card')).toBe(true);
    });
  });

  describe('payments health', () => {
    it('summarises webhooks and payments for admins only', async () => {
      await rpc('payment_event_log', { kind: 'webhook_received', event: 'charge.success', reference: 'r1' });
      await rpc('payment_event_log', { kind: 'webhook_rejected' });
      const h = (await call('admin_payments_health', owner)).data;
      expect(h).toMatchObject({ webhooks_7d: 1, rejected_7d: 1 });
      expect(h.last_webhook_at).toBeTruthy();
      expect(await allowed('admin_payments_health', staff)).toBe(false);
    });
  });
});
