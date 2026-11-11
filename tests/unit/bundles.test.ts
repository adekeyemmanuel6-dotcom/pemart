import { describe, expect, it } from 'vitest';
import fixture from '@/lib/catalogue/fixture.json';
import type { Bundle, Catalogue } from '@/lib/catalogue/types';
import { buildBundleContext, expandSlots, validateSelection, unitOptions, unitProduct, type BundleContext, type BundleSelection } from '@/lib/bundles/selection';

const cat = fixture as unknown as Catalogue;
const bundle = (slug: string) => cat.bundles.find((b) => b.slug === slug) as Bundle;
const NOW = new Date('2026-11-11T10:00:00+01:00');
const ctxOf = (slug: string, now = NOW) => buildBundleContext(cat, bundle(slug), now);

/** A valid selection for any bundle, built from the context itself. */
function validSelection(ctx: BundleContext, pairDesign = 'two-are-better', other = 'seek-first'): BundleSelection {
  return {
    bundleSlug: ctx.bundle.slug,
    choices: ctx.units.map((u) => {
      const p = unitProduct(ctx, u, { key: u.key, designSlug: u.matchingGroup === 'pair' ? pairDesign : other });
      const design = u.designs ? (u.matchingGroup === 'pair' ? pairDesign : other) : undefined;
      const prod = u.designs ? ctx.products[u.designs.find((d) => d.slug === design)!.productSlug]! : p!;
      return {
        key: u.key, designSlug: design,
        colour: u.requiresColour ? prod.variants.find((v) => v.colour)?.colour ?? undefined : undefined,
        size: u.requiresSize ? 'M' : undefined,
        option: u.requiresOption ? unitOptions(u, prod).find((o) => !o.soldOut)?.option : undefined,
        customText: u.requiresCustomText ? 'Ada & Tunde' : undefined,
      };
    }),
  };
}

describe('expandSlots', () => {
  it('turns quantity into separate units', () => {
    expect(expandSlots(bundle('family-box')).length).toBe(6); // 4 tees + 2 orbs
    expect(expandSlots(bundle('starter')).length).toBe(2);
  });
});

describe('buildBundleContext', () => {
  it('limits couple tee slots to the Two of Us designs', () => {
    const ctx = ctxOf('two-of-us-starter');
    const tee = ctx.units[0]!;
    expect(tee.designs?.map((d) => d.slug).sort()).toEqual(['better-together', 'my-beloved', 'two-are-better']);
  });
  it('lets combos pick from every design', () => {
    expect(ctxOf('starter').units[0]!.designs?.length).toBe(20);
  });
  it('is compact enough to ship to the browser', () => {
    expect(JSON.stringify(ctxOf('family-box')).length).toBeLessThan(150_000);
  });
  it('flags a gift box as unavailable after 24 Dec', () => {
    expect(ctxOf('joy-box', new Date('2026-12-24T23:00:00+01:00')).bundle.available).toBe(true);
    expect(ctxOf('joy-box', new Date('2026-12-25T00:30:00+01:00')).bundle.available).toBe(false);
  });
});

describe('validateSelection', () => {
  it('accepts a complete Couple\'s Christmas Box and resolves every variant', () => {
    const ctx = ctxOf('couples-christmas-box');
    const res = validateSelection(ctx, { ...validSelection(ctx), giftMessage: 'Merry Christmas, love', giftWrap: true });
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.resolved.length).toBe(6);
    expect(res.resolved.find((r) => r.label === 'His perfume')?.option).toMatch(/Oud|Cedar|Blue/);
    expect(res.resolved.find((r) => r.label === 'Her perfume')?.option).toMatch(/Rose|Jasmine|Vanilla/);
  });
  it('reports what is missing', () => {
    const ctx = ctxOf('signature');
    const res = validateSelection(ctx, { bundleSlug: 'signature', choices: [] });
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.field)).toContain('design');
    expect(res.issues.length).toBeGreaterThanOrEqual(3);
  });
  it('requires matching items to share a design', () => {
    const ctx = ctxOf('two-of-us-starter');
    const sel = validSelection(ctx);
    sel.choices[1]!.designSlug = 'my-beloved';
    const res = validateSelection(ctx, sel);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /same design/.test(i.message))).toBe(true);
  });
  it('rejects a design outside the allowed set', () => {
    const ctx = ctxOf('two-of-us-starter');
    const sel = validSelection(ctx);
    sel.choices[0]!.designSlug = 'seek-first'; sel.choices[1]!.designSlug = 'seek-first';
    expect(validateSelection(ctx, sel).ok).toBe(false);
  });
  it('rejects the wrong perfume for his/her', () => {
    const ctx = ctxOf('two-of-us-deluxe');
    const sel = validSelection(ctx);
    const his = ctx.units.find((u) => u.label === 'His perfume')!;
    sel.choices.find((c) => c.key === his.key)!.option = 'Velvet Rose';
    expect(validateSelection(ctx, sel).ok).toBe(false);
  });
  it('requires names for the name frame and rejects odd characters', () => {
    const ctx = ctxOf('two-of-us-deluxe');
    const frame = ctx.units.find((u) => u.requiresCustomText)!;
    const sel = validSelection(ctx);
    sel.choices.find((c) => c.key === frame.key)!.customText = '';
    expect(validateSelection(ctx, sel).issues.some((i) => i.field === 'customText')).toBe(true);
    sel.choices.find((c) => c.key === frame.key)!.customText = '<script>';
    expect(validateSelection(ctx, sel).ok).toBe(false);
  });
  it('rejects a sold-out choice', () => {
    const ctx = ctxOf('starter');
    const sel = validSelection(ctx);
    const braceletUnit = ctx.units[1]!;
    const prod = ctx.products[braceletUnit.fixedProductSlug!]!;
    const chosen = sel.choices[1]!.option!;
    prod.variants.find((v) => v.option === chosen)!.soldOut = true;
    expect(validateSelection(ctx, sel).ok).toBe(false);
  });
  it('blocks an expired gift box and overlong gift messages', () => {
    const late = ctxOf('joy-box', new Date('2026-12-26T09:00:00+01:00'));
    expect(validateSelection(late, validSelection(late)).ok).toBe(false);
    const ctx = ctxOf('joy-box');
    expect(validateSelection(ctx, { ...validSelection(ctx), giftMessage: 'x'.repeat(161) }).ok).toBe(false);
  });
  it('rejects selections for another bundle or unknown items', () => {
    const ctx = ctxOf('starter');
    expect(validateSelection(ctx, { ...validSelection(ctx), bundleSlug: 'drip' }).ok).toBe(false);
    const sel = validSelection(ctx); sel.choices.push({ key: 'nope#0' });
    expect(validateSelection(ctx, sel).ok).toBe(false);
  });
});
