import { unstable_cache } from 'next/cache';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';
import type { Catalogue } from './types';

/**
 * The whole public catalogue is small (dozens of products), so we load it once,
 * cache it, and filter in memory. Admin edits call revalidateTag('catalogue').
 * Without Supabase configured, the seed-derived fixture is used so the store
 * can be reviewed end to end (regenerate with `npm run db:fixture`).
 * If the catalogue ever grows past a few thousand variants, move filtering into SQL.
 */
async function fromSupabase(): Promise<Catalogue> {
  const db = createPublicClient();
  const [collections, designs, products, bundles, zones] = await Promise.all([
    db.from('collections').select('*').eq('is_active', true).order('sort_order'),
    db.from('designs').select('*').eq('is_active', true),
    db.from('products').select('*, product_variants(*), product_images(*)').eq('is_active', true).range(0, 999),
    db.from('bundles').select('*, bundle_slots(*)').order('sort_order'),
    db.from('delivery_zones').select('*').order('sort_order'),
  ]);
  const failed = [collections, designs, products, bundles, zones].find((r) => r.error);
  if (failed?.error) throw new Error(`Catalogue load failed: ${failed.error.message}`);
  const prune = <T extends { product_variants: { is_active: boolean }[]; product_images: { sort_order: number }[] }>(p: T) => ({
    ...p,
    product_variants: p.product_variants.filter((v) => v.is_active),
    product_images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order),
  });
  return {
    collections: collections.data ?? [], designs: (designs.data ?? []) as Catalogue['designs'],
    products: (products.data ?? []).map(prune) as unknown as Catalogue['products'],
    bundles: (bundles.data ?? []) as unknown as Catalogue['bundles'], zones: zones.data ?? [],
  } as Catalogue;
}

async function fromFixture(): Promise<Catalogue> {
  return (await import('./fixture.json')).default as unknown as Catalogue;
}

export const getCatalogue = unstable_cache(
  async (): Promise<Catalogue> => (isSupabaseConfigured ? fromSupabase() : fromFixture()),
  ['catalogue-v1'],
  { tags: ['catalogue'], revalidate: 300 },
);
