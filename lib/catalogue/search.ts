import type { Catalogue } from './types';
import { priceRange } from './helpers';

export type SearchResult = {
  kind: 'product' | 'collection'; slug: string; name: string; href: string;
  priceKobo: number | null; type: string | null; designSlug: string | null; imageUrl: string | null;
};

const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter((t) => /^[a-z0-9]+$/.test(t));

/** Prefix search over names, types and descriptions. Mirrors the Postgres search_catalogue() function and is used when Supabase is not connected. */
export function searchLocal(cat: Catalogue, q: string, max = 12): SearchResult[] {
  const t = tokens(q);
  if (!t.length) return [];
  const hit = (text: string) => { const words = text.toLowerCase().split(/[^a-z0-9]+/); return t.every((tok) => words.some((w) => w.startsWith(tok))); };
  const collections = cat.collections.filter((c) => hit(`${c.name} ${c.intro ?? ''}`)).map((c) => ({ score: 3, r: toCollection(c.slug, c.name) }));
  const products = cat.products.filter((p) => hit(`${p.name} ${p.type}`) || hit(`${p.name} ${p.type} ${p.description ?? ''}`))
    .map((p) => ({ score: hit(`${p.name} ${p.type}`) ? 2 : 1, r: toProduct(cat, p.slug) }));
  return [...collections, ...products].sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.r).filter((r): r is SearchResult => !!r);
}

const toCollection = (slug: string, name: string): SearchResult => ({ kind: 'collection', slug, name, href: `/collections/${slug}`, priceKobo: null, type: null, designSlug: null, imageUrl: null });

export function toProduct(cat: Catalogue, slug: string): SearchResult | null {
  const p = cat.products.find((x) => x.slug === slug);
  if (!p) return null;
  const d = p.design_id ? cat.designs.find((x) => x.id === p.design_id) : undefined;
  const real = p.product_images.find((i) => !i.url.startsWith('/placeholders/') && !i.url.startsWith('/designs/'));
  return { kind: 'product', slug, name: p.name, href: `/products/${slug}`, priceKobo: priceRange(p).min, type: p.type, designSlug: d?.slug ?? null, imageUrl: real?.url ?? (d ? null : p.product_images[0]?.url ?? null) };
}

export { toCollection };
