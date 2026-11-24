import { describe, expect, it } from 'vitest';
import { FONT_CHOICES, FONT_IDS, bodyFontIds, fontStack, headingFontIds } from '@/lib/fonts';
import { ComboSettingsSchema } from '@/lib/combos/schema';
import { siteCollections } from '@/lib/combos/structure';
import { resolveWebsite, DEFAULT_WEBSITE } from '@/lib/website/schema';
import { makeCollections, makeLibrary } from '../helpers/combo-fixture';
import type { ComboCatalogue, ComboConfig } from '@/lib/combos/types';

const settings = ComboSettingsSchema.parse({});
const lib = makeLibrary();
const base = makeCollections(lib, { base: 5000000 });
const named = (c: ComboConfig, over: Partial<ComboConfig>) => ({ ...c, ...over }) as ComboConfig;
const couplesOf = (single: ComboConfig, slug: string, base_price: number) => { const c = named(structuredClone(single), { id: `${slug}-id`, slug, name: `${single.name} FOR COUPLES`, pair_of: single.slug }); c.rules.base_price_kobo = base_price; c.slots.find((s) => s.kind === 'garment')!.quantity = 2; return c; };

describe('the site follows the combo collections', () => {
  it('lists the published collections in order, then one Couples Collection when a couples edition is published', () => {
    const cat: ComboCatalogue = { collections: [named(base.behold, { sort_order: 1 }), named(base.abide, { sort_order: 2 }), named(base.doers, { sort_order: 3 }), couplesOf(base.behold, 'behold-couples', 8000000)], unavailable: [], words: [] };
    const t = siteCollections(cat, settings);
    expect(t.map((x) => x.name)).toEqual([base.behold.name, base.abide.name, base.doers.name, 'Couples Collection']);
    expect(t.map((x) => x.href)).toEqual([`/combos/${base.behold.slug}`, `/combos/${base.abide.slug}`, `/combos/${base.doers.slug}`, '/couples']);
    expect(t[3]).toMatchObject({ couples: true, fromKobo: 8000000 });
    expect(t.slice(0, 3).every((x) => !x.couples)).toBe(true);
  });
  it('shows nothing until something is published, and no couples tile without a couples edition', () => {
    expect(siteCollections({ collections: [], unavailable: [], words: [] }, settings)).toEqual([]);
    const only = siteCollections({ collections: [base.behold], unavailable: [], words: [] }, settings);
    expect(only).toHaveLength(1); expect(only.some((x) => x.couples)).toBe(false);
  });
  it('the couples tile uses the owner’s name, line and picture; otherwise the first edition picture', () => {
    const edition = couplesOf(base.behold, 'behold-couples', 8000000); edition.image_url = '/edition.jpg';
    const cat: ComboCatalogue = { collections: [base.behold, edition], unavailable: [], words: [] };
    expect(siteCollections(cat, settings).find((x) => x.couples)!.image).toBe('/edition.jpg');
    const custom = ComboSettingsSchema.parse({ collections: { couplesName: 'For Two', couplesTagline: 'Together.', couplesImageUrl: '/two.jpg' } });
    expect(siteCollections(cat, custom).find((x) => x.couples)).toMatchObject({ name: 'For Two', tagline: 'Together.', image: '/two.jpg' });
  });
  it('a couples edition whose single collection is not published stands alone and is not turned into a couples tile twice', () => {
    const orphan = couplesOf(base.behold, 'behold-couples', 8000000);
    const t = siteCollections({ collections: [orphan], unavailable: [], words: [] }, settings);
    expect(t.filter((x) => x.couples)).toHaveLength(0);       // no single to pair with: it is listed as itself
    expect(t.map((x) => x.href)).toEqual(['/combos/behold-couples']);
  });
  it('an unpriced collection says so instead of inventing a price', () => {
    const unpriced = makeCollections(lib, { base: null });
    expect(siteCollections({ collections: [unpriced.behold], unavailable: [], words: [] }, settings)[0]!.fromKobo).toBeNull();
  });
  it('the homepage copy has editable defaults', () => {
    expect(settings.collections).toMatchObject({ show: true, kicker: 'Our Collections', headline: 'Choose Your Collection', couplesName: 'Couples Collection' });
  });
});

describe('overall fonts', () => {
  it('every choice has a stack that starts with the ₦-capable system font, and "default" leaves the original look', () => {
    expect(fontStack('default')).toBeNull(); expect(fontStack(undefined)).toBeNull(); expect(fontStack('nonsense')).toBeNull();
    for (const id of FONT_IDS.filter((x) => x !== 'default')) expect(fontStack(id)!.startsWith("'Naira',"), id).toBe(true);
  });
  it('headings and paragraphs offer sensible lists', () => {
    expect(headingFontIds).toContain('anton'); expect(headingFontIds).toContain('playfair'); expect(headingFontIds).not.toContain('inter');
    expect(bodyFontIds).toContain('inter'); expect(bodyFontIds).toContain('lora'); expect(bodyFontIds).not.toContain('anton'); expect(bodyFontIds).not.toContain('bebas');
    for (const c of Object.values(FONT_CHOICES)) expect(c.heading || c.body).toBe(true);
  });
  it('older saved content without the new fields still loads, and a bad value falls back safely', () => {
    const oldBrand = { ...DEFAULT_WEBSITE.brand } as Record<string, unknown>; delete oldBrand.headingFont; delete oldBrand.bodyFont;
    const w = resolveWebsite({ website_content: { ...DEFAULT_WEBSITE, brand: { ...oldBrand, name: 'Kept Name' } } } as never);
    expect(w.brand.name).toBe('Kept Name');
    expect(w.brand.headingFont).toBe('default'); expect(w.brand.bodyFont).toBe('default');
    const bad = resolveWebsite({ website_content: { ...DEFAULT_WEBSITE, brand: { ...DEFAULT_WEBSITE.brand, name: 'My Shop', headingFont: 'comic-sans' } } } as never);
    expect(bad.brand.headingFont).toBe('default');
    expect(bad.brand.name).toBe('My Shop');                    // one bad value never throws away the rest of the saved content
  });
});
