import { describe, expect, it } from 'vitest';
import { configIssues, defaultSelection, enumerateConfigs, estimateCost, frameSignature, priceCombo, profit, startingPrice } from '@/lib/combos/pricing';
import { UNAVAILABLE_PRICE, type ComboSelection } from '@/lib/combos/types';
import { makeCollections, makeLibrary } from '../helpers/combo-fixture';

const lib = makeLibrary();
const first = (c: { options: { id: string; group: string }[] }, g: string) => c.options.find((o) => o.group === g)!.id;

/** A complete selection: garment + size + colour, and a frame size per frame. */
function pick(config: ReturnType<typeof makeCollections>['behold'], garment: typeof lib.tee, frameSizes: string[], extra: Partial<ComboSelection> = {}): ComboSelection {
  const s = defaultSelection(config);
  const g = config.slots.find((x) => x.kind === 'garment')!, f = config.slots.find((x) => x.kind === 'frame');
  s.units[g.id] = [{ componentId: garment.id, sizeId: first(garment, 'size'), colourId: first(garment, 'colour'), text: 'Psalm 119:18', notes: 'Bold lettering' }];
  if (f) s.units[f.id] = frameSizes.map((id, i) => ({ frameSizeId: id, text: `Frame ${i + 1} verse` }));
  return { ...s, ...extra };
}

