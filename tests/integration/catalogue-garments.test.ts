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
    const [n] = await q(`select count(*)::int n from products where quality is not null and slug not like 'word-%'`);
    expect(n!.n).toBe(0);
    const [m] = await q(`select count(*)::int n from product_images i join products p on p.id = i.product_id where i.colour is not null and p.slug not like 'word-%'`);
    expect(m!.n).toBe(0);
  });

  describe('migration 0029: the first words get their garments as priced-later drafts', () => {
    const sql = readFileSync('supabase/migrations/0029_word_garments.sql', 'utf8');
    /** Runs the migration inside a transaction and rolls it back, so the shared test database is left as it was. */
    async function inRolledBackTx<T>(fn: (c: { query: (s: string, a?: unknown[]) => Promise<{ rows: any[] }> }) => Promise<T>): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
      const c = await pool!.connect();
      try { await c.query('begin'); return await fn(c); } finally { await c.query('rollback'); c.release(); }
    }

    it('creates 4 draft, unpriced garments per word with every colour and size, archives the old tee and hoodie, keeps frames, and is safe to run twice', async () => {
      await inRolledBackTx(async (c) => {
        const before = (await c.query(`select count(*)::int n from products where status = 'active' and design_id in (select id from designs where slug = 'seek-first')`)).rows[0].n;
        await c.query(sql);
        const words = (await c.query(`select slug from designs where slug in ('all-things','seek-first','be-still','trust-in-the-lord','i-shall-not-want')`)).rows.length;
        expect(words).toBe(5);
        const made = (await c.query(`select p.slug, p.type, p.quality, p.status, p.base_price_kobo, p.is_made_to_order from products p where p.slug ~ '^(all-things|seek-first|be-still|trust-in-the-lord|i-shall-not-want)-(normal-tee|premium-tee|sweatshirt|hoodie)$' order by p.slug`)).rows;
        expect(made).toHaveLength(20);
        expect(made.every((p) => p.status === 'draft' && Number(p.base_price_kobo) === 0 && p.is_made_to_order)).toBe(true);
        expect(made.find((p) => p.slug === 'seek-first-normal-tee')).toMatchObject({ type: 'tee', quality: 'normal' });
        expect(made.find((p) => p.slug === 'seek-first-premium-tee')).toMatchObject({ type: 'tee', quality: 'premium' });
        expect(made.find((p) => p.slug === 'seek-first-sweatshirt')).toMatchObject({ type: 'sweatshirt', quality: null });
        const v = (await c.query(`select count(*)::int n, count(distinct colour)::int colours, count(distinct size)::int sizes from product_variants where product_id in (select id from products where slug like 'seek-first-%' and slug ~ '-(normal-tee|premium-tee|sweatshirt|hoodie)$')`)).rows[0];
        expect(v).toEqual({ n: 4 * 8 * 5, colours: 8, sizes: 5 });
        expect((await c.query(`select count(*)::int n from product_variants where sku = 'WORD-SEEK-FIRST-PREMIUM-TEE-ROYALBLUE-XXL'`)).rows[0].n).toBe(1);
        expect((await c.query(`select status from products where slug in ('seek-first-tee','seek-first-hoodie-old') order by slug`)).rows.map((r) => r.status)).toEqual(['archived', 'archived']);
        expect((await c.query(`select status from products where slug = 'seek-first-frame'`)).rows.map((r) => r.status)).toEqual(['active']);   // frames are not part of the new set
        expect((await c.query(`select name from designs where slug = 'all-things'`)).rows[0].name).toBe('Through Christ That Strengthens Me');
        expect(before).toBeGreaterThan(0);
        // second run: nothing duplicated, nothing overwritten (a price set meanwhile survives)
        await c.query(`update products set base_price_kobo = 1800000 where slug = 'seek-first-premium-tee'`);
        await c.query(sql);
        expect((await c.query(`select count(*)::int n from products where slug ~ '-(normal-tee|premium-tee|sweatshirt|hoodie)$' and design_id in (select id from designs where slug = 'seek-first')`)).rows[0].n).toBe(4);
        expect((await c.query(`select count(*)::int n from product_variants where product_id = (select id from products where slug = 'seek-first-premium-tee')`)).rows[0].n).toBe(40);
        expect(Number((await c.query(`select base_price_kobo from products where slug = 'seek-first-premium-tee'`)).rows[0].base_price_kobo)).toBe(1800000);
      });
    });

    it('a garment cannot be made Active while its price is still ₦0, and can once priced; other kinds are unaffected', async () => {
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        await expect(c.query(`update products set status = 'active' where slug = 'be-still-hoodie'`)).rejects.toThrow(/Set a price before making this product active/);
      });
      await inRolledBackTx(async (c) => {
        await c.query(sql);
        await c.query(`update products set base_price_kobo = 2500000 where slug = 'be-still-hoodie'`);
        await c.query(`update products set status = 'active' where slug = 'be-still-hoodie'`);
        expect((await c.query(`select is_active from products where slug = 'be-still-hoodie'`)).rows[0].is_active).toBe(true);
        await c.query(`insert into products (slug, name, type, base_price_kobo, status) values ('zero-card', 'Zero card', 'gift_card', 0, 'active')`);   // not a garment: allowed
      });
      const r = await save({ slug: 'guard-direct', name: 'Guard', type: 'tee', base_price_kobo: 0, is_active: true });
      expect(r.error?.message ?? '').toMatch(/Set a price before making this product active/);
    });
  });
});
