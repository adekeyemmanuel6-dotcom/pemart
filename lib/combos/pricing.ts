import {
  NOTES_MAX, TEXT_MAX, UNAVAILABLE_PRICE,
  type ComboComponent, type ComboConfig, type ComboDiscount, type ComboQuote, type ComboSelection, type ComboSlot, type PriceLine, type ResolvedLine, type UnitChoice,
} from './types';

/**
 * THE combo pricing rules. Pure: (a published configuration, what the customer picked) -> a validated quote.
 * The browser uses it for instant feedback; the server runs the same function on the live published data for the bag,
 * checkout and the order, so a displayed price can never differ from a charged one.
 *
 * PRICE PRECEDENCE (nothing is counted twice):
 *   1. FIXED VARIANT. If an active fixed price exists for exactly this garment + this set of frame sizes, that price IS the
 *      package price. Base price and every adjustment are ignored.
 *   2. Otherwise BASE PACKAGE = base price + garment adjustment + one frame-size adjustment per frame.
 *      Without a base price (and no fixed match) the selection has no price: "Price currently unavailable".
 *   3. EXTRAS. Optional items add (quantity x price). Items marked "included" are already in the package price.
 *   4. DISCOUNT. At most ONE: the largest of the promotions / bundle discounts active right now, taken off (package + extras).
 *   5. The total never goes below zero. Checkout-level discount codes are applied afterwards by the bag, as for every other item.
 */
export const frameSignature = (frameSizeIds: string[]) => [...frameSizeIds].sort().join(',');

const clean = (s: string | undefined, max: number) => (s ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || undefined : undefined);
const sortedSlots = (c: ComboConfig) => [...c.slots].filter((s) => s.mode !== 'unavailable').sort((a, b) => a.sort_order - b.sort_order);
const optionsOf = (c: ComboComponent, group: 'size' | 'colour' | 'frame_size') => c.options.filter((o) => o.group === group);

/** The single discount that applies right now (the largest), or null. */
export function bestDiscount(config: ComboConfig, subtotal: number, now: Date): { d: ComboDiscount; amount: number } | null {
  let best: { d: ComboDiscount; amount: number } | null = null;
  for (const d of config.rules.discounts) {
    if (d.starts_at && now < new Date(d.starts_at)) continue;
    if (d.ends_at && now > new Date(d.ends_at)) continue;
    const amount = d.type === 'percent' ? Math.floor((subtotal * d.value) / 100) : Math.min(d.value, subtotal);
    if (amount > 0 && (!best || amount > best.amount)) best = { d, amount };
  }
  return best;
}