describe('combo pricing precedence', () => {
  it('BEHOLD with a premium T-shirt and a 12×16 frame: base package only', () => {
    const { behold } = makeCollections(lib);
    const q = priceCombo(behold, pick(behold, lib.tee, [lib.f12.id]));
    expect(q.ok).toBe(true); expect(q.rule).toBe('base'); expect(q.unitKobo).toBe(5000000);
    expect(q.contents.join(' ')).toContain('Premium Cotton T-shirt · Black · S');
  });

  it('BEHOLD with a hoodie and a 16×20 frame adds the garment and frame-size adjustments, once each', () => {
    const { behold } = makeCollections(lib);
    behold.rules.garment_adjust = [{ id: 'g1', component_id: lib.hoodie.id, amount_kobo: 800000 }];
    behold.rules.frame_size_adjust = [{ id: 'f1', option_id: lib.f16.id, amount_kobo: 700000 }];
    const q = priceCombo(behold, pick(behold, lib.hoodie, [lib.f16.id]));
    expect(q.unitKobo).toBe(5000000 + 800000 + 700000);
    expect(q.lines.map((l) => [l.kind, l.amountKobo])).toEqual([['package', 5000000], ['garment', 800000], ['frames', 700000]]);
    expect(priceCombo(behold, pick(behold, lib.tee, [lib.f12.id])).unitKobo).toBe(5000000);   // other options unaffected
  });

  it('ABIDE with a sweatshirt and three 12×16 frames', () => {
    const { abide } = makeCollections(lib);
    abide.rules.frame_size_adjust = [{ id: 'f1', option_id: lib.f16.id, amount_kobo: 700000 }];
    const q = priceCombo(abide, pick(abide, lib.sweat, [lib.f12.id, lib.f12.id, lib.f12.id]));
    expect(q.ok).toBe(true); expect(q.unitKobo).toBe(5000000);
    expect(q.resolved.filter((r) => r.label.startsWith('Customised frame'))).toHaveLength(3);
  });

  it('ABIDE with a hoodie and three 16×20 frames charges the frame upgrade for each frame', () => {
    const { abide } = makeCollections(lib);
    abide.rules.frame_size_adjust = [{ id: 'f1', option_id: lib.f16.id, amount_kobo: 700000 }];
    const q = priceCombo(abide, pick(abide, lib.hoodie, [lib.f16.id, lib.f16.id, lib.f16.id]));
    expect(q.unitKobo).toBe(5000000 + 3 * 700000);
    expect(q.lines.find((l) => l.kind === 'frames')).toMatchObject({ amountKobo: 2100000, label: expect.stringContaining('× 3') });
  });

  it('ABIDE with mixed frame sizes prices each frame by its own size (order does not matter)', () => {
    const { abide } = makeCollections(lib);
    abide.rules.frame_size_adjust = [{ id: 'f1', option_id: lib.f16.id, amount_kobo: 700000 }];
    const a = priceCombo(abide, pick(abide, lib.tee, [lib.f12.id, lib.f16.id, lib.f12.id]));
    const b = priceCombo(abide, pick(abide, lib.tee, [lib.f16.id, lib.f12.id, lib.f12.id]));
    expect(a.unitKobo).toBe(5700000); expect(b.unitKobo).toBe(5700000);
    expect(a.signature).toBe(b.signature); expect(a.signature).toBe(frameSignature([lib.f12.id, lib.f12.id, lib.f16.id]));
    expect(a.resolved.map((r) => r.option).filter(Boolean)).toEqual(['12 × 16 inches', '16 × 20 inches', '12 × 16 inches']);   // each frame keeps its own size for production
  });

  it('a fixed variant price REPLACES base and adjustments (no double counting)', () => {
    const { abide } = makeCollections(lib);
    abide.rules.garment_adjust = [{ id: 'g1', component_id: lib.hoodie.id, amount_kobo: 800000 }];
    abide.rules.frame_size_adjust = [{ id: 'f1', option_id: lib.f16.id, amount_kobo: 700000 }];
    abide.rules.fixed_variants = [{ id: 'v1', component_id: lib.hoodie.id, signature: frameSignature([lib.f16.id, lib.f16.id, lib.f16.id]), amount_kobo: 9000000, label: 'ABIDE Hoodie Max' }];
    const fixed = priceCombo(abide, pick(abide, lib.hoodie, [lib.f16.id, lib.f16.id, lib.f16.id]));
    expect(fixed.rule).toBe('fixed_variant'); expect(fixed.unitKobo).toBe(9000000); expect(fixed.lines).toHaveLength(1);
    const dynamic = priceCombo(abide, pick(abide, lib.hoodie, [lib.f12.id, lib.f16.id, lib.f16.id]));   // not the fixed signature
    expect(dynamic.rule).toBe('base'); expect(dynamic.unitKobo).toBe(5000000 + 800000 + 2 * 700000);
  });

  it('THE DOER\'S standard package: required items are included in the price; optional extras add to it', () => {
    const { doers } = makeCollections(lib);
    const base = pick(doers, lib.tee, [lib.f12.id]);
    const std = priceCombo(doers, base);
    expect(std.ok).toBe(true); expect(std.unitKobo).toBe(5000000);
    expect(std.contents.filter((c) => /Diary|Pen|Highlight|Sticky/.test(c))).toHaveLength(4);
    expect(std.contents.some((c) => c.includes('Included'))).toBe(true);
    const perfumeSlot = doers.slots.find((s) => s.label === 'Perfume')!;
    const withExtras = priceCombo(doers, { ...base, items: { [perfumeSlot.id]: { qty: 1 } } });
    expect(withExtras.unitKobo).toBe(5000000 + 1500000); expect(withExtras.lines.at(-1)).toMatchObject({ kind: 'extra', amountKobo: 1500000 });
  });

  it('optional items that are switched off, unpriced or over the limit cannot be added', () => {
    const { doers } = makeCollections(lib);
    const base = pick(doers, lib.tee, [lib.f12.id]);
    const cards = doers.slots.find((s) => s.label === 'Scripture Promise Cards')!;
    expect(priceCombo(doers, { ...base, items: { [cards.id]: { qty: 1 } } }).issues.join()).toContain('currently unavailable');   // draft component
    const perfume = doers.slots.find((s) => s.label === 'Perfume')!;
    expect(priceCombo(doers, { ...base, items: { [perfume.id]: { qty: 3 } } }).ok).toBe(false);                                    // max 1
    perfume.extra_price_kobo = null;
    expect(priceCombo(doers, { ...base, items: { [perfume.id]: { qty: 1 } } }).issues.join()).toContain('cannot be added');       // no price = not sellable
  });

  it('discounts never stack: only the largest active one applies, and expired ones are ignored', () => {
    const { behold } = makeCollections(lib);
    const now = new Date('2026-12-01T10:00:00Z');
    behold.rules.discounts = [
      { id: 'd1', kind: 'promo', type: 'percent', value: 10, label: 'Launch', starts_at: '2026-11-27T00:00:00Z', ends_at: '2026-12-31T00:00:00Z' },
      { id: 'd2', kind: 'bundle_discount', type: 'fixed', value: 300000, label: 'Bundle saving', starts_at: null, ends_at: null },
      { id: 'd3', kind: 'promo', type: 'percent', value: 50, label: 'Old', starts_at: '2026-01-01T00:00:00Z', ends_at: '2026-02-01T00:00:00Z' },
    ];
    const q = priceCombo(behold, pick(behold, lib.tee, [lib.f12.id]), { now });
    expect(q.discountKobo).toBe(500000); expect(q.unitKobo).toBe(4500000);
    expect(q.lines.filter((l) => l.kind === 'discount')).toEqual([{ key: 'discount', label: 'Launch', amountKobo: -500000, kind: 'discount' }]);
    expect(priceCombo(behold, pick(behold, lib.tee, [lib.f12.id]), { now: new Date('2027-02-01T00:00:00Z') }).discountKobo).toBe(300000);   // promo over: bundle saving remains
  });
});

