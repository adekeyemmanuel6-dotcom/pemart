import type { Kobo } from '@/lib/money';

export type TierId = 'personalise' | 'text_design' | 'full_custom';

/**
 * Custom design tiers. The fee is ALWAYS taken from here on the server;
 * the browser only displays it. Fees are added on top of the garment price.
 */
export const TIERS: Record<TierId, { id: TierId; name: string; feeKobo: Kobo; proofHours: number; blurb: string }> = {
  personalise: { id: 'personalise', name: 'Personalise', feeKobo: 300000, proofHours: 12, blurb: 'Pick an existing design and change the name, date or verse text.' },
  text_design: { id: 'text_design', name: 'Text design', feeKobo: 500000, proofHours: 24, blurb: 'Type your own words and choose a Pemart type style.' },
  full_custom: { id: 'full_custom', name: 'Full custom', feeKobo: 1500000, proofHours: 48, blurb: 'Describe your idea and upload references or a sketch.' },
};
export const TIER_LIST = Object.values(TIERS);

export const PRINT_POSITIONS = [
  { id: 'back', label: 'Back (large)' },
  { id: 'front', label: 'Front (chest)' },
  { id: 'both', label: 'Front and back' },
] as const;
export type PrintPosition = (typeof PRINT_POSITIONS)[number]['id'];

/** Six Pemart type styles. `charW` is the average uppercase glyph width in em, used to fit text to the print area. */
export const TYPE_STYLES = [
  { id: 'heavy', name: 'Heavy', charW: 0.42, upper: true, weight: 400, italic: false },
  { id: 'bebas', name: 'Tall', charW: 0.4, upper: true, weight: 400, italic: false },
  { id: 'serif', name: 'Editorial', charW: 0.66, upper: false, weight: 800, italic: true },
  { id: 'script', name: 'Handwritten', charW: 0.4, upper: false, weight: 700, italic: false },
  { id: 'marker', name: 'Marker', charW: 0.62, upper: true, weight: 400, italic: false },
  { id: 'mono', name: 'Typewriter', charW: 0.66, upper: true, weight: 700, italic: false },
] as const;
export type TypeStyleId = (typeof TYPE_STYLES)[number]['id'];

export const UPLOAD_RULES = {
  maxBytes: 20 * 1024 * 1024,
  maxFiles: 5,
  types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'image/svg+xml': 'svg' } as Record<string, string>,
};
