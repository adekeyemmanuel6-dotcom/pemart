import type { ComboComponent, ComboConfig, ComboDiscount, ComboOption, ComboOverheads, ComboRules, ComboSlot } from './types';

/** Rows exactly as the admin editor holds and saves them (and as the database stores them). */
export type SlotRow = {
  id: string; kind: 'garment' | 'frame' | 'item'; label: string; component_id: string | null; allowed_component_ids: string[]; quantity: number;
  mode: 'required' | 'optional' | 'unavailable'; min_qty: number; max_qty: number; same_size_only: boolean; customise: boolean; extra_price_kobo: number | null;
};
export type RuleRow = {
  id: string; kind: 'garment_adjust' | 'frame_size_adjust' | 'fixed_variant' | 'promo' | 'bundle_discount'; component_id: string | null; option_id: string | null;
  frame_signature: string | null; amount_kobo: number | null; discount_type: 'percent' | 'fixed' | null; discount_value: number | null; label: string | null;
  starts_at: string | null; ends_at: string | null; is_active: boolean;
};
export type CollectionRow = {
  slug: string; name: string; label: string; tagline: string; scripture_ref: string; scripture_text: string; description: string; image_url: string;
  legacy_bundle_id: string | null; sort_order: number; base_price_kobo: number | null;
};
/** One item of the component library, as the admin sees it (with every option, active or not). */
export type LibraryItem = ComboComponent & {
  is_active: boolean; archived_at: string | null; inventory_status: 'in_stock' | 'made_to_order' | 'out_of_stock'; sort_order: number; used_in: number;
  all_options: (ComboOption & { is_active: boolean; sort_order: number })[];
};

/** The working configuration from the editor's rows. Mirrors the database's _combo_config(), so the editor can preview prices and
 *  check problems live, before anything is saved. */
export function buildWorkingConfig(c: CollectionRow, id: string, slots: SlotRow[], rules: RuleRow[], library: LibraryItem[], overheads?: ComboOverheads): ComboConfig {
  const byId = new Map(library.map((l) => [l.id, l]));
  const comp = (cid: string): ComboComponent | null => {
    const l = byId.get(cid); if (!l) return null;
    const { all_options: _ao, is_active: _ia, archived_at: _ar, inventory_status: _is, sort_order: _so, used_in: _ui, ...rest } = l; void _ao; void _ia; void _ar; void _is; void _so; void _ui;
    return { ...rest, available: l.is_active && !l.archived_at && l.inventory_status !== 'out_of_stock', options: l.all_options.filter((o) => o.is_active) };
  };
  const cslots: ComboSlot[] = slots.map((s, i) => {
    const ids = s.component_id ? [s.component_id] : s.allowed_component_ids;
    return { id: s.id, kind: s.kind, label: s.label, quantity: s.quantity, mode: s.mode, min_qty: s.min_qty, max_qty: s.max_qty, same_size_only: s.same_size_only, customise: s.customise, extra_price_kobo: s.extra_price_kobo, sort_order: i + 1, components: ids.map(comp).filter((x): x is ComboComponent => !!x) };
  });
  const act = rules.filter((r) => r.is_active);
  const r: ComboRules = {
    base_price_kobo: c.base_price_kobo,
    garment_adjust: act.filter((x) => x.kind === 'garment_adjust' && x.component_id && x.amount_kobo != null).map((x) => ({ id: x.id, component_id: x.component_id!, amount_kobo: x.amount_kobo! })),
    frame_size_adjust: act.filter((x) => x.kind === 'frame_size_adjust' && x.option_id && x.amount_kobo != null).map((x) => ({ id: x.id, option_id: x.option_id!, amount_kobo: x.amount_kobo! })),
    fixed_variants: act.filter((x) => x.kind === 'fixed_variant' && x.component_id && x.frame_signature != null && x.amount_kobo != null).map((x) => ({ id: x.id, component_id: x.component_id!, signature: x.frame_signature!, amount_kobo: x.amount_kobo!, label: x.label })),
    discounts: act.filter((x) => (x.kind === 'promo' || x.kind === 'bundle_discount') && x.discount_type && x.discount_value).map((x): ComboDiscount => ({ id: x.id, kind: x.kind as 'promo' | 'bundle_discount', type: x.discount_type!, value: x.discount_value!, label: x.label, starts_at: x.starts_at, ends_at: x.ends_at })),
  };
  return { id, slug: c.slug, name: c.name, label: c.label || null, tagline: c.tagline || null, scripture_ref: c.scripture_ref || null, scripture_text: c.scripture_text || null, description: c.description || null,
    image_url: c.image_url || null, sort_order: c.sort_order, legacy_bundle_id: c.legacy_bundle_id, version: 0, slots: cslots, rules: r, ...(overheads ? { overheads } : {}) };
}
