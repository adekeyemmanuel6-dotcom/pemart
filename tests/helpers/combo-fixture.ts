import type { ComboComponent, ComboConfig, ComboOption, ComboSlot } from '@/lib/combos/types';

let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const opt = (group: ComboOption['group'], slug: string, label: string, cost?: number): ComboOption => ({ id: uid(), slug, group, label, ...(cost !== undefined ? { internal_cost_kobo: cost } : {}) });

export function makeLibrary() {
  const sizes = () => ['S', 'M', 'L', 'XL', 'XXL'].map((s) => opt('size', s.toLowerCase(), s));
  const colours = () => ['Black', 'White'].map((c) => opt('colour', c.toLowerCase(), c));
  const garment = (slug: string, name: string, cost: number): ComboComponent => ({ id: uid(), slug, name, kind: 'garment', description: null, image_url: null, public_price_kobo: null, customisable: true, min_qty: 0, max_qty: 1, available: true, internal_cost_kobo: cost, options: [...sizes(), ...colours()] });
  const item = (slug: string, name: string, cost: number | null, price: number | null, over: Partial<ComboComponent> = {}): ComboComponent => ({ id: uid(), slug, name, kind: 'item', description: null, image_url: null, public_price_kobo: price, customisable: false, min_qty: 0, max_qty: 1, available: true, internal_cost_kobo: cost, options: [], ...over });
  const f12 = opt('frame_size', '12x16', '12 × 16 inches', 900000), f16 = opt('frame_size', '16x20', '16 × 20 inches', 1600000);
  return {
    tee: garment('premium-tshirt', 'Premium Cotton T-shirt', 1000000), sweat: garment('sweatshirt', 'Sweatshirt', 1500000), hoodie: garment('hoodie', 'Hoodie', 2000000),
    frame: { id: uid(), slug: 'custom-frame', name: 'Customised Frame', kind: 'frame', description: null, image_url: null, public_price_kobo: null, customisable: true, min_qty: 0, max_qty: 1, available: true, internal_cost_kobo: null, options: [f12, f16] } as ComboComponent,
    f12, f16,
    diary: item('diary-2027', '2027 Diary', 700000, null), pen: item('pen', 'Pen', 100000, null), hl: item('highlight-pen', 'Highlight Pen', 100000, null), sticky: item('sticky-notes', 'Sticky Notes', 50000, null),
    perfume: item('perfume', 'Perfume', 1000000, null), cards: item('scripture-promise-cards', 'Scripture Promise Cards', null, null, { available: false }),
  };
}
export type Library = ReturnType<typeof makeLibrary>;

const slot = (over: Partial<ComboSlot> & Pick<ComboSlot, 'kind' | 'label' | 'components'>): ComboSlot => ({ id: uid(), quantity: 1, mode: 'required', min_qty: 0, max_qty: 1, same_size_only: false, customise: false, extra_price_kobo: null, sort_order: 0, ...over });

export function makeCollections(lib: Library = makeLibrary(), prices: { base?: number | null } = {}) {
  const garments = [lib.tee, lib.sweat, lib.hoodie];
  const base = (slug: string, name: string, slots: ComboSlot[], extra: Partial<ComboConfig['rules']> = {}): ComboConfig => ({
    id: uid(), slug, name, label: null, tagline: null, scripture_ref: null, scripture_text: null, description: null, image_url: null, sort_order: 0, legacy_bundle_id: null, version: 1,
    slots: slots.map((s, i) => ({ ...s, sort_order: i + 1 })),
    rules: { base_price_kobo: prices.base === undefined ? 5000000 : prices.base, garment_adjust: [], frame_size_adjust: [], fixed_variants: [], discounts: [], ...extra },
  });
  const behold = base('behold', 'BEHOLD COLLECTION', [slot({ kind: 'garment', label: 'Customised garment', components: garments, customise: true }), slot({ kind: 'frame', label: 'Customised frame', components: [lib.frame], customise: true })]);
  const abide = base('abide', 'ABIDE COLLECTION', [slot({ kind: 'garment', label: 'Customised garment', components: garments, customise: true }), slot({ kind: 'frame', label: 'Customised frame', components: [lib.frame], quantity: 3, customise: true })]);
  const doers = base('doers', "THE DOER'S COLLECTION", [
    slot({ kind: 'garment', label: 'Customised garment', components: garments, customise: true }), slot({ kind: 'frame', label: 'Customised frame', components: [lib.frame], customise: true }),
    ...[lib.diary, lib.pen, lib.hl, lib.sticky].map((c) => slot({ kind: 'item', label: c.name, components: [c], mode: 'required' })),
    slot({ kind: 'item', label: 'Perfume', components: [lib.perfume], mode: 'optional', extra_price_kobo: 1500000 }),
    slot({ kind: 'item', label: 'Scripture Promise Cards', components: [lib.cards], mode: 'optional', extra_price_kobo: 300000 }),
  ]);
  return { behold, abide, doers };
}