describe('combo validation and missing prices', () => {
  it('shows "Price currently unavailable" (never ₦0) when no price is configured, and blocks purchase', () => {
    const { behold } = makeCollections(lib, { base: null });
    const q = priceCombo(behold, pick(behold, lib.tee, [lib.f12.id]));
    expect(q.priced).toBe(false); expect(q.ok).toBe(false); expect(q.unitKobo).toBe(0); expect(q.issues).toEqual([UNAVAILABLE_PRICE]); expect(q.lines).toEqual([]);
    expect(startingPrice(behold)).toBeNull();
  });

  it('guides an incomplete selection instead of announcing the price is unavailable', () => {
    const { behold } = makeCollections(lib, { base: null });
    const q = priceCombo(behold, defaultSelection(behold));
    expect(q.issues).toEqual(expect.arrayContaining(['Choose a size for your Premium Cotton T-shirt', 'Choose a colour for your Premium Cotton T-shirt']));
    expect(q.issues).not.toContain(UNAVAILABLE_PRICE);
  });

  it('rejects ids that are not part of the collection, and units that are missing', () => {
    const { abide } = makeCollections(lib);
    const s = pick(abide, lib.tee, [lib.f12.id, lib.f12.id, lib.f12.id]);
    const f = abide.slots.find((x) => x.kind === 'frame')!;
    s.units[f.id] = [{ frameSizeId: lib.f12.id }];                     // only 1 of 3 frames configured
    expect(priceCombo(abide, s).ok).toBe(false);
    s.units[f.id] = [{ frameSizeId: '11111111-1111-4111-8111-111111111111' }, { frameSizeId: lib.f12.id }, { frameSizeId: lib.f12.id }];
    expect(priceCombo(abide, s).issues.join()).toContain('Choose a size for');
    const g = abide.slots.find((x) => x.kind === 'garment')!;
    s.units[g.id] = [{ componentId: '22222222-2222-4222-8222-222222222222', sizeId: 'x' }];
    expect(priceCombo(abide, s).issues.join()).toContain('Choose your customised garment');
  });

  it('enforces an all-same-size package when the admin configures one', () => {
    const { abide } = makeCollections(lib);
    abide.slots.find((s) => s.kind === 'frame')!.same_size_only = true;
    const q = priceCombo(abide, pick(abide, lib.tee, [lib.f12.id, lib.f16.id, lib.f12.id]));
    expect(q.ok).toBe(false); expect(q.issues).toContain('All frames in this combo must be the same size');
    expect(priceCombo(abide, pick(abide, lib.tee, [lib.f16.id, lib.f16.id, lib.f16.id])).ok).toBe(true);
    expect(enumerateConfigs(abide)).toHaveLength(3 * 2);               // garments x sizes (same size only)
  });

  it('a component switched off after publishing is unavailable immediately; archived garments cannot be bought', () => {
    const { behold } = makeCollections(lib);
    const s = pick(behold, lib.hoodie, [lib.f12.id]);
    expect(priceCombo(behold, s, { unavailable: new Set([lib.hoodie.id]) }).issues.join()).toContain('Hoodie is currently unavailable');
    expect(priceCombo(behold, s).ok).toBe(true);
  });

  it('text is cleaned and limited; nothing from the browser can set a price', () => {
    const { behold } = makeCollections(lib);
    const s = pick(behold, lib.tee, [lib.f12.id]);
    const g = behold.slots.find((x) => x.kind === 'garment')!;
    s.units[g.id]![0]!.text = 'A\u0000B\n\n   C ' + 'x'.repeat(500);
    (s as unknown as { priceKobo: number }).priceKobo = 1;           // ignored
    const q = priceCombo(behold, s);
    expect(q.unitKobo).toBe(5000000);
    expect(q.resolved[0]!.customText!.length).toBeLessThanOrEqual(300); expect(q.resolved[0]!.customText).toMatch(/^A B C x+/);
  });
});

