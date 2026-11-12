import fixture from '@/lib/catalogue/fixture.json';
import type { Bundle, Catalogue } from '@/lib/catalogue/types';
import { buildBundleContext, unitOptions, unitProduct, type BundleSelection } from '@/lib/bundles/selection';
import { priceCart } from '@/lib/checkout/pricing';
import type { DbContext, PricingInput, PricingSettings } from '@/lib/checkout/types';

const source = fixture as unknown as Catalogue;
// Verified synthetic rates for pricing tests only. Production defaults remain unverified.
export const cat: Catalogue = { ...source, zones: source.zones.map((z) => ({...z, rate_verified:true, is_active:true, free_shipping_eligible:true, min_days:z.lead_days, max_days:z.lead_days})) };
export const NOW = new Date('2026-11-11T10:00:00+01:00');
export const SETTINGS: PricingSettings = { giftWrapKobo: 200000, surpriseNoteKobo: 300000, expressKobo: 500000, expressEnabled: true, upsellProductId: cat.products.find((p) => p.slug === 'faith-bracelet')!.id, upsellPriceKobo: 450000, revisionFeeKobo: 200000 };

export const variantOf = (sku: string) => cat.products.flatMap((p) => p.product_variants).find((v) => v.sku === sku)!;
export const tee = () => variantOf('SEEK-FIRST-TEE-BLACK-M');
export const line = (variantId: string, quantity = 1, extra: object = {}) => ({ id: crypto.randomUUID(), kind: 'variant' as const, refId: variantId, quantity, ...extra });

export function bundleSelection(slug: string, over: Partial<BundleSelection> = {}, catalogue: Catalogue = cat): BundleSelection {
  const ctx = buildBundleContext(catalogue, catalogue.bundles.find((b) => b.slug === slug) as Bundle, NOW);
  return {
    bundleSlug: slug,
    choices: ctx.units.map((u) => {
      const design = u.designs ? (u.matchingGroup === 'pair' ? 'two-are-better' : 'seek-first') : undefined;
      const prod = u.designs ? ctx.products[u.designs.find((d) => d.slug === design)!.productSlug]! : unitProduct(ctx, u)!;
      return { key: u.key, designSlug: design, colour: u.requiresColour ? 'Black' : undefined, size: u.requiresSize ? 'M' : undefined,
        option: u.requiresOption ? unitOptions(u, prod).find((o) => !o.soldOut)?.option : undefined, customText: u.requiresCustomText ? 'Ada & Tunde' : undefined };
    }),
    ...over,
  };
}

export const price = (input: Partial<PricingInput> & { lines: PricingInput['lines'] }, ctx: DbContext = {}, now = NOW, settings = SETTINGS) =>
  priceCart(cat, settings, ctx, { state: 'Lagos', city: 'Test city', acceptFinalSale: true, ...input }, now);

export const discountCtx = (over: Partial<NonNullable<DbContext['discount']>> = {}): DbContext => ({
  discount: { id: 'd1', code: 'PEMART10', type: 'percentage', value: 10, min_spend_kobo: 0, starts_at: null, ends_at: null, usage_limit: null, times_used: 0, per_customer_limit: null, customer_uses: 0, collection_ids: [], product_ids: [], ambassador_id: null, ambassador_rate: null, ...over },
});
