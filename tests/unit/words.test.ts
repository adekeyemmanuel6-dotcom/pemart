import { describe, expect, it } from 'vitest';
import { listWords, wordGarments } from '@/lib/catalogue/words';
import type { Catalogue, Product } from '@/lib/catalogue/types';

const prod = (slug: string, type: Product['type'], design: string | null, price: number, quality: Product['quality'] = null, active = true): Product => ({
  id: slug, slug, name: slug, type, design_id: design, collection_id: null, description: null, care: null, base_price_kobo: price, compare_at_kobo: null,
  is_made_to_order: true, is_active: active, is_featured: false, is_seasonal: false, seo_title: null, seo_description: null, created_at: '2026-01-01', quality,
  product_variants: [{ id: `${slug}-v`, product_id: slug, sku: slug, colour: 'Black', size: 'M', option: null, option_group: null, price_kobo: null, stock_qty: 5, reserved_qty: 0, is_active: true }], product_images: [],
});
const cat = {
  collections: [], bundles: [], zones: [],
  designs: [{ id: 'd1', slug: 'through-christ', name: 'Through Christ', story_or_verse: null, verse_reference: 'Phil 4:13', collection_id: null, artwork_front: null, artwork_back: null, preview_image: null, is_customisable: false }, { id: 'd2', slug: 'empty', name: 'Empty', story_or_verse: null, verse_reference: null, collection_id: null, artwork_front: null, artwork_back: null, preview_image: null, is_customisable: false }],
  products: [prod('hood', 'hoodie', 'd1', 2_000_000), prod('tee-p', 'tee', 'd1', 1_800_000, 'premium'), prod('sweat', 'sweatshirt', 'd1', 1_500_000), prod('tee-n', 'tee', 'd1', 1_200_000, 'normal'), prod('hidden', 'tee', 'd1', 100, 'normal', false), prod('other', 'tee', null, 900_000)],
} as unknown as Catalogue;

describe('word pages', () => {
  it('lists only words that have products on sale, with the lowest price', () => {
    const w = listWords(cat);
    expect(w.map((x) => x.design.slug)).toEqual(['through-christ']);
    expect(w[0]).toMatchObject({ count: 4, fromKobo: 1_200_000 });
  });
  it('groups garments T-shirts, sweatshirts, hoodies, with Normal before Premium', () => {
    const g = wordGarments(cat, cat.designs[0]!);
    expect(g.map((x) => x.label)).toEqual(['T-shirts', 'Sweatshirts', 'Hoodies']);
    expect(g[0]!.products.map((p) => p.slug)).toEqual(['tee-n', 'tee-p']);
    expect(g[0]!.products.map((p) => p.quality)).toEqual(['normal', 'premium']);
  });
  it('a word with nothing on sale has no garments', () => { expect(wordGarments(cat, cat.designs[1]!)).toEqual([]); });
});
