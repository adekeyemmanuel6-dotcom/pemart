import type { Bundle, BundleSlot, Catalogue, Product } from '@/lib/catalogue/types';
import { bundleSeparateTotal, isBundleAvailable, isSoldOut, sortSizes } from '@/lib/catalogue/helpers';

/**
 * Bundle configuration, shared by the browser (live validation) and the server
 * (authoritative validation at checkout, Phase 4). The context is compact and
 * serialisable so the client never needs the whole catalogue.
 */
export type CtxVariant = { id: string; sku: string; colour: string | null; size: string | null; option: string | null; group: string | null; soldOut: boolean };
export type CtxProduct = { id: string; slug: string; name: string; type: string; variants: CtxVariant[] };
export type CtxDesign = { slug: string; name: string; productSlug: string };
export type CtxUnit = {
  key: string; label: string; slotId: string; productType: string;
  designs: CtxDesign[] | null;           // design slots: the allowed designs
  fixedProductSlug: string | null;       // accessory slots: the one product
  optionGroup: string | null; optionLabel: string | null; frameSize: 'A4' | 'A3' | null;
  requiresSize: boolean; requiresColour: boolean; requiresOption: boolean; requiresCustomText: boolean;
  matchingGroup: string | null;
};
export type BundleContext = {
  bundle: { slug: string; name: string; kind: Bundle['kind']; priceKobo: number; separateKobo: number; available: boolean; availableUntil: string | null };
  units: CtxUnit[];
  products: Record<string, CtxProduct>;
};

export type UnitChoice = { key: string; designSlug?: string; colour?: string; size?: string; option?: string; customText?: string };
export type BundleSelection = { bundleSlug: string; choices: UnitChoice[]; giftMessage?: string; giftWrap?: boolean };

export type ResolvedUnit = {
  key: string; label: string; productId: string; productSlug: string; productName: string; variantId: string; sku: string;
  designSlug?: string; colour?: string; size?: string; option?: string; customText?: string;
};
export type SelectionIssue = { key: string; field: 'design' | 'colour' | 'size' | 'option' | 'customText' | 'bundle' | 'giftMessage'; message: string };
export type SelectionResult = { ok: boolean; issues: SelectionIssue[]; resolved: ResolvedUnit[] };

export const GIFT_MESSAGE_MAX = 160;
export const CUSTOM_TEXT_MAX = 40;
const DESIGN_TYPES = ['tee', 'hoodie', 'frame'];

export const isDesignSlot = (s: BundleSlot) => DESIGN_TYPES.includes(s.product_type) && !s.allowed_product_id;
const frameSizeOf = (s: BundleSlot): 'A4' | 'A3' => (/\bA3\b/i.test(s.label) ? 'A3' : 'A4');

/** One "unit" per physical item: a slot with quantity 2 becomes two units. */
export function expandSlots(bundle: Bundle): { key: string; slot: BundleSlot; index: number; label: string }[] {
  return [...bundle.bundle_slots].sort((a, b) => a.sort_order - b.sort_order).flatMap((slot) =>
    Array.from({ length: slot.quantity }, (_, index) => ({
      key: `${slot.id}#${index}`, slot, index, label: slot.quantity > 1 ? `${slot.label} ${index + 1}` : slot.label,
    })));
}

function allowedDesignSlugs(cat: Catalogue, slot: BundleSlot): string[] {
  const type = slot.product_type;
  const pool = cat.designs.filter((d) => {
    if (slot.allowed_design_ids.length) return slot.allowed_design_ids.includes(d.id);
    if (slot.allowed_collection_id) return d.collection_id === slot.allowed_collection_id;
    return true;
  });
  // Only designs that actually have a product of this type.
  return pool.filter((d) => cat.products.some((p) => p.type === type && p.design_id === d.id)).map((d) => d.slug);
}

const compact = (p: Product): CtxProduct => ({
  id: p.id, slug: p.slug, name: p.name, type: p.type,
  variants: p.product_variants.map((v) => ({ id: v.id, sku: v.sku, colour: v.colour, size: v.size, option: v.option, group: v.option_group, soldOut: isSoldOut(v) })),
});

