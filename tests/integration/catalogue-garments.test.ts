import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, pool, q, reset } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';

describe.skipIf(!TEST_DB)('sweatshirts, quality and colour photos (migration 0026)', () => {
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string;
  beforeAll(async () => { rpc = (await (await import('@/lib/db')).getRpc())! as never; });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    admin = await makeUser('admin@example.com'); await q(`update public.profiles set role='admin' where id=$1`, [admin]);
  });
  const save = (row: Record<string, unknown>) => rpc('admin_save', { actor: admin, table: 'products', row });

  it('a sweatshirt product with a quality saves, and Normal and Premium T-shirts of one word are separate products', async () => {
    const base = { base_price_kobo: 1_500_000, is_active: true, is_made_to_order: true };
    const sw = await save({ ...base, slug: 'word-sweatshirt', name: 'Word Sweatshirt', type: 'sweatshirt' });
    expect(sw.error).toBeNull();
    const n = await save({ ...base, slug: 'word-tee-normal', name: 'Word Tee (Normal)', type: 'tee', quality: 'normal' });
    const p = await save({ ...base, slug: 'word-tee-premium', name: 'Word Tee (Premium)', type: 'tee', quality: 'premium' });
    expect(n.error).toBeNull(); expect(p.error).toBeNull();
    const rows = await q(`select slug, type, quality from products where slug like 'word-%' order by slug`);
    expect(rows).toEqual([{ slug: 'word-sweatshirt', type: 'sweatshirt', quality: null }, { slug: 'word-tee-normal', type: 'tee', quality: 'normal' }, { slug: 'word-tee-premium', type: 'tee', quality: 'premium' }]);
  });

  it('rejects an unknown quality and an unknown type', async () => {
    const bad = await save({ slug: 'x-q', name: 'X', type: 'tee', quality: 'deluxe', base_price_kobo: 100 });
    expect(bad.error).not.toBeNull();
    const badType = await save({ slug: 'x-t', name: 'X', type: 'jumper', base_price_kobo: 100 });
    expect(badType.error).not.toBeNull();
  });

  it('photos keep their colour in saved order, and the public catalogue export carries quality and colour', async () => {
    const s = await save({ slug: 'word-hoodie', name: 'Word Hoodie', type: 'hoodie', quality: null, base_price_kobo: 2_000_000, is_active: true });
    const pid = s.data.id as string;
    const r = await rpc('admin_images_save', { actor: admin, product_id: pid, images: [
      { url: '/a.jpg', alt: 'Black front', view: 'front', colour: 'Black' }, { url: '/b.jpg', alt: 'Shared', view: 'detail', colour: null }, { url: '/c.jpg', alt: 'White front', view: 'front', colour: 'White' },
    ] });
    expect(r.error).toBeNull();
    const exp = (await rpc('catalogue_export', {})).data;
    const prod = exp.products.find((x: any) => x.slug === 'word-hoodie'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(prod.product_images.map((i: any) => [i.url, i.colour])).toEqual([['/a.jpg', 'Black'], ['/b.jpg', null], ['/c.jpg', 'White']]); // eslint-disable-line @typescript-eslint/no-explicit-any
    const t = await save({ slug: 'word-tee-p', name: 'T', type: 'tee', quality: 'premium', base_price_kobo: 100, is_active: true });
    expect(t.error).toBeNull();
    expect((await rpc('catalogue_export', {})).data.products.find((x: any) => x.slug === 'word-tee-p').quality).toBe('premium'); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it('existing products and photos are untouched (no quality, no colour)', async () => {
    const [n] = await q(`select count(*)::int n from products p where quality is not null and slug not like 'word-%' and not exists (select 1 from product_variants v where v.product_id = p.id and v.sku like 'WORD-%')`);
    expect(n!.n).toBe(0);
    const [m] = await q(`select count(*)::int n from product_images i join products p on p.id = i.product_id where i.colour is not null and p.slug not like 'word-%'`);
    expect(m!.n).toBe(0);
  });

  describe('migration 0030: the word catalogue as priced-later drafts', () => {
    const sql = readFileSync('supabase/migrations/0030_word_catalogue.sql', 'utf8');
    type Tx = { query: (s: string, a?: unknown[]) => Promise<{ rows: any[] }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    /** Runs the migration inside a transaction and rolls it back, so the shared test database is left as it was. */
    async function inRolledBackTx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
      const c = await pool!.connect();
      try { await c.query('begin'); return await fn(c); } finally { await c.query('rollback'); c.release(); }
    }
    const GARMENT = `'^(jesus-is-king|faith-over-fear|na-god-dey-run-am|no-be-luck-na-grace|daily-loaded-with-benefits|no-longer-a-slave-to-sin|jesus-no-dey-fail|sin-has-no-hold-over-me)-(normal-tee|premium-tee|sweatshirt|hoodie)$'`;

    it('creates the eight garment words (4 garments each, every colour and size) and ten frames, all unpriced drafts with their verses', async () => {
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        const made = (await c.query(`select slug, type, quality, status, base_price_kobo, is_made_to_order from products where slug ~ ${GARMENT} order by slug`)).rows;
        expect(made).toHaveLength(32);
        expect(made.filter((p) => !(p.status === 'draft' && Number(p.base_price_kobo) === 0 && p.is_made_to_order))).toEqual([]);
        expect(made.find((p) => p.slug === 'jesus-is-king-normal-tee')).toMatchObject({ type: 'tee', quality: 'normal' });
        expect(made.find((p) => p.slug === 'jesus-is-king-premium-tee')).toMatchObject({ type: 'tee', quality: 'premium' });
        expect(made.find((p) => p.slug === 'jesus-is-king-sweatshirt')).toMatchObject({ type: 'sweatshirt', quality: null });
        const v = (await c.query(`select count(*)::int n, count(distinct colour)::int colours, count(distinct size)::int sizes from product_variants where product_id in (select id from products where slug ~ ${GARMENT})`)).rows[0];
        expect(v).toEqual({ n: 32 * 8 * 5, colours: 8, sizes: 5 });
        expect((await c.query(`select array_agg(distinct colour order by colour) c from product_variants where product_id = (select id from products where slug = 'faith-over-fear-hoodie')`)).rows[0].c).toEqual(['Army Green', 'Black', 'Brown', 'Navy Blue', 'Pink', 'Royal Blue', 'White', 'Yellow']);
        const frames = (await c.query(`select p.slug, (select count(*)::int from product_variants v where v.product_id = p.id) n, p.status, p.base_price_kobo from products p where p.type = 'frame' and p.slug like '%-frame' and p.status = 'draft' order by p.slug`)).rows;
        expect(frames.map((f) => f.slug)).toEqual(['faith-over-fear-frame', 'he-left-the-99-to-find-me-frame', 'i-can-do-all-things-frame', 'saved-by-grace-fueled-by-faith-frame', 'scriptures-on-business-frame', 'scriptures-on-favour-frame', 'scriptures-on-finances-frame', 'scriptures-on-health-frame', 'scriptures-on-strength-frame', 'the-light-shines-in-the-darkness-frame']);
        expect(frames.every((f) => f.n === 2 && Number(f.base_price_kobo) === 0)).toBe(true);
        const d = (await c.query(`select name, verse_reference, story_or_verse from designs where slug in ('faith-over-fear', 'jesus-no-dey-fail', 'scriptures-on-health') order by slug`)).rows;
        expect(d.map((x) => [x.name, x.verse_reference])).toEqual([['Faith Over Fear', 'Psalm 118:6'], ['Jesus No dey Fail', 'Hebrews 13:8'], ['Scriptures on Health', '3 John 1:2']]);
        expect(d.every((x) => x.story_or_verse.length > 20)).toBe(true);
      });
    });

    it('archives the old demo tees, hoodies and frames, but leaves what gift boxes and couple packs still use; accessories are untouched', async () => {
      await inRolledBackTx(async (c) => {
        const oldKinds = `type in ('tee','hoodie','frame') and design_id is not null and slug !~ '^(jesus|faith|na-god|no-|daily|sin-|i-can|the-light|saved|he-left|scriptures)'`;
        const activeBefore = (await c.query(`select count(*)::int n from products where ${oldKinds} and status = 'active'`)).rows[0].n;
        const accessories = (await c.query(`select count(*)::int n from products where type in ('perfume','bracelet','jewellery','glasses','fun','gift_card') and status = 'active'`)).rows[0].n;
        expect(activeBefore).toBeGreaterThan(0);
        await c.query(sql);
        const archived = (await c.query(`select count(*)::int n from products where ${oldKinds} and status = 'archived'`)).rows[0].n;
        expect(archived).toBeGreaterThan(0);
        expect((await c.query(`select count(*)::int n from products where type in ('perfume','bracelet','jewellery','glasses','fun','gift_card') and status = 'active'`)).rows[0].n).toBe(accessories);
        // nothing a bundle slot points at was archived
        const broken = (await c.query(`select count(*)::int n from products p where p.status = 'archived' and (p.id in (select allowed_product_id from bundle_slots) or p.design_id in (select unnest(allowed_design_ids) from bundle_slots))`)).rows[0].n;
        expect(broken).toBe(0);
      });
    });

    it('is safe to run twice: nothing duplicated, a price you set survives; an earlier draft set is cleaned up and its renamed word restored', async () => {
      await inRolledBackTx(async (c) => {
        await c.query(`update designs set name = 'Through Christ That Strengthens Me' where slug = 'all-things'`);
        await c.query(`insert into products (slug, name, type, design_id, base_price_kobo, status) select 'all-things-premium-tee', 'old draft', 'tee', id, 0, 'draft' from designs where slug = 'all-things'`);
        await c.query(sql);
        expect((await c.query(`select name from designs where slug = 'all-things'`)).rows[0].name).toBe('All Things');
        expect((await c.query(`select count(*)::int n from products where slug = 'all-things-premium-tee'`)).rows[0].n).toBe(0);
        await c.query(`update products set base_price_kobo = 1800000 where slug = 'faith-over-fear-premium-tee'`);
        await c.query(sql);
        expect((await c.query(`select count(*)::int n from products where slug ~ ${GARMENT}`)).rows[0].n).toBe(32);
        expect((await c.query(`select count(*)::int n from product_variants where sku like 'WORD-%'`)).rows[0].n).toBe(32 * 40 + 10 * 2);
        expect(Number((await c.query(`select base_price_kobo from products where slug = 'faith-over-fear-premium-tee'`)).rows[0].base_price_kobo)).toBe(1800000);
      });
    });

    it('a garment or frame cannot be made Active while its price is still ₦0, and can once priced; other kinds are unaffected', async () => {
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        await expect(c.query(`update products set status = 'active' where slug = 'jesus-is-king-hoodie'`)).rejects.toThrow(/Set a price before making this product active/);
      });
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        await expect(c.query(`update products set is_active = true where slug = 'scriptures-on-favour-frame'`)).rejects.toThrow(/Set a price/);
      });
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        await c.query(`update products set base_price_kobo = 2500000 where slug = 'jesus-is-king-hoodie'`);
        await c.query(`update products set status = 'active' where slug = 'jesus-is-king-hoodie'`);
        expect((await c.query(`select is_active from products where slug = 'jesus-is-king-hoodie'`)).rows[0].is_active).toBe(true);
        await c.query(`insert into products (slug, name, type, base_price_kobo, status) values ('zero-card', 'Zero card', 'gift_card', 0, 'active')`);
      });
      const r = await save({ slug: 'guard-direct', name: 'Guard', type: 'tee', base_price_kobo: 0, is_active: true });
      expect(r.error?.message ?? '').toMatch(/Set a price before making this product active/);
    });
  });

  describe('migration 0031: bulk price and deleting archived products', () => {
    const mk = async (slug: string, status: string, price = 1_000_000) => (await save({ slug, name: slug, type: 'tee', base_price_kobo: price, status })).data.id as string;
    it('sets one price on many products, refuses zero, ignores gift cards, and needs an admin', async () => {
      const a = await mk('bulk-a', 'draft'), b = await mk('bulk-b', 'draft');
      const gc = await save({ slug: 'bulk-card', name: 'card', type: 'gift_card', base_price_kobo: 500, status: 'draft' });
      const r = await rpc('admin_products_set_price', { actor: admin, ids: [a, b, gc.data.id], price_kobo: 1_800_000 });
      expect(r.data).toEqual({ updated: 2 });
      expect((await q(`select base_price_kobo::int p from products where id in ($1,$2) order by id`, [a, b])).map((x) => x.p)).toEqual([1_800_000, 1_800_000]);
      expect(Number((await q(`select base_price_kobo from products where id = $1`, [gc.data.id]))[0]!.base_price_kobo)).toBe(500);
      expect((await rpc('admin_products_set_price', { actor: admin, ids: [a], price_kobo: 0 })).error?.message).toMatch(/above zero/);
      const cust = await makeUser('c-bulk@example.com');
      expect((await rpc('admin_products_set_price', { actor: cust, ids: [a], price_kobo: 100 })).error?.message).toMatch(/forbidden/);
    });
    it('deletes only archived products never ordered; reports what it kept; photos and variants go with them', async () => {
      const arch = await mk('bulk-arch', 'archived'), live = await mk('bulk-live', 'active'), ordered = await mk('bulk-ordered', 'archived');
      await q(`insert into product_variants (product_id, sku, colour, size) values ($1,'BULK-ARCH-1','Black','M'), ($2,'BULK-ORD-1','Black','M')`, [arch, ordered]);
      await q(`insert into product_images (product_id, url, alt) values ($1,'/x.jpg','x')`, [arch]);
      const [o] = await q(`insert into orders (contact_email, contact_phone, address, subtotal_kobo, total_kobo) values ('buyer@example.com', '+2348031234567', '{}'::jsonb, 100, 100) returning id`);
      const [v] = await q(`select id from product_variants where sku = 'BULK-ORD-1'`);
      await q(`insert into order_items (order_id, kind, name, quantity, unit_price_kobo, variant_id) values ($1, 'variant', 'x', 1, 100, $2)`, [o!.id, v!.id]);
      const r = await rpc('admin_products_delete', { actor: admin, ids: [arch, live, ordered] });
      expect(r.error).toBeNull();
      expect(r.data.not_archived).toBe(1);
      expect(await q(`select 1 from products where id = $1`, [arch])).toHaveLength(0);
      expect(await q(`select 1 from product_variants where product_id = $1`, [arch])).toHaveLength(0);
      expect(await q(`select 1 from product_images where product_id = $1`, [arch])).toHaveLength(0);
      expect(await q(`select 1 from products where id = $1`, [live])).toHaveLength(1);             // active: never deleted
      expect(r.data.kept_because_ordered).toBe(1);
      expect(r.data.deleted).toBe(1);
      expect(await q(`select 1 from products where id = $1`, [ordered])).toHaveLength(1);                // on a past order: kept
    });
  });
});
