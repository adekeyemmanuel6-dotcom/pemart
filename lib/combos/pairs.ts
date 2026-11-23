import type { ComboConfig } from './types';

/** A collection and its couples edition (two garments), when both are published. */
export function editions(collections: ComboConfig[], c: ComboConfig): { single: ComboConfig; couples: ComboConfig | null } | null {
  if (c.pair_of) {
    const single = collections.find((x) => x.slug === c.pair_of);
    return single ? { single, couples: c } : null;
  }
  const couples = collections.find((x) => x.pair_of === c.slug) ?? null;
  return couples ? { single: c, couples } : null;
}

/** Collections to list: a couples edition is reached from its single-person collection, so it is not listed twice. A couples edition whose single collection is not published stands alone. */
export const listedCollections = (collections: ComboConfig[]) => collections.filter((c) => !(c.pair_of && collections.some((x) => x.slug === c.pair_of)));

/** How many garments the package contains (2 for a couples edition). */
export const garmentCount = (c: ComboConfig) => c.slots.filter((s) => s.kind === 'garment' && s.mode !== 'unavailable').reduce((n, s) => n + s.quantity, 0);
