import type { Catalogue, Product } from './catalogue/types';

export const WORD_THEMES = [
  'Faith',
  'Grace',
  'Identity',
  'Purpose',
  'Hope',
  'Victory',
  'Love',
  'Salvation',
  'Confidence',
  "God's promises",
] as const;
export const BRAND_COLLECTIONS = [
  {
    slug: 'identity',
    name: 'The Identity Collection',
    blurb: 'Remember who you are. Wear it with conviction.',
    themes: ['Identity', 'Grace', 'Confidence'],
  },
  {
    slug: 'declaration',
    name: 'The Declaration Collection',
    blurb: 'A quiet faith. A bold declaration.',
    themes: ['Faith', 'Victory', 'Salvation'],
  },
  {
    slug: 'scripture',
    name: 'The Scripture Collection',
    blurb: 'Timeless truth. Everyday expression.',
    themes: ["God's promises", 'Hope', 'Purpose'],
  },
  { slug: 'together', name: 'The Together Collection', blurb: 'One faith. Shared in your own way.', themes: ['Love'] },
  {
    slug: 'word-gifts',
    name: 'The Word Gift Collection',
    blurb: 'A thoughtful gift. A message that stays.',
    themes: [],
  },
] as const;

/** Explicit admin assignments only. Never rename or duplicate catalogue records. */
export function brandProducts(cat: Catalogue, slug: string): Product[] {
  const direct = cat.collections.find((c) => c.slug === slug);
  const group = BRAND_COLLECTIONS.find((c) => c.slug === slug);
  return cat.products.filter(
    (p) =>
      p.is_active &&
      ((direct && p.collection_id === direct.id) ||
        p.brand_collections?.includes(slug) ||
        (group && p.themes?.some((t) => (group.themes as readonly string[]).includes(t)))),
  );
}
