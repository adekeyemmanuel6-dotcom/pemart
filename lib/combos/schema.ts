import { z } from 'zod';
import { NOTES_MAX, TEXT_MAX, type ComboSelection } from './types';

const id = z.string().regex(/^[0-9a-f-]{36}$/i, 'Invalid id');
export const unitChoiceSchema = z.object({
  designId: id.optional(),
  componentId: id.optional(), sizeId: id.optional(), colourId: id.optional(), frameSizeId: id.optional(),
  text: z.string().max(TEXT_MAX * 2).optional(), notes: z.string().max(NOTES_MAX * 2).optional(),
});
/** The only thing the browser ever sends about a combo: WHAT was chosen. Never a price. */
export const comboSelectionSchema = z.object({
  collection: z.string().max(80),
  units: z.record(id, z.array(unitChoiceSchema).max(12)),
  items: z.record(id, z.object({ qty: z.number().int().min(0).max(20), notes: z.string().max(NOTES_MAX * 2).optional() })),
});
export const parseSelection = (raw: unknown): ComboSelection | null => { const r = comboSelectionSchema.safeParse(raw); return r.success ? (r.data as ComboSelection) : null; };

const t = (d: string, max = 300) => z.string().max(max).default(d);
/** Editable storefront copy for the calculator entry points and the brand story section (Admin > Combo Management > Storefront). */
export const ComboSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  headerLabel: t('Build Your Combo', 40),
  heroCta: z.object({ show: z.boolean().default(true), label: t('Build Your Combo', 40) }).prefault({}),
  calculator: z.object({
    show: z.boolean().default(true),
    kicker: t('Combo Calculator', 60),
    headline: t('Your Word. Your Style. Your Combo.', 120),
    body: t('Create a meaningful collection designed around your faith. Choose what you wear, select the promises you want to keep before your eyes, and build a package that helps you live the Word every day.', 600),
    cta: t('Customize Your Combo', 40),
    imageUrl: t('', 500),
    imageAlt: t('', 200),
  }).prefault({}),
  story: z.object({
    show: z.boolean().default(true),
    kicker: t('Everything We Sell Is With Purpose', 80),
    headline: t('The Word You Wear. The Promise You See. The Life You Live.', 200),
    paragraphs: z.array(z.string().trim().min(1).max(700)).max(6).default([
      'Many people receive a Word, write down a vision, or hold on to a promise, but the demands of everyday life can gradually push it out of sight.',
      'At Wear The Word by Pemart, we create meaningful pieces designed to keep God’s Word present in everyday life.',
      'From what you wear to what you display in your home and the tools you use to reflect, write, and grow, every product serves a purpose.',
    ]),
    closing: t('Wear it. See it. Write it. Live it.', 120),
    cta: t('Explore The Combos', 40),
    imageUrl: t('', 500),
    imageAlt: t('', 200),
  }).prefault({}),
  page: z.object({
    headline: t('Combo Collections', 100),
    intro: t('Choose what you wear, the promises you want to see, and the tools to live them. Every piece is customised for you.', 400),
  }).prefault({}),
});
export type ComboSettings = z.infer<typeof ComboSettingsSchema>;
export const resolveComboSettings = (raw: unknown): ComboSettings => {
  const r = ComboSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : ComboSettingsSchema.parse({});
};