describe('admin configuration checks, enumeration and cost', () => {
  it('counts every combination: ABIDE has 3 garments x 4 frame-size sets (mixed allowed)', () => {
    const { abide, behold } = makeCollections(lib);
    expect(enumerateConfigs(abide)).toHaveLength(12);
    expect(enumerateConfigs(behold)).toHaveLength(6);
    expect(startingPrice(behold)).toBe(5000000);
  });

  it('warns about unpriced selections, conflicting fixed prices and bad promotions', () => {
    const { abide } = makeCollections(lib, { base: null });
    expect(configIssues(abide).some((i) => i.message.includes('No selling price is set'))).toBe(true);
    abide.rules.fixed_variants = [
      { id: 'a', component_id: lib.tee.id, signature: frameSignature([lib.f12.id, lib.f12.id, lib.f12.id]), amount_kobo: 7000000, label: 'Tee 3x12' },
      { id: 'b', component_id: lib.tee.id, signature: frameSignature([lib.f12.id, lib.f12.id, lib.f12.id]), amount_kobo: 7100000, label: 'Tee 3x12 again' },
      { id: 'c', component_id: lib.hoodie.id, signature: frameSignature([lib.f12.id]), amount_kobo: 6000000, label: 'Wrong frame count' },
    ];
    abide.rules.discounts = [{ id: 'p', kind: 'promo', type: 'percent', value: 150, label: 'Bad', starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' }];
    const msgs = configIssues(abide).map((i) => i.message).join(' | ');
    expect(msgs).toContain('Two fixed prices exist'); expect(msgs).toContain('does not match this package'); expect(msgs).toContain('between 1 and 100'); expect(msgs).toContain('ends before it starts');
    expect(msgs).toMatch(/\d+ of 12 selections have no price/);
  });

  it('estimates internal cost and gross margin, and reports blanks instead of guessing', () => {
    const { doers } = makeCollections(lib);
    doers.overheads = { printing_apparel_kobo: 500000, frame_artwork_kobo: 300000, packaging_kobo: 200000, labor_kobo: 400000, processing_fee_kobo: 100000, other_kobo: 0 };
    const s = pick(doers, lib.tee, [lib.f12.id]);
    const c = estimateCost(doers, s);
    // tee 10,000 + 12x16 frame 9,000 + diary 7,000 + pen 1,000 + highlight 1,000 + sticky 500 + overheads 15,000 (all in naira)
    expect(c.costKobo).toBe(1000000 + 900000 + 700000 + 100000 + 100000 + 50000 + 1500000);
    expect(c.missing).toEqual([]);
    const price = priceCombo(doers, s).unitKobo;
    const p = profit(price, c.costKobo);
    expect(p.grossKobo).toBe(price - c.costKobo); expect(p.marginPct).toBe(Math.round(((price - c.costKobo) / price) * 1000) / 10);
    const perfume = doers.slots.find((x) => x.label === 'Perfume')!; perfume.components[0]!.internal_cost_kobo = null;
    expect(estimateCost(doers, { ...s, items: { [perfume.id]: { qty: 1 } } }).missing).toEqual(['Perfume']);
  });
});

describe('choosing one of your words', () => {
  const words = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Through Christ That Strengthens Me' }, { id: '22222222-2222-4222-8222-222222222222', name: 'Be Still' }];
  const withWord = (designId: string | undefined) => {
    const { behold } = makeCollections(lib);
    const sel = pick(behold, lib.tee, [lib.f12.id]);
    const g = behold.slots.find((x) => x.kind === 'garment')!, f = behold.slots.find((x) => x.kind === 'frame')!;
    sel.units[g.id]![0]!.designId = designId; sel.units[f.id]![0]!.designId = words[1]!.id;
    return { behold, sel };
  };
  it('records the word on the garment and frame, in the contents and in the order snapshot', () => {
    const { behold, sel } = withWord(words[0]!.id);
    const q = priceCombo(behold, sel, { words });
    expect(q.ok).toBe(true);
    expect(q.resolved.find((r) => r.productName.includes('T-shirt'))).toMatchObject({ word: words[0]!.name, designId: words[0]!.id });
    expect(q.resolved.find((r) => r.option)).toMatchObject({ word: 'Be Still' });
    expect(q.contents.join(' ')).toContain('Word: Through Christ That Strengthens Me');
  });
  it('never changes the price', () => {
    const { behold, sel } = withWord(words[0]!.id);
    expect(priceCombo(behold, sel, { words }).unitKobo).toBe(priceCombo(behold, withWord(undefined).sel, { words }).unitKobo);
  });
  it('refuses a word that no longer exists, so a stale draft cannot be bought', () => {
    const { behold, sel } = withWord('33333333-3333-4333-8333-333333333333');
    const q = priceCombo(behold, sel, { words });
    expect(q.ok).toBe(false); expect(q.issues.join(' ')).toMatch(/word you chose.*no longer available/i);
  });
  it('callers that do not load words simply do not record one', () => {
    const { behold, sel } = withWord(words[0]!.id);
    expect(priceCombo(behold, sel).resolved.every((r) => r.word === undefined)).toBe(true);
  });
});
