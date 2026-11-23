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
});
