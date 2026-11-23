/**
 * Combo collections: the public (selling) shape of a collection's published configuration, what a customer selects,
 * and what pricing returns. These types hold SELLING data only. Internal costs appear on the optional `internal_cost_kobo`
 * fields, which only the admin functions ever fill (they are absent from every public response).
 */
export type ComboGroup = 'size' | 'colour' | 'frame_size';
export type ComboOption = { id: string; slug: string; group: ComboGroup; label: string; internal_cost_kobo?: number | null };
export type ComboComponent = {
  id: string; slug: string; name: string; kind: 'garment' | 'frame' | 'item'; description: string | null; image_url: string | null;
  public_price_kobo: number | null; customisable: boolean; min_qty: number; max_qty: number; available: boolean;
  options: ComboOption[]; internal_cost_kobo?: number | null;
};
export type ComboSlot = {
  id: string; kind: 'garment' | 'frame' | 'item'; label: string; quantity: number; mode: 'required' | 'optional' | 'unavailable';
  min_qty: number; max_qty: number; same_size_only: boolean; customise: boolean; extra_price_kobo: number | null; sort_order: number;
  components: ComboComponent[];
};
export type ComboDiscount = { id: string; kind: 'promo' | 'bundle_discount'; type: 'percent' | 'fixed'; value: number; label: string | null; starts_at: string | null; ends_at: string | null };
export type ComboRules = {
  base_price_kobo: number | null;
  garment_adjust: { id: string; component_id: string; amount_kobo: number }[];
  frame_size_adjust: { id: string; option_id: string; amount_kobo: number }[];
  fixed_variants: { id: string; component_id: string; signature: string; amount_kobo: number; label: string | null }[];
  discounts: ComboDiscount[];
};
export type ComboOverheads = { printing_apparel_kobo: number; frame_artwork_kobo: number; packaging_kobo: number; labor_kobo: number; processing_fee_kobo: number; other_kobo: number };
export type ComboConfig = {
  id: string; slug: string; name: string; label: string | null; tagline: string | null; scripture_ref: string | null; scripture_text: string | null;
  description: string | null; image_url: string | null; sort_order: number; legacy_bundle_id: string | null; version: number;
  slots: ComboSlot[]; rules: ComboRules; overheads?: ComboOverheads;
};
/** What `combo_public_list` returns: published snapshots, plus components switched off since publishing. */
/** A word (design) a customer can choose for a garment or frame. Public data only. */
export type ComboWord = { id: string; slug: string; name: string; reference: string | null; image: string | null };
export type ComboCatalogue = { collections: ComboConfig[]; unavailable: string[]; words?: ComboWord[] };

/** One physical unit the customer configures: a garment, or one frame. */
export type UnitChoice = { designId?: string; componentId?: string; sizeId?: string; colourId?: string; frameSizeId?: string; text?: string; notes?: string };
export type ComboSelection = {
  collection: string;                                        // the collection slug
  units: Record<string, UnitChoice[]>;                       // slot id -> one entry per unit (garment, frames)
  items: Record<string, { qty: number; notes?: string }>;    // slot id -> optional extras chosen
};

export type PriceLine = { key: string; label: string; amountKobo: number; kind: 'package' | 'garment' | 'frames' | 'extra' | 'discount' };
/** Same shape the order screens already render for bundles (label, productName, colour, size, option, customText) plus stable ids and notes. */
export type ResolvedLine = {
  label: string; productName: string; componentId: string; slotId: string; qty?: number;
  colour?: string; size?: string; option?: string; customText?: string; notes?: string;
  /** The word (design) the customer chose: its name for display, its id for the record. */
  word?: string; designId?: string;
};
export type ComboQuote = {
  ok: boolean;                       // nothing blocks adding to the bag
  priced: boolean;                   // a valid selling price exists for this selection
  issues: string[];
  unitKobo: number;                  // 0 when not priced
  subtotalKobo: number;
  discountKobo: number;
  rule: 'fixed_variant' | 'base' | null;
  lines: PriceLine[];
  contents: string[];                // human readable, for the bag, order page and emails
  resolved: ResolvedLine[];
  signature: string;                 // sorted frame-size ids
};

export const UNAVAILABLE_PRICE = 'Price currently unavailable';
export const TEXT_MAX = 300;
export const NOTES_MAX = 500;
