import { unstable_cache } from 'next/cache';
import { isSupabaseConfigured } from '@/lib/env';
import { dbMode, getRpc } from '@/lib/db';
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
  // PEMART_FIXTURE_PATH lets local development and the integration tests point at a fixture exported from
  // the SAME database they use (seed UUIDs are random per database build). Never used in production.
  const custom = process.env.PEMART_FIXTURE_PATH;
  if (custom && process.env.NODE_ENV !== 'production') {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(custom, 'utf8')) as Catalogue;
  }
  return (await import('./fixture.json')).default as unknown as Catalogue;
}

export const getCatalogue = unstable_cache(
  async (): Promise<Catalogue> => {
    if (dbMode() === 'pg') {            // local Postgres: read straight from the database so admin edits appear
      const r = await (await getRpc())!<Catalogue>('catalogue_export', {});
      if (r.data) return r.data;
    }
    if (!isSupabaseConfigured) return fromFixture();
    try {
      return await fromSupabase();
    } catch (e) {
      // While `next build` runs, the database may be empty, unreachable or not set up yet (first deploy before the SQL
      // was run). Don't fail the whole deployment: build with the bundled demo catalogue; pages refresh from the real
      // database within minutes (ISR). At runtime we still throw, so a hiccup never replaces good data with demo data.
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.warn(`[catalogue] ${(e as Error).message}; building with the bundled demo catalogue`);
        return fromFixture();
      }
      throw e;
    }
  },
  ['catalogue-v1'],
  { tags: ['catalogue'], revalidate: 300 },
);
