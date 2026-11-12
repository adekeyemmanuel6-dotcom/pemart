import { buildBundleContext, validateSelection } from '@/lib/bundles/selection';
import { availableQty, variantPrice } from '@/lib/catalogue/helpers';
import type { Bundle, Catalogue, Product, Variant } from '@/lib/catalogue/types';
import { TIERS } from '@/lib/custom/tiers';
import { clampKobo, percentOf } from '@/lib/money';
import { formatNaira } from '@/lib/money';
import { promisedDate, formatDeliveryDate } from '@/lib/delivery';
import { FREE_DELIVERY_KOBO, SHIPPING_PENDING, shippingQuote } from '@/lib/shipping';
import type { CartLineInput, DbContext, DbItem, PricingInput, PricingSettings, Quote, QuoteLine } from './types';

export const MAX_LINE_QTY = 20;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * THE pricing engine. Pure: (catalogue, settings, database context, what the customer chose) -> a full quote.
 * The browser only ever says WHAT is in the bag. Every price, discount, fee and total is computed here.
 * The same function powers the bag preview and the real checkout, so they cannot disagree.
 */
export function priceCart(cat: Catalogue, settings: PricingSettings, ctx: DbContext, input: PricingInput, now = new Date()): Quote {
  const issues: string[] = [];
  const warnings: string[] = [];
  const lines: QuoteLine[] = [];
  const dbItems: DbItem[] = [];
  const reserve = new Map<string, number>();
  const hold = (variantId: string, qty: number, variant: Variant) => { if (variant.stock_qty !== null) reserve.set(variantId, (reserve.get(variantId) ?? 0) + qty); };

  const variantIndex = new Map<string, { product: Product; variant: Variant }>();
  for (const p of cat.products) for (const v of p.product_variants) variantIndex.set(v.id, { product: p, variant: v });

  // product id -> collection id, for discount restrictions
  const eligibleByLine = new Map<string, { kobo: number; productIds: string[]; collectionIds: string[]; discountable: boolean }>();
  let wrapUnits = 0;
  let hasCustom = false, hasBundle = false, hasReadyPhysical = false, hasGiftCard = false, hasGiftBox = false;
  let proofHours = 0;
  let customOnlyExpressBlock = false; // a bundle with printed names is personalised, so no express

  const upsellAnchor = input.lines.some((l) => l.kind !== 'variant' || !l.upsell);

  for (const raw of input.lines.slice(0, 50)) {
    const qtyOk = Number.isInteger(raw.quantity) && raw.quantity >= 1 && raw.quantity <= MAX_LINE_QTY;
    const quantity = qtyOk ? raw.quantity : Math.min(Math.max(1, Math.trunc(raw.quantity) || 1), MAX_LINE_QTY);
    const base = { id: raw.id, quantity, issues: [] as string[], upsell: false };
    const bad = (partial: Partial<QuoteLine>, msg: string) => lines.push({ ...base, kind: 'variant', name: 'Unavailable item', detail: [], contents: [], unitKobo: 0, lineKobo: 0, visual: { type: 'tee', designSlug: null, colour: null, finish: null, imageUrl: null }, ...partial, issues: [msg] });
    if (!qtyOk) base.issues.push(`Quantity must be between 1 and ${MAX_LINE_QTY}`);

    // ---------------------------------------------------------------- variant lines
    if (raw.kind === 'variant') {
      const hit = variantIndex.get(raw.refId);
      if (!hit || !hit.product.is_active || !hit.variant.is_active) { bad({ id: raw.id, quantity }, 'This item is no longer available'); continue; }
      const { product, variant } = hit;
      const design = product.design_id ? cat.designs.find((d) => d.id === product.design_id) : undefined;
      const isGiftCard = product.type === 'gift_card';
      let unit = variantPrice(product, variant);
      let upsell = false;
      if (raw.upsell) {
        if (product.id === settings.upsellProductId && settings.upsellPriceKobo != null && upsellAnchor) { unit = settings.upsellPriceKobo; upsell = true; }
        else base.issues.push('The special offer price is not available');
      }
      const avail = availableQty(variant);
      if (avail !== null && avail < quantity) base.issues.push(avail === 0 ? 'Sold out' : `Only ${avail} left`);
      const effectiveQty = upsell ? 1 : quantity;
      const detail = [variant.colour, variant.size, variant.option].filter((x): x is string => !!x);
      const line: QuoteLine = {
        ...base, quantity: effectiveQty, upsell, kind: isGiftCard ? 'gift_card' : 'variant', name: product.name, detail, contents: [], slug: product.slug,
        unitKobo: unit, lineKobo: unit * effectiveQty,
        visual: { type: product.type, designSlug: design?.slug ?? null, colour: variant.colour, finish: product.type === 'frame' ? variant.option : null, imageUrl: product.design_id ? null : product.product_images[0]?.url ?? null },
      };
      lines.push(line);
      eligibleByLine.set(raw.id, { kobo: line.lineKobo, productIds: [product.id], collectionIds: product.collection_id ? [product.collection_id] : [], discountable: !isGiftCard });
      if (isGiftCard) {
        hasGiftCard = true;
        const email = raw.giftCard?.recipientEmail?.trim() ?? '';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) line.issues.push('Enter a valid recipient email');
        dbItems.push({ kind: 'gift_card', variant_id: variant.id, name: `Gift card ${formatNaira(unit)}`, options: { recipient_email: email || undefined, message: raw.giftCard?.message?.slice(0, 300) }, unit_price: unit, quantity: effectiveQty });
      } else {
        hasReadyPhysical = true;
        dbItems.push({ kind: 'variant', variant_id: variant.id, name: product.name, options: { colour: variant.colour, size: variant.size, option: variant.option, designSlug: design?.slug }, unit_price: unit, quantity: effectiveQty });
        hold(variant.id, effectiveQty, variant);
      }
      continue;
    }

    // ---------------------------------------------------------------- bundle lines
    if (raw.kind === 'bundle') {
      const bundle = cat.bundles.find((b: Bundle) => b.slug === raw.refId);
      if (!bundle) { bad({ id: raw.id, quantity, kind: 'bundle' }, 'This bundle is no longer available'); continue; }
      const bctx = buildBundleContext(cat, bundle, now);
      const result = validateSelection(bctx, raw.selection);
      const wrap = !!raw.selection.giftWrap;
      const contents = result.resolved.map((r) => `${r.label}: ${[r.productName, r.colour, r.size, r.option, r.customText ? `"${r.customText}"` : ''].filter(Boolean).join(' · ')}`);
      lines.push({ ...base, kind: 'bundle', name: bundle.name, detail: [], contents, unitKobo: bundle.price_kobo, lineKobo: bundle.price_kobo * quantity,
        visual: { type: 'bundle', designSlug: null, colour: null, finish: null, imageUrl: bundle.image }, slug: bundle.slug,
        issues: [...base.issues, ...result.issues.map((i) => i.message)], giftMessage: raw.selection.giftMessage?.trim() || undefined, giftWrap: wrap, upsell: false });
      eligibleByLine.set(raw.id, { kobo: bundle.price_kobo * quantity, productIds: [], collectionIds: [], discountable: true });
      hasBundle = true; hasReadyPhysical = true; if (bundle.kind === 'gift_box') hasGiftBox = true;
      if (wrap) wrapUnits += quantity;
      if (bctx.units.some((u) => u.requiresCustomText)) customOnlyExpressBlock = true;
      for (const r of result.resolved) { const hit = variantIndex.get(r.variantId); if (hit) hold(r.variantId, quantity, hit.variant); }
      dbItems.push({ kind: 'bundle', bundle_id: bundle.id, name: bundle.name, options: { giftWrap: wrap }, selections: result.resolved, unit_price: bundle.price_kobo, quantity, gift_message: raw.selection.giftMessage?.trim() || undefined });
      continue;
    }

    // ---------------------------------------------------------------- extra design revision (paid add-on)
    if (raw.kind === 'revision') {
      const rq = ctx.customRequests?.find((c) => c.id === raw.refId);
      if (!rq || !['awaiting_proof', 'proof_sent', 'revision_requested'].includes(rq.status)) { bad({ id: raw.id, quantity: 1, kind: 'revision', name: 'Extra design revision' }, 'This design is not waiting on a proof, so an extra revision is not needed.'); continue; }
      const t = TIERS[rq.tier];
      lines.push({ ...base, quantity: 1, kind: 'revision', name: 'Extra design revision', detail: [t.name, rq.colour ?? ''].filter(Boolean), contents: [], unitKobo: settings.revisionFeeKobo, lineKobo: settings.revisionFeeKobo,
        visual: { type: rq.product_type, designSlug: null, colour: rq.colour, finish: null, imageUrl: null } });
      eligibleByLine.set(raw.id, { kobo: settings.revisionFeeKobo, productIds: [], collectionIds: [], discountable: false });
      dbItems.push({ kind: 'revision', name: 'Extra design revision', options: { tier: rq.tier }, unit_price: settings.revisionFeeKobo, quantity: 1, custom_request_id: rq.id });
      continue;
    }

    // ---------------------------------------------------------------- custom design lines
    const req = ctx.customRequests?.find((c) => c.id === raw.refId);
    if (!req) { bad({ id: raw.id, quantity: 1, kind: 'custom' }, 'We could not find this custom design. Please recreate it.'); continue; }
    const problems: string[] = [];
    if (req.status !== 'draft') problems.push('This custom design has already been ordered');
    if (req.in_use) problems.push('This custom design is already in another order');
    const garment = cat.products.filter((p) => p.type === req.product_type)[0];
    if (!garment) { bad({ id: raw.id, quantity: 1, kind: 'custom' }, 'This garment is no longer available'); continue; }
    const tier = TIERS[req.tier];
    const unit = garment.base_price_kobo + tier.feeKobo;
    hasCustom = true; proofHours = Math.max(proofHours, tier.proofHours);
    const size = String((req.text_fields as { size?: string }).size ?? '');
    lines.push({ ...base, quantity: 1, kind: 'custom', name: `${tier.name}: custom ${req.product_type === 'tee' ? 'oversized tee' : 'hoodie'}`, detail: [req.colour, size].filter((x): x is string => !!x), contents: [],
      unitKobo: unit, lineKobo: unit, visual: { type: req.product_type, designSlug: null, colour: req.colour, finish: null, imageUrl: null }, issues: [...base.issues, ...problems] });
    eligibleByLine.set(raw.id, { kobo: unit, productIds: [garment.id], collectionIds: [], discountable: true });
    dbItems.push({ kind: 'custom', name: `${tier.name}: custom ${req.product_type}`, options: { tier: req.tier, productType: req.product_type, colour: req.colour, size, garmentPrice: garment.base_price_kobo, designFee: tier.feeKobo }, unit_price: unit, quantity: 1, custom_request_id: req.id });
  }

  const goods = lines.filter((l) => l.issues.length === 0 || l.unitKobo > 0);
  const subtotalKobo = sum(goods.map((l) => l.lineKobo));
  const digitalOnly = lines.length > 0 && lines.every((l) => l.kind === 'gift_card' || l.kind === 'revision');

  // ---------------------------------------------------------------- discount / ambassador code
  let discount: Quote['discount'] = null;
  let codeError: string | undefined;
  const d = ctx.discount;
  if (input.code?.trim()) {
    if (!d) codeError = 'That code is not valid';
    else {
      const t = now.getTime();
      if (d.starts_at && new Date(d.starts_at).getTime() > t) codeError = 'That code is not active yet';
      else if (d.ends_at && new Date(d.ends_at).getTime() < t) codeError = 'That code has expired';
      else if (d.usage_limit !== null && d.times_used >= d.usage_limit) codeError = 'That code has been fully used';
      else if (d.per_customer_limit !== null && d.customer_uses >= d.per_customer_limit) codeError = 'You have already used that code';
      else if (subtotalKobo < d.min_spend_kobo) codeError = `Spend ${formatNaira(d.min_spend_kobo)} or more to use that code`;
      else {
        const restricted = d.collection_ids.length > 0 || d.product_ids.length > 0;
        const eligible = sum(lines.map((l) => {
          const e = eligibleByLine.get(l.id);
          if (!e || !e.discountable) return 0;
          if (!restricted) return e.kobo;
          const match = e.productIds.some((id) => d.product_ids.includes(id)) || e.collectionIds.some((id) => d.collection_ids.includes(id));
          return match ? e.kobo : 0;
        }));
        if (eligible === 0) codeError = 'That code does not apply to the items in your bag';
        else {
          const raw = d.type === 'percentage' ? percentOf(eligible, d.value) : d.value;
          discount = { code: d.code, amountKobo: clampKobo(raw, 0, eligible), ambassador: !!d.ambassador_id };
        }
      }
    }
  }
  const discountKobo = discount?.amountKobo ?? 0;
  const goodsAfterDiscount = subtotalKobo - discountKobo;

  // ---------------------------------------------------------------- delivery
  const eligibleMerchandiseKobo = Math.max(0, sum(goods.filter((l) => l.kind !== 'gift_card' && l.kind !== 'revision').map((l) => l.lineKobo)) - discountKobo);
  const threshold = settings.freeShippingThresholdKobo ?? FREE_DELIVERY_KOBO;
  let weightGrams: number | null = 0;
  for (const line of goods.filter((l) => l.kind !== 'gift_card' && l.kind !== 'revision')) {
    const raw = input.lines.find((l) => l.id === line.id);
    const product = raw?.kind === 'variant' ? variantIndex.get(raw.refId)?.product : undefined;
    if (!product?.weight_grams || weightGrams === null) weightGrams = null;
    else weightGrams += product.weight_grams * line.quantity;
  }
  const shipping = shippingQuote(cat.zones, input.state ?? '', input.city ?? '', eligibleMerchandiseKobo, threshold, input.shippingRateId, weightGrams);
  const zoneRow = shipping.zone;
  const zone = zoneRow ? { id: zoneRow.id, name: zoneRow.name, feeKobo: zoneRow.fee_kobo, freeOverKobo: zoneRow.free_shipping_eligible !== false ? threshold : null, leadDays: zoneRow.max_days ?? 0 } : null;
  const shippingPending = !digitalOnly && shipping.pending;
  const deliveryFeeKobo = digitalOnly ? 0 : shipping.feeKobo;
  const freeDeliveryAwayKobo = !digitalOnly && eligibleMerchandiseKobo < threshold ? threshold - eligibleMerchandiseKobo : null;
  if (shippingPending) issues.push(SHIPPING_PENDING);

  // ---------------------------------------------------------------- add-ons
  const ex = input.extras ?? {};
  if (ex.giftWrap) wrapUnits += 1;
  const giftWrapKobo = wrapUnits * settings.giftWrapKobo;
  let surpriseNoteKobo = 0, expressKobo = 0, shipReadyFirstKobo = 0;
  if (ex.surpriseNote) {
    if (zone?.name === 'Lagos') surpriseNoteKobo = settings.surpriseNoteKobo; else issues.push('The surprise delivery note is available for Lagos only');
  }
  const express = !!ex.express;
  if (express) {
    if (!settings.expressEnabled) issues.push('Express production is not available right now');
    else if (hasCustom || customOnlyExpressBlock) issues.push('Express production is for ready designs only');
    else if (!hasReadyPhysical) issues.push('Express production applies to printed items');
    else expressKobo = settings.expressKobo;
  }
  if (ex.shipReadyFirst) {
    if (hasCustom && hasReadyPhysical && zone) shipReadyFirstKobo = zone.feeKobo; else issues.push('Shipping ready items first only applies to orders that mix custom and ready items');
  }

  // ---------------------------------------------------------------- gift card, then store credit
  let afterAddons = Math.max(0, goodsAfterDiscount + deliveryFeeKobo + giftWrapKobo + surpriseNoteKobo + expressKobo + shipReadyFirstKobo);
  let giftCodeError: string | undefined;
  let giftCardAppliedKobo = 0;
  if (input.giftCode?.trim()) {
    const g = ctx.gift_card;
    if (!g) giftCodeError = 'That gift card code is not valid';
    else if (g.expires_at && new Date(g.expires_at) < now) giftCodeError = 'That gift card has expired';
    else if (g.balance_kobo <= 0) giftCodeError = 'That gift card has no balance left';
    else if (hasGiftCard) giftCodeError = 'Gift cards cannot be used to buy gift cards';
    else giftCardAppliedKobo = Math.min(g.balance_kobo, afterAddons);
  }
  afterAddons -= giftCardAppliedKobo;
  const creditAvailableKobo = ctx.credit_kobo ?? 0;
  const creditAppliedKobo = input.useCredit ? Math.min(creditAvailableKobo, afterAddons) : 0;
  const totalKobo = afterAddons - creditAppliedKobo;

  // ---------------------------------------------------------------- promise and Christmas
  const leadDays = zone?.leadDays ?? 0;
  const readyLead = leadDays;
  const readyBy = hasReadyPhysical && leadDays > 0 && !shippingPending ? promisedDate(now, readyLead) : null;
  // Custom items: proof first (12 to 48 hours), then the 5-day clock starts at approval. This is the estimate.
  const customBy = hasCustom && leadDays > 0 && !shippingPending ? promisedDate(new Date(now.getTime() + proofHours * 3600_000), leadDays) : null;
  const latest = hasCustom ? customBy : readyBy;
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Africa/Lagos' }).format(now));
  const christmasEnd = new Date(`${year}-12-24T23:59:59+01:00`);
  if (!digitalOnly && latest && now <= christmasEnd && latest > christmasEnd)
    warnings.push(`Heads up: your estimated delivery is ${formatDeliveryDate(latest)}, which is after 24 December.`);
  if (hasGiftBox && zoneRow?.christmas_cutoff_date && now > new Date(`${zoneRow.christmas_cutoff_date}T23:59:59+01:00`) && now <= christmasEnd)
    warnings.push(`The ${zoneRow.name} Christmas cutoff has passed, so gift boxes ordered now will not arrive before Christmas.`);

  // ---------------------------------------------------------------- the one configurable bag offer
  let upsell: Quote['upsell'] = null;
  const offerProduct = settings.upsellProductId ? cat.products.find((p) => p.id === settings.upsellProductId && p.is_active) : undefined;
  if (offerProduct && settings.upsellPriceKobo != null && lines.length > 0 && !lines.some((l) => l.upsell)) {
    const vs = offerProduct.product_variants.filter((v) => availableQty(v) !== 0 && v.option);
    if (vs.length) upsell = { productName: offerProduct.name, offerKobo: settings.upsellPriceKobo, regularKobo: variantPrice(offerProduct, vs[0]!), variants: vs.map((v) => ({ id: v.id, option: v.option! })) };
  }

  // ---------------------------------------------------------------- consent and blocking problems
  const needsFinalSaleConsent = hasCustom;
  if (needsFinalSaleConsent && !input.acceptFinalSale) issues.push('Please confirm the custom items are final sale (except for print defects).');
  if (input.giftMessage && input.giftMessage.length > 300) issues.push('The gift message is too long');
  if (lines.length === 0) issues.push('Your bag is empty');
  for (const l of lines) for (const msg of l.issues) issues.push(`${l.name}: ${msg}`);
  if (codeError && input.code?.trim()) issues.push(codeError);
  if (giftCodeError) issues.push(giftCodeError);

  return {
    ok: issues.length === 0, issues, warnings, lines, subtotalKobo, discount, codeError, giftCodeError,
    zone, deliveryFeeKobo, shippingPending, eligibleMerchandiseKobo, shippingOptions: shipping.options.map((z) => ({ id: z.id, name: z.name, provider: z.provider ?? null, service: z.service ?? null })), freeDeliveryAwayKobo, freeDeliveryThresholdKobo: !digitalOnly && zoneRow?.free_shipping_eligible !== false ? threshold : null, upsell, giftWrapKobo, surpriseNoteKobo, expressKobo, shipReadyFirstKobo,
    giftCardAppliedKobo, creditAppliedKobo, creditAvailableKobo, totalKobo, hasCustom, hasBundle, digitalOnly, needsFinalSaleConsent,
    promise: { readyBy: readyBy?.toISOString() ?? null, customBy: customBy?.toISOString() ?? null, leadDays: readyLead, proofHours: hasCustom ? proofHours : null, express: expressKobo > 0 },
    reservations: [...reserve].map(([variantId, qty]) => ({ variantId, qty })), dbItems,
    discountId: d && discount ? d.id : null, ambassadorCode: d && discount && d.ambassador_id ? d.code : null, giftCardId: giftCardAppliedKobo > 0 ? ctx.gift_card!.id : null,
  };
}

export type { CartLineInput };