export function buildBundleContext(cat: Catalogue, bundle: Bundle, now = new Date()): BundleContext {
  const products: Record<string, CtxProduct> = {};
  const units: CtxUnit[] = expandSlots(bundle).map(({ key, slot, label }) => {
    let designs: CtxDesign[] | null = null;
    let fixedProductSlug: string | null = null;
    if (isDesignSlot(slot)) {
      designs = allowedDesignSlugs(cat, slot).map((slug) => {
        const design = cat.designs.find((d) => d.slug === slug)!;
        const product = cat.products.find((p) => p.type === slot.product_type && p.design_id === design.id)!;
        products[product.slug] = compact(product);
        return { slug, name: design.name, productSlug: product.slug };
      });
    } else {
      const product = cat.products.find((p) => p.id === slot.allowed_product_id) ?? cat.products.find((p) => p.type === slot.product_type);
      if (product) { products[product.slug] = compact(product); fixedProductSlug = product.slug; }
    }
    return {
      key, label, slotId: slot.id, productType: slot.product_type, designs, fixedProductSlug,
      optionGroup: slot.option_group, optionLabel: slot.option_label, frameSize: slot.product_type === 'frame' ? frameSizeOf(slot) : null,
      requiresSize: slot.requires_size, requiresColour: slot.requires_colour, requiresOption: slot.requires_option,
      requiresCustomText: slot.requires_custom_text, matchingGroup: slot.matching_group,
    };
  });
  return {
    bundle: { slug: bundle.slug, name: bundle.name, kind: bundle.kind, priceKobo: bundle.price_kobo, separateKobo: bundleSeparateTotal(cat, bundle), available: isBundleAvailable(bundle, now), availableUntil: bundle.available_until },
    units, products,
  };
}

// ---------- helpers the UI also uses ----------
export function unitProduct(ctx: BundleContext, unit: CtxUnit, choice?: UnitChoice): CtxProduct | undefined {
  if (unit.fixedProductSlug) return ctx.products[unit.fixedProductSlug];
  const d = unit.designs?.find((x) => x.slug === choice?.designSlug);
  return d ? ctx.products[d.productSlug] : undefined;
}
const uniq = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];
export const unitColours = (p?: CtxProduct) => (p ? uniq(p.variants.map((v) => v.colour)) : []);
export const unitSizes = (p?: CtxProduct) => (p ? sortSizes(uniq(p.variants.map((v) => v.size))) : []);
export function unitOptions(unit: CtxUnit, p?: CtxProduct): { option: string; soldOut: boolean }[] {
  if (!p) return [];
  const byOption = new Map<string, boolean>();
  for (const v of p.variants) {
    if (!v.option) continue;
    if (unit.optionGroup && v.group !== unit.optionGroup) continue;
    if (unit.frameSize && v.size !== unit.frameSize) continue;
    byOption.set(v.option, (byOption.get(v.option) ?? true) && v.soldOut);
  }
  return [...byOption].map(([option, soldOut]) => ({ option, soldOut }));
}

function resolveVariant(unit: CtxUnit, p: CtxProduct, c: UnitChoice) {
  return p.variants.find((v) =>
    (!unit.requiresColour || v.colour === c.colour) &&
    (!unit.requiresSize || v.size === c.size) &&
    (!unit.frameSize || v.size === unit.frameSize) &&
    (!unit.requiresOption || v.option === c.option) &&
    (!unit.optionGroup || v.group === unit.optionGroup));
}

