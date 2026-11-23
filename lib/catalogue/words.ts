import { priceRange, toCard } from './helpers';
import type { CardProduct, Catalogue, Design, ProductType } from './types';

const ORDER: ProductType[] = ['tee', 'sweatshirt', 'hoodie'];
const GROUP_LABEL: Partial<Record<ProductType, string>> = { tee: 'T-shirts', sweatshirt: 'Sweatshirts', hoodie: 'Hoodies', frame: 'Frames' };
const QUALITY_RANK = { normal: 0, premium: 1 } as const;

export type WordGroup = { type: ProductType; label: string; products: CardProduct[] };

/** Active products that carry a design (a "word"). */
const productsOf = (cat: Catalogue, design: Design) => cat.products.filter((p) => p.is_active && p.design_id === design.id);

/** Every word that has at least one product on sale, with how many garments it comes in and the lowest price. */
export function listWords(cat: Catalogue) {
  return cat.designs
    .map((design) => {
      const ps = productsOf(cat, design);
      if (!ps.length) return null;
      const cards = ps.map((p) => toCard(cat, p));
      const cover = cards.find((c) => c.imageUrl) ?? cards[0]!;
      return { design, count: ps.length, fromKobo: Math.min(...ps.map((p) => priceRange(p).min)), cover };
    })
    .filter((w): w is NonNullable<typeof w> => w !== null);
}

/** One word's products, grouped by garment: T-shirts (Normal before Premium), sweatshirts, hoodies, then anything else. */
export function wordGarments(cat: Catalogue, design: Design): WordGroup[] {
  const ps = productsOf(cat, design);
  const types = [...ORDER.filter((t) => ps.some((p) => p.type === t)), ...[...new Set(ps.map((p) => p.type))].filter((t) => !ORDER.includes(t))];
  return types.map((type) => ({
    type,
    label: GROUP_LABEL[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
    products: ps
      .filter((p) => p.type === type)
      .sort((a, b) => (QUALITY_RANK[a.quality ?? 'premium'] ?? 2) - (QUALITY_RANK[b.quality ?? 'premium'] ?? 2) || priceRange(a).min - priceRange(b).min)
      .map((p) => toCard(cat, p)),
  }));
}
