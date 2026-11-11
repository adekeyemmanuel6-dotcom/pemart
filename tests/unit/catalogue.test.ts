import { describe, expect, it } from 'vitest';
import fixture from '@/lib/catalogue/fixture.json';
import type { Catalogue } from '@/lib/catalogue/types';
import { availableQty, collectionProducts, filterCards, priceRange, relatedProducts, sortCards, toCard, isSoldOut } from '@/lib/catalogue/helpers';
import { formatDeliveryDate, promisedDate, zoneForState } from '@/lib/delivery';

const cat = fixture as unknown as Catalogue;
const cards = cat.products.map((p) => toCard(cat, p));

describe('catalogue data', () => {
  it('has the seeded shape', () => {
    expect(cat.collections.length).toBe(6);
    expect(cat.products.length).toBe(59);
    expect(cat.bundles.length).toBe(11);
  });
  it('every product has at least one active variant and an image', () => {
    for (const p of cat.products) {
      expect(p.product_variants.length, p.slug).toBeGreaterThan(0);
      expect(p.product_images.length, p.slug).toBeGreaterThan(0);
    }
  });
});

describe('listing', () => {
  it('lists a collection by slug and everything for "all"', () => {
    expect(collectionProducts(cat, 'all').products.length).toBe(59);
    const kingdom = collectionProducts(cat, 'kingdom');
    expect(kingdom.collection?.name).toBe('Kingdom');
    expect(kingdom.products.length).toBe(24); // 8 designs x tee, hoodie, frame
    expect(collectionProducts(cat, 'nope').collection).toBeNull();
  });
  it('filters by type, colour, size and price band', () => {
    expect(filterCards(cards, { type: ['tee'] }).every((c) => c.type === 'tee')).toBe(true);
    expect(filterCards(cards, { colour: ['Sand'] }).every((c) => c.colours.includes('Sand'))).toBe(true);
    expect(filterCards(cards, { size: ['XXL'], type: ['hoodie'] }).length).toBe(20);
    const under15 = filterCards(cards, { price: 'u15' });
    expect(under15.length).toBeGreaterThan(0);
    expect(under15.every((c) => c.priceKobo < 1500000)).toBe(true);
  });
  it('sorts by price and newest deterministically', () => {
    const asc = sortCards(cards, 'price-asc').map((c) => c.priceKobo);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortCards(cards, 'price-desc').map((c) => c.priceKobo);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(sortCards(cards, 'featured')[0]?.featured).toBe(true);
  });
});

describe('pricing and stock', () => {
  it('frames show a price range (A3 costs more)', () => {
    const frame = cat.products.find((p) => p.type === 'frame')!;
    expect(priceRange(frame)).toEqual({ min: 1500000, max: 2500000 });
    expect(toCard(cat, frame).hasRange).toBe(true);
  });
  it('treats null stock as made to order and subtracts reservations', () => {
    const tee = cat.products.find((p) => p.type === 'tee')!.product_variants[0]!;
    expect(availableQty(tee)).toBeNull();
    const stocked = { ...tee, stock_qty: 3, reserved_qty: 3 };
    expect(availableQty(stocked)).toBe(0);
    expect(isSoldOut(stocked)).toBe(true);
    expect(isSoldOut({ ...stocked, reserved_qty: 1 })).toBe(false);
  });
  it('tags bundle-able products', () => {
    expect(cards.find((c) => c.type === 'tee')?.bundleable).toBe(true);
    expect(cards.find((c) => c.type === 'gift_card')?.bundleable).toBe(false);
  });
  it('suggests the same design on other garments first', () => {
    const tee = cat.products.find((p) => p.slug === 'seek-first-tee')!;
    const rel = relatedProducts(cat, tee);
    expect(rel[0]?.design_id).toBe(tee.design_id);
    expect(rel.find((r) => r.id === tee.id)).toBeUndefined();
  });
});

describe('delivery', () => {
  it('maps states to zones and adds lead days', () => {
    expect(zoneForState(cat.zones, 'Lagos')?.name).toBe('Lagos');
    expect(zoneForState(cat.zones, 'Ogun')?.name).toBe('South-West');
    expect(zoneForState(cat.zones, 'Kano')?.name).toBe('Other states');
    const d = promisedDate(new Date('2026-12-10T12:00:00Z'), 5);
    expect(d.toISOString().slice(0, 10)).toBe('2026-12-15');
    expect(formatDeliveryDate(d)).toContain('15');
  });
});