/** Validate a selection against the context. Pure: used by the builder UI and again on the server. */
export function validateSelection(ctx: BundleContext, sel: BundleSelection): SelectionResult {
  const issues: SelectionIssue[] = [];
  const resolved: ResolvedUnit[] = [];
  const add = (key: string, field: SelectionIssue['field'], message: string) => issues.push({ key, field, message });

  if (sel.bundleSlug !== ctx.bundle.slug) add('bundle', 'bundle', 'This selection is for a different bundle');
  if (!ctx.bundle.available) add('bundle', 'bundle', ctx.bundle.kind === 'gift_box' ? 'This gift box is no longer available' : 'This bundle is no longer available');
  if ((sel.giftMessage ?? '').length > GIFT_MESSAGE_MAX) add('bundle', 'giftMessage', `Gift message must be ${GIFT_MESSAGE_MAX} characters or fewer`);

  const known = new Set(ctx.units.map((u) => u.key));
  for (const c of sel.choices) if (!known.has(c.key)) add(c.key, 'bundle', 'Unknown item in selection');

  const groupDesign = new Map<string, string>();
  for (const unit of ctx.units) {
    const c = sel.choices.find((x) => x.key === unit.key) ?? { key: unit.key };
    const before = issues.length;

    if (unit.designs) {
      if (!c.designSlug) add(unit.key, 'design', `Choose a design for ${unit.label}`);
      else if (!unit.designs.some((d) => d.slug === c.designSlug)) add(unit.key, 'design', `That design is not available for ${unit.label}`);
      else if (unit.matchingGroup) {
        const first = groupDesign.get(unit.matchingGroup);
        if (first && first !== c.designSlug) add(unit.key, 'design', 'Matching items must use the same design');
        groupDesign.set(unit.matchingGroup, first ?? c.designSlug);
      }
    }
    const p = unitProduct(ctx, unit, c);
    if (!p) { if (issues.length === before) add(unit.key, 'design', `Nothing selected for ${unit.label}`); continue; }

    if (unit.requiresColour) { if (!c.colour) add(unit.key, 'colour', `Choose a colour for ${unit.label}`); else if (!unitColours(p).includes(c.colour)) add(unit.key, 'colour', 'That colour is not available'); }
    if (unit.requiresSize) { if (!c.size) add(unit.key, 'size', `Choose a size for ${unit.label}`); else if (!unitSizes(p).includes(c.size)) add(unit.key, 'size', 'That size is not available'); }
    if (unit.requiresOption) {
      const opts = unitOptions(unit, p);
      if (!c.option) add(unit.key, 'option', `Choose a ${(unit.optionLabel ?? 'style').toLowerCase()} for ${unit.label}`);
      else if (!opts.some((o) => o.option === c.option)) add(unit.key, 'option', `That ${(unit.optionLabel ?? 'style').toLowerCase()} is not available`);
    }
    if (unit.requiresCustomText) {
      const t = (c.customText ?? '').trim();
      if (!t) add(unit.key, 'customText', `Add the names for ${unit.label}`);
      else if (t.length > CUSTOM_TEXT_MAX) add(unit.key, 'customText', `Keep it to ${CUSTOM_TEXT_MAX} characters`);
      else if (!/^[\p{L}\p{N} &'.,\-+]+$/u.test(t)) add(unit.key, 'customText', 'Use letters, numbers and simple punctuation only');
    }
    if (issues.length > before) continue;

    const v = resolveVariant(unit, p, c);
    if (!v) { add(unit.key, 'option', `That combination is not available for ${unit.label}`); continue; }
    if (v.soldOut) { add(unit.key, 'option', `${unit.label} is sold out in that choice`); continue; }
    resolved.push({
      key: unit.key, label: unit.label, productId: p.id, productSlug: p.slug, productName: p.name, variantId: v.id, sku: v.sku,
      designSlug: c.designSlug, colour: c.colour, size: unit.frameSize ?? c.size, option: c.option, customText: c.customText?.trim() || undefined,
    });
  }
  return { ok: issues.length === 0, issues, resolved };
}

/** How many choices still need attention (for "3 of 6 chosen" progress). */
export const completedUnits = (ctx: BundleContext, sel: BundleSelection) =>
  ctx.units.filter((u) => !validateSelection({ ...ctx, units: [u], bundle: { ...ctx.bundle, available: true } }, { ...sel, choices: sel.choices.filter((c) => c.key === u.key) }).issues.some((i) => i.key === u.key)).length;
