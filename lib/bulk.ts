/** Group pricing tiers shown on /bulk. 100+ is by quote. Applied by us when we quote, not at checkout. */
export const BULK_TIERS = [
  { min: 10, max: 24, discountPct: 10 as number | null, label: '10 to 24 pieces', note: '10% off' },
  { min: 25, max: 99, discountPct: 15 as number | null, label: '25 to 99 pieces', note: '15% off' },
  { min: 100, max: Infinity, discountPct: null as number | null, label: '100+ pieces', note: 'Custom quote' },
];
export const BULK_MIN = 10;

export function bulkTier(qty: number) {
  return BULK_TIERS.find((t) => qty >= t.min && qty <= t.max) ?? null;
}
