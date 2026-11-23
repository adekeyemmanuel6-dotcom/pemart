import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultSelection, frameSignature, priceCombo } from '@/lib/combos/pricing';
import type { ComboConfig, ComboSelection } from '@/lib/combos/types';
import { TEST_DB, makeUser, one, pool, q, reset } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';
process.env.PAYSTACK_MOCK = '1';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_combos';
delete process.env.RESEND_API_KEY;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const details = { email: 'ada@example.com', phone: '+2348031234567', isGift: false, address: { recipient: 'Ada Obi', phone: '+2348031234567', line1: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos' } };

describe.skipIf(!TEST_DB)('combo collections against real Postgres', () => {
  let svc: typeof import('@/lib/checkout/service');
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string, staff: string, customer: string;
  beforeAll(async () => { svc = await import('@/lib/checkout/service'); rpc = (await (await import('@/lib/db')).getRpc())! as never; });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    // Put the three starting collections back to their seeded draft state (no prices, never published)
    await q(`update combo_collections set status = 'draft', base_price_kobo = null, published_snapshot = null, published_at = null, version = 0 where slug in ('behold','abide','doers')`);
    await q(`delete from combo_collections where slug not in ('behold','abide','doers')`);
    await q(`delete from combo_price_rules`);
    await q(`update combo_components set is_active = true, archived_at = null where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame','diary-2027','pen','highlight-pen','sticky-notes','perfume')`);
    await q(`delete from order_items where kind = 'combo'`);
    admin = await makeUser('admin@example.com'); staff = await makeUser('staff@example.com'); customer = await makeUser('cust@example.com');
    await q(`update public.profiles set role='admin' where id=$1`, [admin]); await q(`update public.profiles set role='staff' where id=$1`, [staff]);
  });
  const call = (fn: string, actor: string | null, extra: Json = {}) => rpc(fn, { actor, ...extra });
  const ok = async (fn: string, actor: string, extra: Json = {}) => { const r = await call(fn, actor, extra); if (r.error) throw new Error(`${fn}: ${r.error.message}`); return r.data; };
  const idOf = async (slug: string) => (await one<{ id: string }>('select id from combo_collections where slug = $1', [slug])).id;

  /** Admin saves a base price (and optional rules) for a seeded collection, then publishes it. */
  async function priceAndPublish(slug: string, base: number | null, rules: Json[] = []) {
    const id = await idOf(slug);
    const got = await ok('admin_combo_get', admin, { id });
    await ok('admin_combo_save', admin, { id, collection: { ...got.collection, base_price_kobo: base }, slots: got.slots, rules });
    await ok('admin_combo_publish', admin, { id });
    return (await rpc('combo_public_list', {})).data.collections.find((c: ComboConfig) => c.slug === slug) as ComboConfig;
  }
  /** A complete selection for the published config: garment + size + colour, and a frame size per frame. */
  const choose = (cfg: ComboConfig, garmentSlug: string, frameSlugs: string[], text = 'John 15:7'): ComboSelection => {
    const s = defaultSelection(cfg);
    const g = cfg.slots.find((x) => x.kind === 'garment')!, f = cfg.slots.find((x) => x.kind === 'frame')!;
    const comp = g.components.find((c) => c.slug === garmentSlug)!;
    s.units[g.id] = [{ componentId: comp.id, sizeId: comp.options.find((o) => o.slug === 'l')!.id, colourId: comp.options.find((o) => o.slug === 'black')!.id, text, notes: 'Bold, please' }];
    s.units[f.id] = frameSlugs.map((slug, i) => ({ frameSizeId: f.components[0]!.options.find((o) => o.slug === slug)!.id, text: `Frame ${i + 1} verse` }));
    return s;
  };
  const comboLine = (slug: string, selection: ComboSelection, quantity = 1) => ({ id: crypto.randomUUID(), kind: 'combo', refId: slug, quantity, selection });
  const start = async (lines: object[]) => { const r = await svc.createOrderAndInitPayment({ lines, state: 'Lagos', acceptFinalSale: true } as never, details, {}); if (!r.ok) throw new Error(`start failed: ${r.message}`); return r; };

  it('ships the three collections as drafts with the owner\'s reference costs, no selling prices, and nothing public', async () => {
    const list = await ok('admin_combos_list', admin);
    expect(list.map((c: Json) => c.slug)).toEqual(['behold', 'abide', 'doers']);
    expect(list.every((c: Json) => c.status === 'draft')).toBe(true);
    expect((await rpc('combo_public_list', {})).data.collections).toEqual([]);
    const abide = list.find((c: Json) => c.slug === 'abide');
    expect(abide.config.slots.find((s: Json) => s.kind === 'frame').quantity).toBe(3);          // ABIDE: three frames
    expect(abide.config.slots.find((s: Json) => s.kind === 'garment').components.map((c: Json) => c.slug)).toEqual(['premium-tshirt', 'sweatshirt', 'hoodie']);
    expect(abide.config.rules.base_price_kobo).toBeNull();
    const costs = (await q(`select slug, internal_cost_kobo c from combo_components where internal_cost_kobo is not null order by slug`)).map((r) => [r.slug, Number(r.c)]);
    expect(Object.fromEntries(costs)).toMatchObject({ 'premium-tshirt': 1000000, sweatshirt: 1500000, hoodie: 2000000, 'normal-tshirt': 300000, 'diary-2027': 700000, pen: 100000, 'highlight-pen': 100000, 'sticky-notes': 50000, perfume: 1000000 });
    const frames = (await q(`select slug, internal_cost_kobo c from combo_component_options where grp = 'frame_size' order by slug`)).map((r) => [r.slug, Number(r.c)]);
    expect(Object.fromEntries(frames)).toEqual({ '12x16': 900000, '16x20': 1600000 });
    const doers = list.find((c: Json) => c.slug === 'doers');
    expect(doers.config.slots.filter((s: Json) => s.kind === 'item' && s.mode === 'required').map((s: Json) => s.label).sort()).toEqual(['2027 Diary', 'Highlight Pen', 'Pen', 'Sticky Notes']);
    expect(doers.config.slots.filter((s: Json) => s.mode === 'optional').every((s: Json) => s.components[0].available === (s.components[0].slug === 'perfume'))).toBe(true);   // recommended extras start as drafts
  });

  it('keeps internal costs away from everyone except owners: public data, staff, customers and anonymous callers', async () => {
    await priceAndPublish('behold', 5000000);
    const pub = JSON.stringify((await rpc('combo_public_list', {})).data);
    expect(pub).not.toContain('internal_cost'); expect(pub).not.toContain('overheads');
    for (const who of [customer, null]) for (const fn of ['admin_combos_list', 'admin_combo_get', 'admin_combo_save', 'admin_combo_publish', 'admin_components_list', 'admin_combo_costs_save'])
      expect((await call(fn, who, { id: await idOf('behold'), collection: {}, costs: {} })).error?.message, `${fn} as ${who}`).toMatch(/forbidden/);
    expect((await call('admin_combos_list', staff)).error?.message).toMatch(/forbidden/);                   // default staff have no catalogue permission
    await q(`insert into staff_permissions (id, permissions) values ($1, array['catalogue'])`, [staff]);
    const asStaff = await ok('admin_combo_get', staff, { id: await idOf('behold') });
    expect(JSON.stringify(asStaff)).not.toContain('internal_cost'); expect(asStaff.is_owner).toBe(false);   // catalogue staff can manage, but never see costs
    expect((await call('admin_combo_costs_save', staff, { id: await idOf('behold'), costs: { packaging_kobo: 1 } })).error?.message).toMatch(/forbidden/);
    await ok('admin_combo_costs_save', admin, { id: await idOf('behold'), costs: { packaging_kobo: 200000, labor_kobo: 400000 } });
    const asAdmin = await ok('admin_combo_get', admin, { id: await idOf('behold') });
    expect(asAdmin.config.overheads).toMatchObject({ packaging_kobo: 200000, labor_kobo: 400000 }); expect(JSON.stringify(asAdmin)).toContain('internal_cost');
    await q(`delete from staff_permissions where id = $1`, [staff]);
  });

  it('publishing is a snapshot: edits to a published combo stay private until the next publish', async () => {
    const cfg = await priceAndPublish('behold', 5000000);
    expect(cfg.rules.base_price_kobo).toBe(5000000); expect(cfg.version).toBe(1);
    const id = await idOf('behold');
    const got = await ok('admin_combo_get', admin, { id });
    await ok('admin_combo_save', admin, { id, collection: { ...got.collection, base_price_kobo: 6000000, name: 'BEHOLD (edited)' }, slots: got.slots, rules: got.rules });
    let pub = (await rpc('combo_public_list', {})).data.collections[0] as ComboConfig;
    expect(pub.rules.base_price_kobo).toBe(5000000); expect(pub.name).toBe('BEHOLD COLLECTION');               // customers still see the published version
    expect((await ok('admin_combo_get', admin, { id })).has_unpublished_changes).toBe(true);
    await ok('admin_combo_publish', admin, { id });
    pub = (await rpc('combo_public_list', {})).data.collections[0] as ComboConfig;
    expect(pub.rules.base_price_kobo).toBe(6000000); expect(pub.version).toBe(2);
    await ok('admin_combo_set_status', admin, { id, status: 'draft' });
    expect((await rpc('combo_public_list', {})).data.collections).toEqual([]);                                  // unpublished: gone
  });

  it('BEHOLD and ABIDE: the server prices every choice, and the order keeps each garment and frame for production', async () => {
    const hoodieId = (await one<{ id: string }>(`select id from combo_components where slug = 'hoodie'`)).id;
    const f16 = (await one<{ id: string }>(`select o.id from combo_component_options o join combo_components c on c.id = o.component_id where c.slug = 'custom-frame' and o.slug = '16x20'`)).id;
    const abide = await priceAndPublish('abide', 8000000, [
      { kind: 'garment_adjust', component_id: hoodieId, amount_kobo: 1000000 }, { kind: 'frame_size_adjust', option_id: f16, amount_kobo: 900000 }]);
    const sel = choose(abide, 'hoodie', ['12x16', '16x20', '12x16']);
    const expected = 8000000 + 1000000 + 900000;
    expect(priceCombo(abide, sel).unitKobo).toBe(expected);

    const quote = await svc.quoteCart({ lines: [comboLine('abide', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
    expect(quote.lines[0]).toMatchObject({ kind: 'combo', unitKobo: expected, lineKobo: expected, name: 'ABIDE COLLECTION' });
    expect(quote.subtotalKobo).toBe(expected); expect(quote.needsFinalSaleConsent).toBe(true); expect(quote.hasBundle).toBe(true);
    expect(quote.lines[0]!.contents.filter((c) => c.startsWith('Customised frame'))).toEqual([
      'Customised frame 1: Customised Frame · 12 × 16 inches · “Frame 1 verse”', 'Customised frame 2: Customised Frame · 16 × 20 inches · “Frame 2 verse”', 'Customised frame 3: Customised Frame · 12 × 16 inches · “Frame 3 verse”']);

    // A browser cannot send a price: extra keys are ignored and the charge is the server's number.
    const tampered = { ...comboLine('abide', sel), price: 100, unitKobo: 1, priceKobo: 1, total: 1 };
    const s = await start([tampered]);
    expect(s.mode === 'pay' && s.totalKobo).toBeGreaterThanOrEqual(expected);
    const item = await one<Json>(`select * from order_items where kind = 'combo' order by created_at desc limit 1`);
    expect(Number(item.unit_price_kobo)).toBe(expected);
    expect(item.name).toBe('ABIDE COLLECTION');
    expect(item.options).toMatchObject({ comboCollectionId: await idOf('abide'), comboSlug: 'abide', comboVersion: 1, rule: 'base', frameSignature: frameSignature(sel.units[abide.slots.find((x) => x.kind === 'frame')!.id]!.map((u) => u.frameSizeId!)) });
    const sels = item.selections as Json[];
    expect(sels).toHaveLength(4);                                                                                   // 1 garment + 3 frames
    expect(sels[0]).toMatchObject({ label: 'Customised garment', productName: 'Hoodie', colour: 'Black', size: 'L', customText: 'John 15:7', notes: 'Bold, please' });
    expect(sels.slice(1).map((x) => [x.option, x.customText])).toEqual([['12 × 16 inches', 'Frame 1 verse'], ['16 × 20 inches', 'Frame 2 verse'], ['12 × 16 inches', 'Frame 3 verse']]);
    expect(item.options.priceLines.map((l: Json) => l.amountKobo)).toEqual([8000000, 1000000, 900000]);
    if (s.mode === 'pay') await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} });
    expect((await one<Json>(`select status from orders order by created_at desc limit 1`)).status).toBe('paid');
  });

  it('a draft, an unpublished or a deleted combo cannot be bought; the order is refused', async () => {
    const draftCfg = (await ok('admin_combos_list', admin)).find((c: Json) => c.slug === 'behold').config as ComboConfig;
    const sel = choose(draftCfg, 'premium-tshirt', ['12x16']);
    const q1 = await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
    expect(q1.ok).toBe(false); expect(q1.issues.join()).toContain('no longer available');
    const r = await svc.createOrderAndInitPayment({ lines: [comboLine('behold', sel)], state: 'Lagos', acceptFinalSale: true } as never, details, {});
    expect(r.ok).toBe(false);
    expect(await q(`select 1 from order_items where kind = 'combo'`)).toHaveLength(0);
    // published, then unpublished while sitting in a bag
    const cfg = await priceAndPublish('behold', 5000000);
    const good = choose(cfg, 'premium-tshirt', ['12x16']);
    expect((await svc.quoteCart({ lines: [comboLine('behold', good)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never)).ok).toBe(true);
    await ok('admin_combo_set_status', admin, { id: await idOf('behold'), status: 'draft' });
    expect((await svc.quoteCart({ lines: [comboLine('behold', good)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never)).ok).toBe(false);
  });

  it('an unpriced combo is not purchasable ("Price currently unavailable"), and a price change reaches the next quote at once', async () => {
    const cfg = await priceAndPublish('behold', null);                       // published with no price set
    const sel = choose(cfg, 'sweatshirt', ['16x20']);
    const noPrice = await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
    expect(noPrice.ok).toBe(false); expect(noPrice.issues.join()).toContain('Price currently unavailable'); expect(noPrice.subtotalKobo).toBe(0);
    expect((await svc.createOrderAndInitPayment({ lines: [comboLine('behold', sel)], state: 'Lagos', acceptFinalSale: true } as never, details, {})).ok).toBe(false);
    await priceAndPublish('behold', 4500000);
    expect((await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never)).subtotalKobo).toBe(4500000);
  });

  it('THE DOER\'S: included items are in the price; an optional extra adds; a draft extra cannot be added until enabled', async () => {
    const cfg = await priceAndPublish('doers', 9000000);
    const sel = choose(cfg, 'premium-tshirt', ['12x16']);
    const perfume = cfg.slots.find((s) => s.label === 'Perfume')!;
    // perfume has no extra price yet -> cannot be added
    expect(priceCombo(cfg, { ...sel, items: { [perfume.id]: { qty: 1 } } }).issues.join()).toContain('cannot be added');
    const id = await idOf('doers');
    const got = await ok('admin_combo_get', admin, { id });
    await ok('admin_combo_save', admin, { id, collection: got.collection, slots: got.slots.map((s: Json) => (s.id === perfume.id ? { ...s, extra_price_kobo: 1500000 } : s)), rules: got.rules });
    await ok('admin_combo_publish', admin, { id });
    const next = (await rpc('combo_public_list', {})).data.collections[0] as ComboConfig;
    const line = comboLine('doers', { ...choose(next, 'premium-tshirt', ['12x16']), items: { [perfume.id]: { qty: 1 } } });
    const quote = await svc.quoteCart({ lines: [line], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
    expect(quote.ok).toBe(true); expect(quote.subtotalKobo).toBe(9000000 + 1500000);
    expect(quote.lines[0]!.contents.filter((c) => /Diary|Pen|Highlight|Sticky/.test(c))).toHaveLength(4);
    expect(quote.lines[0]!.contents.some((c) => c.startsWith('Perfume') && c.includes('Add-on'))).toBe(true);
    // enabling a draft extra makes it addable
    await ok('admin_component_save', admin, { component: { ...(await one<Json>(`select * from combo_components where slug = 'scripture-promise-cards'`)), is_active: true, public_price_kobo: 250000 } });
    expect(JSON.stringify((await rpc('combo_public_list', {})).data.unavailable)).not.toContain((await one<{ id: string }>(`select id from combo_components where slug = 'scripture-promise-cards'`)).id);
  });

  it('archiving a component used by an existing order never changes that order, and removes it from new orders at once', async () => {
    const cfg = await priceAndPublish('behold', 5000000);
    const s = await start([comboLine('behold', choose(cfg, 'hoodie', ['16x20']))]);
    if (s.mode === 'pay') await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} });
    const before = await one<Json>(`select name, unit_price_kobo, selections, options from order_items where kind = 'combo'`);
    const hoodie = await one<Json>(`select id from combo_components where slug = 'hoodie'`);
    // cannot be deleted (used in a combo and ordered)...
    expect((await call('admin_component_delete', admin, { id: hoodie.id })).error?.message).toMatch(/used in a combo/);
    // ...but can be archived, which hides it immediately (no re-publish needed) for new orders
    await ok('admin_component_archive', admin, { id: hoodie.id, archive: true });
    const hoodieSel = choose(cfg, 'hoodie', ['16x20']);
    const blocked = await svc.quoteCart({ lines: [comboLine('behold', hoodieSel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
    expect(blocked.ok).toBe(false); expect(blocked.issues.join()).toContain('Hoodie is currently unavailable');
    expect((await svc.quoteCart({ lines: [comboLine('behold', choose(cfg, 'sweatshirt', ['16x20']))], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never)).ok).toBe(true);
    const after = await one<Json>(`select name, unit_price_kobo, selections, options from order_items where kind = 'combo'`);
    expect(after).toEqual(before);                                                                                        // the historical order is untouched
    await ok('admin_component_archive', admin, { id: hoodie.id, archive: false });
    expect((await svc.quoteCart({ lines: [comboLine('behold', hoodieSel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never)).ok).toBe(true);
  });

  it('create, duplicate, reorder, archive and delete collections; the combo that customers ordered cannot be deleted', async () => {
    const created = await ok('admin_combo_save', admin, {
      collection: { slug: 'new-combo', name: 'NEW COMBO', label: 'Signature', tagline: 'Test', scripture_ref: 'Psalm 23', sort_order: 9, base_price_kobo: 3000000 },
      slots: [{ kind: 'garment', label: 'Garment', allowed_component_ids: [(await one<{ id: string }>(`select id from combo_components where slug = 'hoodie'`)).id], quantity: 1, mode: 'required', customise: true },
              { kind: 'frame', label: 'Frames', component_id: (await one<{ id: string }>(`select id from combo_components where slug = 'custom-frame'`)).id, quantity: 4, mode: 'required', customise: true }],
      rules: [] });
    const got = await ok('admin_combo_get', admin, { id: created.id });
    expect(got.config.slots.find((s: Json) => s.kind === 'frame').quantity).toBe(4);                                  // three frames -> four frames without code
    const dup = await ok('admin_combo_duplicate', admin, { id: created.id });
    const dupGot = await ok('admin_combo_get', admin, { id: dup.id });
    expect(dupGot.collection.slug).toBe('new-combo-copy'); expect(dupGot.collection.status).toBe('draft'); expect(dupGot.slots).toHaveLength(2);
    await ok('admin_combo_reorder', admin, { ids: [dup.id, created.id] });
    expect((await ok('admin_combos_list', admin)).filter((c: Json) => c.slug.startsWith('new-combo')).map((c: Json) => c.slug)).toEqual(['new-combo-copy', 'new-combo']);
    await ok('admin_combo_set_status', admin, { id: dup.id, status: 'archived' });
    await ok('admin_combo_delete', admin, { id: dup.id });
    expect(await q(`select 1 from combo_collections where slug = 'new-combo-copy'`)).toHaveLength(0);
    // a published collection must be unpublished before deleting
    await ok('admin_combo_publish', admin, { id: created.id });
    expect((await call('admin_combo_delete', admin, { id: created.id })).error?.message).toMatch(/Unpublish/);
    expect((await call('admin_combo_save', admin, { collection: { slug: 'Bad Slug', name: 'x' } })).error).toBeTruthy();
    // ordered combos are protected
    const cfg = await priceAndPublish('behold', 5000000);
    const s = await start([comboLine('behold', choose(cfg, 'premium-tshirt', ['12x16']))]);
    if (s.mode === 'pay') await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} });
    await ok('admin_combo_set_status', admin, { id: await idOf('behold'), status: 'draft' });
    expect((await call('admin_combo_delete', admin, { id: await idOf('behold') })).error?.message).toMatch(/ordered this combo/);
  });

  it('publishing requires a garment in the package', async () => {
    const created = await ok('admin_combo_save', admin, { collection: { slug: 'frames-only', name: 'FRAMES ONLY' }, slots: [], rules: [] });
    expect((await call('admin_combo_publish', admin, { id: created.id })).error?.message).toMatch(/Add a garment/);
  });

  describe('choosing one of your words', () => {
    const designOf = async (slug?: string) => (await one<{ id: string; name: string }>(slug ? 'select id, name from designs where slug = $1' : 'select id, name from designs where is_active order by name limit 1', slug ? [slug] : []));

    it('the public list carries the active words (public fields only) and drops a word the moment it is switched off', async () => {
      const d = await designOf();
      const words = (await rpc('combo_public_list', {})).data.words as Json[];
      expect(words.length).toBeGreaterThan(0);
      expect(words.find((w) => w.id === d.id)).toEqual({ id: d.id, slug: expect.any(String), name: d.name, reference: expect.anything(), image: expect.anything() });
      for (const w of words) expect(Object.keys(w).sort()).toEqual(['id', 'image', 'name', 'reference', 'slug']);
      await q(`update designs set is_active = false where id = $1`, [d.id]);
      expect(((await rpc('combo_public_list', {})).data.words as Json[]).some((w) => w.id === d.id)).toBe(false);
    });

    it('the chosen word is priced for free, shown in the bag, and kept on the paid order', async () => {
      const d = await designOf();
      const cfg = await priceAndPublish('behold', 5000000);
      const sel = choose(cfg, 'premium-tshirt', ['12x16']);
      const base = (await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never));
      const g = cfg.slots.find((x) => x.kind === 'garment')!; sel.units[g.id]![0]!.designId = d.id;
      const withWord = await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
      expect(withWord.ok).toBe(true);
      expect(withWord.totalKobo).toBe(base.totalKobo);
      expect(withWord.lines[0]!.contents.join(' ')).toContain(`Word: ${d.name}`);
      const s = await start([comboLine('behold', sel)]);
      if (s.mode === 'pay') await svc.settlePayment(s.reference, { source: 'webhook', amountKobo: s.totalKobo, currency: 'NGN', payload: {} });
      const item = await one<{ selections: Json[] }>(`select selections from order_items where kind = 'combo'`);
      expect(item.selections.find((r) => r.productName.includes('T-shirt'))).toMatchObject({ word: d.name, designId: d.id });
    });

    it('a word switched off after it was put in the bag is refused at the bag and at payment', async () => {
      const d = await designOf();
      const cfg = await priceAndPublish('behold', 5000000);
      const sel = choose(cfg, 'premium-tshirt', ['12x16']);
      sel.units[cfg.slots.find((x) => x.kind === 'garment')!.id]![0]!.designId = d.id;
      await q(`update designs set is_active = false where id = $1`, [d.id]);
      const quote = await svc.quoteCart({ lines: [comboLine('behold', sel)], state: 'Lagos', city: 'Ikeja', acceptFinalSale: true } as never);
      expect(quote.ok).toBe(false); expect(quote.issues.join()).toMatch(/word you chose.*no longer available/i);
      expect((await svc.createOrderAndInitPayment({ lines: [comboLine('behold', sel)], state: 'Lagos', acceptFinalSale: true } as never, details, {})).ok).toBe(false);
    });
  });
});
