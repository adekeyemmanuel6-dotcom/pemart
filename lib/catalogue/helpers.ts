import type { Bundle, Catalogue, CardProduct, Collection, Product, ProductType, Variant } from './types';

// ---------- stock and price ----------
/** null stock = made to order = always available. */
export const availableQty = (v: Variant): number | null => (v.stock_qty === null ? null : Math.max(0, v.stock_qty - v.reserved_qty));
export const isSoldOut = (v: Variant) => availableQty(v) === 0;
export const variantPrice = (p: Product, v: Variant) => v.price_kobo ?? p.base_price_kobo;

export function priceRange(p: Product): { min: number; max: number } {
  const prices = p.product_variants.map((v) => variantPrice(p, v));
  if (!prices.length) return { min: p.base_price_kobo, max: p.base_price_kobo };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

const unique = <T,>(xs: (T | null | undefined)[]): T[] => [...new Set(xs.filter((x): x is T => x != null))];
export const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'A4', 'A3'];
export const sortSizes = (sizes: string[]) => [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
export const productColours = (p: Product) => unique(p.product_variants.map((v) => v.colour));
export const productSizes = (p: Product) => sortSizes(unique(p.product_variants.map((v) => v.size)));
export const productOptions = (p: Product) => unique(p.product_variants.map((v) => v.option));
export const productSoldOut = (p: Product) => p.product_variants.length > 0 && p.product_variants.every(isSoldOut);

// ---------- cards ----------
/** Types that appear in bundle slots get the "Bundle and save" tag. */
export function bundleableTypes(bundles: Bundle[]): Set<string> {
  const set = new Set<string>();
  bundles.forEach((b) => b.bundle_slots.forEach((s) => set.add(s.product_type)));
  return set;
}

export function toCard(cat: Catalogue, p: Product): CardProduct {
  const design = p.design_id ? cat.designs.find((d) => d.id === p.design_id) : undefined;
  const collection = cat.collections.find((c) => c.id === p.collection_id);
  const { min, max } = priceRange(p);
  const real = p.product_images.find((i) => !i.url.startsWith('/placeholders/') && !i.url.startsWith('/designs/'));
  const bundleable = bundleableTypes(cat.bundles);
  return {
    slug: p.slug, name: p.name, type: p.type, designSlug: design?.slug ?? null, collectionSlug: collection?.slug ?? null,
    priceKobo: min, compareAtKobo: p.compare_at_kobo, hasRange: max > min,
    colours: productColours(p), sizes: productSizes(p),
    imageUrl: real?.url ?? (design ? null : p.product_images[0]?.url ?? null),
    featured: p.is_featured, createdAt: p.created_at,
    bundleable: bundleable.has(p.type) && p.type !== 'gift_card',
    madeToOrder: p.is_made_to_order, soldOut: productSoldOut(p),
  };
}

// ---------- listing ----------
export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc';
export type Filters = { type?: ProductType[]; colour?: string[]; size?: string[]; price?: PriceBand | null };
export type PriceBand = 'u15' | '15-30' | '30-50' | '50p';
export const PRICE_BANDS: Record<PriceBand, { label: string; min: number; max: number }> = {
  u15: { label: 'Under ₦15,000', min: 0, max: 1499999 },
  '15-30': { label: '₦15,000 – ₦30,000', min: 1500000, max: 3000000 },
  '30-50': { label: '₦30,000 – ₦50,000', min: 3000001, max: 5000000 },
  '50p': { label: '₦50,000 and above', min: 5000001, max: Number.MAX_SAFE_INTEGER },
};

export function filterCards(cards: CardProduct[], f: Filters): CardProduct[] {
  const band = f.price ? PRICE_BANDS[f.price] : null;
  return cards.filter((c) =>
    (!f.type?.length || f.type.includes(c.type)) &&
    (!f.colour?.length || f.colour.some((x) => c.colours.includes(x))) &&
    (!f.size?.length || f.size.some((x) => c.sizes.includes(x))) &&
    (!band || (c.priceKobo >= band.min && c.priceKobo <= band.max)));
}

export function sortCards(cards: CardProduct[], sort: SortKey): CardProduct[] {
  const out = [...cards];
  const byName = (a: CardProduct, b: CardProduct) => a.name.localeCompare(b.name);
  switch (sort) {
    case 'newest': return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b));
    case 'price-asc': return out.sort((a, b) => a.priceKobo - b.priceKobo || byName(a, b));
    case 'price-desc': return out.sort((a, b) => b.priceKobo - a.priceKobo || byName(a, b));
    default: return out.sort((a, b) => Number(b.featured) - Number(a.featured) || byName(a, b));
  }
}

