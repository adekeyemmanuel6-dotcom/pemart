import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const img = z.string().trim().max(500).refine((v) => v === '' || /^(\/|https?:\/\/)/.test(v), 'Picture link must start with / or https://');
const kobo = z.number().int().min(-10_000_000_000).max(10_000_000_000);
export const comboSaveSchema = z.object({
  id: uuid.optional(),
  collection: z.object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'The web address can only use lower-case letters, numbers and dashes').max(60),
    name: z.string().trim().min(2, 'Give the collection a name').max(80),
    label: z.string().trim().max(30).default(''), tagline: z.string().trim().max(160).default(''), scripture_ref: z.string().trim().max(60).default(''),
    scripture_text: z.string().trim().max(600).default(''), description: z.string().trim().max(2000).default(''), image_url: img.default(''),
    legacy_bundle_id: uuid.nullable().default(null), sort_order: z.number().int().min(0).max(9999).default(0), base_price_kobo: kobo.min(0).nullable().default(null),
  }),
  slots: z.array(z.object({
    id: uuid, kind: z.enum(['garment', 'frame', 'item']), label: z.string().trim().min(1, 'Every package item needs a name').max(60),
    component_id: uuid.nullable(), allowed_component_ids: z.array(uuid).max(12), quantity: z.number().int().min(1).max(12),
    mode: z.enum(['required', 'optional', 'unavailable']), min_qty: z.number().int().min(0).max(20), max_qty: z.number().int().min(0).max(20),
    same_size_only: z.boolean(), customise: z.boolean(), extra_price_kobo: kobo.min(0).nullable(),
  })).max(30),
  rules: z.array(z.object({
    id: uuid, kind: z.enum(['garment_adjust', 'frame_size_adjust', 'fixed_variant', 'promo', 'bundle_discount']), component_id: uuid.nullable(), option_id: uuid.nullable(),
    frame_signature: z.string().max(600).nullable(), amount_kobo: kobo.nullable(), discount_type: z.enum(['percent', 'fixed']).nullable(), discount_value: z.number().int().min(1).max(10_000_000_000).nullable(),
    label: z.string().trim().max(80).nullable(), starts_at: z.string().nullable(), ends_at: z.string().nullable(), is_active: z.boolean(),
  })).max(400),
}).superRefine((v, ctx) => {
  v.slots.forEach((s, i) => {
    if (s.kind === 'garment' && s.mode === 'required' && s.allowed_component_ids.length === 0) ctx.addIssue({ code: 'custom', path: ['slots', i], message: `Choose at least one garment for "${s.label}".` });
    if (s.kind !== 'garment' && !s.component_id) ctx.addIssue({ code: 'custom', path: ['slots', i], message: `Choose the product for "${s.label}".` });
    if (s.max_qty < s.min_qty) ctx.addIssue({ code: 'custom', path: ['slots', i], message: `"${s.label}": the maximum is below the minimum.` });
  });
  v.rules.forEach((r, i) => {
    if (r.kind === 'fixed_variant' && (!r.component_id || r.frame_signature == null || r.amount_kobo == null || r.amount_kobo < 0)) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A fixed price needs a garment, frame sizes and a price.' });
    if (r.kind === 'garment_adjust' && (!r.component_id || r.amount_kobo == null)) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A garment adjustment needs a garment and an amount.' });
    if (r.kind === 'frame_size_adjust' && (!r.option_id || r.amount_kobo == null)) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A frame-size adjustment needs a size and an amount.' });
    if ((r.kind === 'promo' || r.kind === 'bundle_discount') && (!r.discount_type || !r.discount_value)) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A discount needs a type and a value.' });
    if (r.discount_type === 'percent' && (r.discount_value ?? 0) > 100) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A percentage discount cannot be more than 100.' });
    if (r.starts_at && r.ends_at && new Date(r.ends_at) < new Date(r.starts_at)) ctx.addIssue({ code: 'custom', path: ['rules', i], message: 'A promotion ends before it starts.' });
  });
});
export type ComboSavePayload = z.infer<typeof comboSaveSchema>;

export const componentSaveSchema = z.object({
  component: z.object({
    id: uuid.optional(), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'The code can only use lower-case letters, numbers and dashes').max(60),
    name: z.string().trim().min(2, 'Give it a name').max(80), kind: z.enum(['garment', 'frame', 'item']), description: z.string().trim().max(1000).default(''), image_url: img.default(''),
    internal_cost_kobo: kobo.min(0).nullable().default(null), public_price_kobo: kobo.min(0).nullable().default(null), customisable: z.boolean().default(false),
    min_qty: z.number().int().min(0).max(20).default(0), max_qty: z.number().int().min(0).max(20).default(1),
    inventory_status: z.enum(['in_stock', 'made_to_order', 'out_of_stock']).default('made_to_order'), is_active: z.boolean().default(true), sort_order: z.number().int().min(0).max(9999).default(0),
  }),
  options: z.array(z.object({
    id: uuid.optional(), grp: z.enum(['size', 'colour', 'frame_size']), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40), label: z.string().trim().min(1).max(60),
    internal_cost_kobo: kobo.min(0).nullable().default(null), is_active: z.boolean().default(true),
  })).max(40),
}).superRefine((v, ctx) => { if (v.component.max_qty < v.component.min_qty) ctx.addIssue({ code: 'custom', path: ['component'], message: 'The maximum is below the minimum.' }); });
export type ComponentSavePayload = z.infer<typeof componentSaveSchema>;

export const costsSchema = z.object({
  printing_apparel_kobo: kobo.min(0), frame_artwork_kobo: kobo.min(0), packaging_kobo: kobo.min(0), labor_kobo: kobo.min(0), processing_fee_kobo: kobo.min(0), other_kobo: kobo.min(0),
});
