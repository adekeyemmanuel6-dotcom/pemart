import { z } from 'zod';
import { PRINT_POSITIONS, TIERS, TYPE_STYLES, type TierId } from './tiers';

const line = z.string().trim().max(40);
const colours = ['Blue Jean', 'Mocha', 'Sand', 'Black', 'Navy'] as const;
const sizes = ['S', 'M', 'L', 'XL', 'XXL'] as const;

/** Shared by the studio form (client) and the server action. */
export const customRequestSchema = z.object({
  tier: z.enum(Object.keys(TIERS) as [TierId, ...TierId[]]),
  productType: z.enum(['tee', 'hoodie']),
  colour: z.enum(colours),
  size: z.enum(sizes),
  printPositions: z.enum(PRINT_POSITIONS.map((p) => p.id) as ['back', 'front', 'both']),
  designSlug: z.string().regex(/^[a-z0-9-]+$/).max(60).optional(),
  typeStyle: z.enum(TYPE_STYLES.map((t) => t.id) as [string, ...string[]]).optional(),
  textLines: z.array(line).max(4).default([]),
  name: line.optional(),
  date: line.optional(),
  verse: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1500).optional(),
  uploadPaths: z.array(z.string().max(300)).max(5).default([]),
  rightsConfirmed: z.boolean().optional(),
}).superRefine((v, ctx) => {
  const need = (ok: boolean, path: string, message: string) => { if (!ok) ctx.addIssue({ code: 'custom', path: [path], message }); };
  if (v.tier === 'personalise') {
    need(!!v.designSlug, 'designSlug', 'Choose a design to personalise');
    need(!!(v.name || v.date || v.verse), 'name', 'Add a name, a date or a verse to personalise');
  }
  if (v.tier === 'text_design') {
    need(v.textLines.some((l) => l.length > 0), 'textLines', 'Type the words you want printed');
    need(!!v.typeStyle, 'typeStyle', 'Choose a type style');
  }
  if (v.tier === 'full_custom') {
    need(!!v.notes && v.notes.length >= 10, 'notes', 'Describe your idea (at least a sentence)');
    if (v.uploadPaths.length > 0) need(v.rightsConfirmed === true, 'rightsConfirmed', 'Please confirm you have the right to use your uploaded images');
  }
});
export type CustomRequestInput = z.input<typeof customRequestSchema>;
export type CustomRequest = z.output<typeof customRequestSchema>;