export function collectionProducts(cat: Catalogue, slug: string): { collection: Collection | null; products: Product[] } {
  if (slug === 'all') return { collection: null, products: cat.products };
  const collection = cat.collections.find((c) => c.slug === slug) ?? null;
  return { collection, products: collection ? cat.products.filter((p) => p.collection_id === collection.id) : [] };
}

export const productBySlug = (cat: Catalogue, slug: string) => cat.products.find((p) => p.slug === slug);

/** Related: same design on other products first, then same collection and type. */
export function relatedProducts(cat: Catalogue, p: Product, limit = 4): Product[] {
  const sameDesign = p.design_id ? cat.products.filter((x) => x.id !== p.id && x.design_id === p.design_id) : [];
  const sameCollection = cat.products.filter((x) => x.id !== p.id && x.collection_id === p.collection_id && x.type === p.type && !sameDesign.includes(x));
  const rest = cat.products.filter((x) => x.id !== p.id && x.is_featured && !sameDesign.includes(x) && !sameCollection.includes(x));
  return [...sameDesign, ...sameCollection, ...rest].slice(0, limit);
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  tee: 'Tees', hoodie: 'Hoodies', frame: 'Frames', perfume: 'Perfume', jewellery: 'Jewellery',
  bracelet: 'Bracelets', glasses: 'Glasses', fun: 'Fun', gift_card: 'Gift cards',
};

// ---------- bundle helpers ----------
const cheapest = (cat: Catalogue, type: string) => {
  const prices = cat.products.filter((p) => p.type === type).map((p) => priceRange(p).min);
  return prices.length ? Math.min(...prices) : 0;
};

/** What the bundle's contents would cost bought separately (a product can stand in for its own slot type). */
export function bundleSeparateTotal(cat: Catalogue, bundle: Bundle, anchor?: Product): number {
  return bundle.bundle_slots.reduce((sum, s) => {
    const fixed = s.allowed_product_id ? cat.products.find((p) => p.id === s.allowed_product_id) : undefined;
    const unit = fixed ? priceRange(fixed).min : anchor && anchor.type === s.product_type ? priceRange(anchor).min : cheapest(cat, s.product_type);
    return sum + unit * s.quantity;
  }, 0);
}

/** The bundle to suggest as "Complete the look" for a product. Combos first, then couples, then gift boxes. */
export function suggestedBundle(cat: Catalogue, p: Product): Bundle | null {
  const rank = { combo: 0, gift_box: 1, couple: 2 } as const;
  const matches = cat.bundles.filter((b) => b.bundle_slots.some((s) => s.product_type === p.type && (!s.allowed_product_id || s.allowed_product_id === p.id)));
  matches.sort((a, b) => rank[a.kind] - rank[b.kind] || Number(!!b.badge) - Number(!!a.badge) || a.sort_order - b.sort_order);
  return matches.find((b) => b.kind !== 'couple') ?? null;
}

/** Gift boxes (and anything with a window) are hidden outside available_from / available_until. */
export const isBundleAvailable = (b: Bundle, now = new Date()) =>
  b.is_active && (!b.available_from || new Date(b.available_from) <= now) && (!b.available_until || new Date(b.available_until) >= now);