export function priceCombo(config: ComboConfig, sel: ComboSelection, opts: { now?: Date; unavailable?: ReadonlySet<string>; words?: readonly { id: string; name: string }[] } = {}): ComboQuote {
  const now = opts.now ?? new Date();
  const off = opts.unavailable ?? new Set<string>();
  const avail = (c: ComboComponent) => c.available && !off.has(c.id);
  // A chosen word must still exist. Callers that do not load words (older code) simply do not record one.
  const wordOf = (u: UnitChoice, label: string): { word?: string; designId?: string } => {
    if (!u.designId || !opts.words) return {};
    const w = opts.words.find((x) => x.id === u.designId);
    if (!w) { issues.push(`The word you chose for ${label.toLowerCase()} is no longer available`); return {}; }
    return { word: w.name, designId: w.id };
  };
  const issues: string[] = [];
  const resolved: ResolvedLine[] = [];
  const frameSizeIds: string[] = [];
  const extras: { slot: ComboSlot; comp: ComboComponent; qty: number; price: number }[] = [];
  let garment: ComboComponent | undefined;
  const garments: ComboComponent[] = [];   // one per garment unit: a couples edition has two

  for (const slot of sortedSlots(config)) {
    if (slot.kind === 'garment' || slot.kind === 'frame') {
      const units = sel.units[slot.id] ?? [];
      const sizesChosen: string[] = [];
      for (let i = 0; i < slot.quantity; i++) {
        const u: UnitChoice = units[i] ?? {};
        const label = slot.quantity > 1 ? `${slot.label} ${i + 1}` : slot.label;
        const text = clean(u.text, TEXT_MAX), notes = clean(u.notes, NOTES_MAX);
        if (slot.kind === 'garment') {
          const comp = slot.components.find((c) => c.id === u.componentId);
          if (!comp) { issues.push(`Choose your ${slot.label.toLowerCase()}`); continue; }
          if (!avail(comp)) { issues.push(`${comp.name} is currently unavailable`); continue; }
          const sizes = optionsOf(comp, 'size'), colours = optionsOf(comp, 'colour');
          const size = sizes.find((o) => o.id === u.sizeId), colour = colours.find((o) => o.id === u.colourId);
          if (sizes.length && !size) issues.push(`Choose a size for your ${comp.name}`);
          if (colours.length && !colour) issues.push(`Choose a colour for your ${comp.name}`);
          garment ??= comp; garments.push(comp);
          resolved.push({ label, productName: comp.name, componentId: comp.id, slotId: slot.id, colour: colour?.label, size: size?.label, customText: text, notes, ...wordOf(u, label) });
        } else {
          const comp = slot.components[0];
          if (!comp) { issues.push(`${slot.label} is not set up yet`); continue; }
          if (!avail(comp)) { issues.push(`${comp.name} is currently unavailable`); continue; }
          const sizes = optionsOf(comp, 'frame_size');
          const fs = sizes.find((o) => o.id === u.frameSizeId);
          if (!fs) { issues.push(`Choose a size for ${label.toLowerCase()}`); continue; }
          sizesChosen.push(fs.id); frameSizeIds.push(fs.id);
          resolved.push({ label, productName: comp.name, componentId: comp.id, slotId: slot.id, option: fs.label, customText: text, notes, ...wordOf(u, label) });
        }
      }
      if (slot.kind === 'frame' && slot.same_size_only && new Set(sizesChosen).size > 1) issues.push('All frames in this combo must be the same size');
    } else {
      const comp = slot.components[0];
      if (!comp) continue;
      if (slot.mode === 'required') {
        if (!avail(comp)) { issues.push(`${comp.name} is currently unavailable`); continue; }
        resolved.push({ label: comp.name, productName: comp.name, componentId: comp.id, slotId: slot.id, qty: slot.quantity, option: slot.quantity > 1 ? `Included · Qty ${slot.quantity}` : 'Included' });
      } else {
        const chosen = sel.items[slot.id];
        const qty = Math.trunc(chosen?.qty ?? 0);
        if (qty <= 0) continue;
        if (qty < slot.min_qty || qty > slot.max_qty) { issues.push(`${comp.name}: choose between ${slot.min_qty} and ${slot.max_qty}`); continue; }
        if (!avail(comp)) { issues.push(`${comp.name} is currently unavailable`); continue; }
        const price = slot.extra_price_kobo ?? comp.public_price_kobo;
        if (price == null) { issues.push(`${comp.name} cannot be added right now`); continue; }
        extras.push({ slot, comp, qty, price });
        resolved.push({ label: comp.name, productName: comp.name, componentId: comp.id, slotId: slot.id, qty, option: `Add-on · Qty ${qty}`, notes: comp.customisable ? clean(chosen?.notes, NOTES_MAX) : undefined });
      }
    }
  }

  // ---------------------------------------------------------------- price
  const signature = frameSignature(frameSizeIds);
  const lines: PriceLine[] = [];
  let rule: ComboQuote['rule'] = null;
  let pkg: number | null = null;
  // A fixed price names one garment, so it only applies to a one-garment package. Couples editions use base + extras.
  const garmentUnits = config.slots.filter((x) => x.kind === 'garment' && x.mode !== 'unavailable').reduce((n, x) => n + x.quantity, 0);
  const fixed = garment && garmentUnits === 1 ? config.rules.fixed_variants.find((f) => f.component_id === garment!.id && f.signature === signature) : undefined;
  if (fixed) {
    pkg = fixed.amount_kobo; rule = 'fixed_variant';
    lines.push({ key: 'package', label: fixed.label || `${config.name} package`, amountKobo: fixed.amount_kobo, kind: 'package' });
  } else if (config.rules.base_price_kobo != null) {
    rule = 'base'; pkg = config.rules.base_price_kobo;
    lines.push({ key: 'package', label: `${config.name} package`, amountKobo: config.rules.base_price_kobo, kind: 'package' });
    // Each garment unit adds its own extra: a hoodie and a T-shirt in a couples edition are priced one by one.
    const garmentCounts = new Map<string, { comp: ComboComponent; n: number }>();
    for (const g of garments) garmentCounts.set(g.id, { comp: g, n: (garmentCounts.get(g.id)?.n ?? 0) + 1 });
    for (const { comp, n } of garmentCounts.values()) {
      const ga = config.rules.garment_adjust.find((a) => a.component_id === comp.id);
      if (!ga || ga.amount_kobo === 0) continue;
      pkg += ga.amount_kobo * n;
      lines.push({ key: `garment-${comp.id}`, label: `${comp.name}${n > 1 ? ` × ${n}` : ''}`, amountKobo: ga.amount_kobo * n, kind: 'garment' });
    }
    const counts = new Map<string, number>();
    for (const id of frameSizeIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    const frameComp = config.slots.find((s) => s.kind === 'frame')?.components[0];
    for (const [id, n] of counts) {
      const adj = config.rules.frame_size_adjust.find((a) => a.option_id === id);
      if (!adj || adj.amount_kobo === 0) continue;
      const lab = frameComp?.options.find((o) => o.id === id)?.label ?? 'Frame';
      pkg += adj.amount_kobo * n;
      lines.push({ key: `frames-${id}`, label: `${lab} frame${n > 1 ? `s × ${n}` : ''}`, amountKobo: adj.amount_kobo * n, kind: 'frames' });
    }
  }
  let subtotal = pkg ?? 0;
  if (pkg !== null) for (const e of extras) { subtotal += e.price * e.qty; lines.push({ key: `extra-${e.slot.id}`, label: `${e.comp.name}${e.qty > 1 ? ` × ${e.qty}` : ''}`, amountKobo: e.price * e.qty, kind: 'extra' }); }
  let discountKobo = 0;
  if (pkg !== null && subtotal > 0) {
    const best = bestDiscount(config, subtotal, now);
    if (best) { discountKobo = best.amount; lines.push({ key: 'discount', label: best.d.label || (best.d.kind === 'promo' ? 'Promotion' : 'Combo discount'), amountKobo: -best.amount, kind: 'discount' }); }
  }
  let priced = pkg !== null && subtotal >= 0;
  if (pkg !== null && subtotal < 0) { issues.push('This selection has an invalid price. Please contact us.'); priced = false; }
  // "Price currently unavailable" is only said once the selection is complete; before that the customer is just guided to finish it.
  if (!priced && issues.length === 0) issues.push(UNAVAILABLE_PRICE);

  const contents = resolved.map((r) => `${r.label}: ${[r.productName, r.word ? `Word: ${r.word}` : '', r.colour, r.size, r.option, r.customText ? `“${r.customText}”` : '', r.notes ? `Note: ${r.notes}` : ''].filter(Boolean).join(' · ')}`);
  return {
    ok: issues.length === 0 && priced, priced, issues,
    unitKobo: priced ? Math.max(0, subtotal - discountKobo) : 0, subtotalKobo: priced ? subtotal : 0, discountKobo, rule: priced ? rule : null,
    lines: priced ? lines : [], contents, resolved, signature,
  };
}

// ---------------------------------------------------------------------------------------------------------------- defaults and enumeration
/** The starting point of the calculator: first available garment, first frame size, no extras. Size and colour are left for the customer. */
export function defaultSelection(config: ComboConfig, unavailable: ReadonlySet<string> = new Set()): ComboSelection {
  const units: ComboSelection['units'] = {};
  for (const slot of sortedSlots(config)) {
    if (slot.kind === 'garment') {
      const comp = slot.components.find((c) => c.available && !unavailable.has(c.id));
      units[slot.id] = Array.from({ length: slot.quantity }, () => ({ componentId: comp?.id }));
    } else if (slot.kind === 'frame') {
      const first = slot.components[0] ? optionsOf(slot.components[0], 'frame_size')[0] : undefined;
      units[slot.id] = Array.from({ length: slot.quantity }, () => ({ frameSizeId: first?.id }));
    }
  }
  return { collection: config.slug, units, items: {} };
}

function multisets<T>(items: T[], n: number): T[][] {
  if (n === 0) return [[]];
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => { if (acc.length === n) { out.push(acc); return; } for (let i = start; i < items.length; i++) rec(i, [...acc, items[i]!]); };
  rec(0, []);
  return out;
}

export type EnumeratedConfig = { label: string; garmentId: string; garmentName: string; frameSizeIds: string[]; frameLabels: string[]; selection: ComboSelection };
/** Every sensible garment x frame-size combination of a collection (sizes/colours filled with the first option). Capped. */
export function enumerateConfigs(config: ComboConfig, cap = 300): EnumeratedConfig[] {
  const slots = sortedSlots(config);
  const gSlot = slots.find((s) => s.kind === 'garment');
  if (!gSlot) return [];
  const frameSlots = slots.filter((s) => s.kind === 'frame');
  const perFrameSlot = frameSlots.map((fs) => {
    const sizes = fs.components[0] ? optionsOf(fs.components[0], 'frame_size') : [];
    return (fs.same_size_only ? sizes.map((s) => Array.from({ length: fs.quantity }, () => s)) : multisets(sizes, fs.quantity)).map((combo) => ({ slot: fs, combo }));
  });
  let frameCombos: { slot: ComboSlot; combo: { id: string; label: string }[] }[][] = [[]];
  for (const options of perFrameSlot) frameCombos = frameCombos.flatMap((acc) => (options.length ? options.map((o) => [...acc, o]) : [acc]));
  const out: EnumeratedConfig[] = [];
  // One garment per unit; a couples edition (two garments) lists every pair, e.g. "Hoodie + Premium T-shirt".
  for (const set of multisets(gSlot.components, gSlot.quantity)) {
    for (const fc of frameCombos) {
      if (out.length >= cap) return out;
      const units: ComboSelection['units'] = {};
      units[gSlot.id] = set.map((comp) => ({ componentId: comp.id, sizeId: optionsOf(comp, 'size')[0]?.id, colourId: optionsOf(comp, 'colour')[0]?.id }));
      for (const { slot, combo } of fc) units[slot.id] = combo.map((o) => ({ frameSizeId: o.id }));
      const frameLabels = fc.flatMap((x) => x.combo.map((o) => o.label));
      const garmentName = set.map((c) => c.name).join(' + ');
      out.push({ label: [garmentName, ...(frameLabels.length ? [frameLabels.join(' + ')] : [])].join(' · '), garmentId: set[0]!.id, garmentName, frameSizeIds: fc.flatMap((x) => x.combo.map((o) => o.id)), frameLabels, selection: { collection: config.slug, units, items: {} } });
    }
  }
  return out;
}

/** The lowest valid price a customer can reach (for "From ₦..."), or null if nothing is priced yet. */
export function startingPrice(config: ComboConfig, unavailable: ReadonlySet<string> = new Set()): number | null {
  let min: number | null = null;
  for (const e of enumerateConfigs(config)) {
    const q = priceCombo(config, e.selection, { unavailable });
    if (q.ok && (min === null || q.unitKobo < min)) min = q.unitKobo;
  }
  return min;
}

// ---------------------------------------------------------------------------------------------------------------- admin validation
export type ConfigIssue = { level: 'error' | 'warning'; message: string };
/** Plain-language problems with a draft configuration. Errors block nothing by themselves but mean customers cannot buy that selection. */
export function configIssues(config: ComboConfig, now = new Date()): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const slots = sortedSlots(config);
  const gSlot = slots.find((s) => s.kind === 'garment');
  if (!gSlot) { out.push({ level: 'error', message: 'Add a garment to the package.' }); return out; }
  const gComps = gSlot.components.filter((c) => c.available);
  if (gComps.length === 0) out.push({ level: 'error', message: 'No garment is available. Add at least one active garment.' });
  for (const g of gComps) {
    if (!optionsOf(g, 'size').length) out.push({ level: 'warning', message: `${g.name} has no sizes, so customers will not be asked for one.` });
  }
  const frameSlots = slots.filter((s) => s.kind === 'frame');
  for (const fs of frameSlots) {
    const comp = fs.components[0];
    if (!comp) out.push({ level: 'error', message: `"${fs.label}" has no frame product.` });
    else if (!optionsOf(comp, 'frame_size').length) out.push({ level: 'error', message: `${comp.name} has no sizes. Add at least one frame size.` });
    else if (!comp.available) out.push({ level: 'warning', message: `${comp.name} is switched off, so this combo cannot be bought.` });
  }
  const frameOptionIds = new Set(frameSlots.flatMap((s) => s.components.flatMap((c) => optionsOf(c, 'frame_size').map((o) => o.id))));
  const garmentUnits = slots.filter((x) => x.kind === 'garment').reduce((n, x) => n + x.quantity, 0);
  if (garmentUnits > 1 && config.rules.fixed_variants.length > 0) out.push({ level: 'error', message: 'Fixed prices only work for a one-garment package. Remove them and use the base price with garment and frame extras.' });
  const seen = new Set<string>();
  const nFrames = frameSlots.reduce((n, s) => n + s.quantity, 0);
  for (const f of config.rules.fixed_variants) {
    const key = `${f.component_id}|${f.signature}`;
    if (seen.has(key)) out.push({ level: 'error', message: `Two fixed prices exist for the same ${gSlot.components.find((c) => c.id === f.component_id)?.name ?? 'garment'} and frame sizes. Keep one.` });
    seen.add(key);
    const ids = f.signature ? f.signature.split(',') : [];
    if (ids.length !== nFrames || ids.some((id) => !frameOptionIds.has(id))) out.push({ level: 'error', message: `A fixed price (${f.label || 'unnamed'}) does not match this package's ${nFrames} frame${nFrames === 1 ? '' : 's'}. Re-select its frame sizes.` });
    if (!gSlot.components.some((c) => c.id === f.component_id)) out.push({ level: 'error', message: `A fixed price (${f.label || 'unnamed'}) is for a garment that is not in this package.` });
  }
  for (const a of config.rules.frame_size_adjust) if (!frameOptionIds.has(a.option_id)) out.push({ level: 'warning', message: 'A frame-size price adjustment refers to a size this package does not use.' });
  for (const d of config.rules.discounts) {
    if (d.type === 'percent' && (d.value < 1 || d.value > 100)) out.push({ level: 'error', message: 'A percentage discount must be between 1 and 100.' });
    if (d.starts_at && d.ends_at && new Date(d.ends_at) < new Date(d.starts_at)) out.push({ level: 'error', message: `The promotion "${d.label || 'unnamed'}" ends before it starts.` });
  }
  const active = config.rules.discounts.filter((d) => (!d.starts_at || now >= new Date(d.starts_at)) && (!d.ends_at || now <= new Date(d.ends_at)));
  if (active.length > 1) out.push({ level: 'warning', message: 'More than one discount is active. Only the largest applies; they never stack.' });
  for (const s of slots.filter((x) => x.kind === 'item' && x.mode === 'optional')) {
    const c = s.components[0];
    if (c && (s.extra_price_kobo ?? c.public_price_kobo) == null) out.push({ level: 'warning', message: `${c.name} is optional but has no price, so customers cannot add it.` });
    if (c && !c.available) out.push({ level: 'warning', message: `${c.name} is switched off (draft), so it is hidden from customers.` });
  }
  for (const s of slots.filter((x) => x.kind === 'item' && x.mode === 'required')) { const c = s.components[0]; if (c && !c.available) out.push({ level: 'error', message: `${c.name} is included in this package but switched off, so it cannot be bought.` }); }
  // Which selections have no price?
  const all = enumerateConfigs(config);
  const unpriced = all.filter((e) => !priceCombo(config, e.selection, { now }).priced);
  if (config.rules.base_price_kobo == null && config.rules.fixed_variants.length === 0) out.push({ level: 'warning', message: 'No selling price is set. Customers will see "Price currently unavailable" and cannot buy. Set a base price or fixed prices.' });
  else if (unpriced.length > 0) out.push({ level: 'warning', message: `${unpriced.length} of ${all.length} selections have no price (they show "Price currently unavailable"): ${unpriced.slice(0, 4).map((e) => e.label).join('; ')}${unpriced.length > 4 ? '…' : ''}` });
  for (const e of all) { const q = priceCombo(config, e.selection, { now }); if (q.issues.some((i) => /invalid price/.test(i))) { out.push({ level: 'error', message: `${e.label} would have a negative price. Check the adjustments.` }); break; } }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- internal cost (admin only)
export type CostEstimate = { costKobo: number; parts: { label: string; kobo: number }[]; missing: string[] };
/** Estimated internal cost of one selection. Needs a config built WITH costs (admin only). Costs left blank are reported, not guessed. */
export function estimateCost(config: ComboConfig, sel: ComboSelection): CostEstimate {
  const parts: CostEstimate['parts'] = []; const missing: string[] = [];
  const add = (label: string, kobo: number | null | undefined) => { if (kobo == null) missing.push(label); else parts.push({ label, kobo }); };
  for (const slot of sortedSlots(config)) {
    if (slot.kind === 'garment') {
      for (const u of sel.units[slot.id] ?? []) { const c = slot.components.find((x) => x.id === u.componentId); if (c) add(c.name, c.internal_cost_kobo); }
    } else if (slot.kind === 'frame') {
      const comp = slot.components[0];
      for (const u of sel.units[slot.id] ?? []) { const o = comp?.options.find((x) => x.id === u.frameSizeId); if (o) add(`${comp!.name} ${o.label}`, o.internal_cost_kobo); }
    } else {
      const c = slot.components[0]; if (!c) continue;
      const qty = slot.mode === 'required' ? slot.quantity : Math.trunc(sel.items[slot.id]?.qty ?? 0);
      if (qty > 0) { if (c.internal_cost_kobo == null) missing.push(c.name); else parts.push({ label: qty > 1 ? `${c.name} × ${qty}` : c.name, kobo: c.internal_cost_kobo * qty }); }
    }
  }
  const o = config.overheads;
  if (o) {
    for (const [label, kobo] of [['Apparel printing', o.printing_apparel_kobo], ['Frame artwork & printing', o.frame_artwork_kobo], ['Packaging', o.packaging_kobo], ['Labour', o.labor_kobo], ['Processing fees', o.processing_fee_kobo], ['Other', o.other_kobo]] as const) if (kobo > 0) parts.push({ label, kobo });
  }
  return { costKobo: parts.reduce((n, p) => n + p.kobo, 0), parts, missing };
}

export function profit(priceKobo: number, costKobo: number) {
  const gross = priceKobo - costKobo;
  return { grossKobo: gross, marginPct: priceKobo > 0 ? Math.round((gross / priceKobo) * 1000) / 10 : null };
}
