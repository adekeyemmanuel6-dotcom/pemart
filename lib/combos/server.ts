import 'server-only';
import { unstable_cache } from 'next/cache';
import { getRpc } from '@/lib/db';
import { resolveComboSettings, type ComboSettings } from './schema';
import type { ComboCatalogue, ComboConfig } from './types';

const EMPTY: ComboCatalogue = { collections: [], unavailable: [] };

/**
 * Published combos for pages and the calculator (selling data only). Cached for a minute and refreshed when an admin
 * publishes. NEVER used to charge anyone: the bag and checkout read `combo_public_list` live (see lib/checkout/service.ts).
 * Never throws: with no database, or before migration 0024, there are simply no combos.
 */
export const getComboCatalogue = unstable_cache(
  async (): Promise<ComboCatalogue> => {
    try {
      const rpc = await getRpc();
      if (!rpc) return EMPTY;
      const r = await rpc<ComboCatalogue>('combo_public_list', {});
      return r.error || !r.data ? EMPTY : r.data;
    } catch { return EMPTY; }
  },
  ['combo-catalogue-v1'],
  { tags: ['combos'], revalidate: 60 },
);

export const getComboSettings = unstable_cache(
  async (): Promise<ComboSettings> => {
    try {
      const rpc = await getRpc();
      const r = rpc ? await rpc<Record<string, unknown>>('combo_settings_get', {}) : null;
      return resolveComboSettings(r && !r.error ? r.data : {});
    } catch { return resolveComboSettings({}); }
  },
  ['combo-settings-v1'],
  { tags: ['combos'], revalidate: 300 },
);

export async function getComboBySlug(slug: string): Promise<{ config: ComboConfig; unavailable: string[] } | null> {
  const cat = await getComboCatalogue();
  const config = cat.collections.find((c) => c.slug === slug);
  return config ? { config, unavailable: cat.unavailable } : null;
}
