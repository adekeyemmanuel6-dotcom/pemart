import { z } from 'zod';
import { normaliseNigerianPhone } from '@/lib/validators/phone';

/** The pre-sale: what can be pre-ordered and how a request is validated. Shared by the form, the server action and the admin. */
export const GARMENTS = ['tee', 'sweatshirt', 'hoodie'] as const;
export type Garment = (typeof GARMENTS)[number];
export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export type Size = (typeof SIZES)[number];
export const GARMENT_LABEL: Record<Garment, string> = { tee: 'T-shirt', sweatshirt: 'Sweatshirt', hoodie: 'Hoodie' };
export const SIZE_LABEL: Record<Size, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'X-Large', XXL: 'XX-Large' };
export const MAX_PER_SIZE = 50;
export const STATUSES = ['new', 'contacted', 'confirmed', 'cancelled'] as const;
export type PresaleStatus = (typeof STATUSES)[number];

export type PresaleItem = { garment: Garment; sizes: Partial<Record<Size, number>> };
export const itemQty = (i: PresaleItem) => Object.values(i.sizes).reduce<number>((n, q) => n + (q ?? 0), 0);
export const totalQty = (items: PresaleItem[]) => items.reduce((n, i) => n + itemQty(i), 0);

const text = (d: string, max = 300) => z.string().max(max).default(d);
const date = z.string().trim().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use the date picker');

/**
 * Owner-editable settings (Admin > Pre-sale > Settings). Every field has a default, so a half-filled or missing
 * document never breaks the page. Dates are Lagos calendar days, inclusive.
 */
export const PresaleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  showBar: z.boolean().default(true),               // show the "Pre-order now" strip across the store
  barText: text('Pre-sale is open. Reserve your pieces now.', 120),
  kicker: text('limited drop', 60),
  headline: text('Pre-sale', 60),
  subhead: text('Reserve your pieces before they drop. Tell us what you want, your sizes and where to send it. No payment now: we confirm with you on WhatsApp.', 400),
  imageUrl: text('', 500),                           // the poster / lookbook picture
  imageAlt: text('', 200),
  startsOn: date.default(''),
  endsOn: date.default(''),
  offers: z.array(z.object({ text: z.string().trim().min(1).max(80), price: z.string().trim().max(40) })).max(4).default([]),
  garments: z.array(z.enum(GARMENTS)).min(1).default([...GARMENTS]),
  garmentLabels: z.object({ tee: text('T-shirt', 30), sweatshirt: text('Sweatshirt', 30), hoodie: text('Hoodie', 30) }).prefault({}),
  notesHelp: text('Colour preference, fit, a gift message, delivery date: anything we should know.', 200),
  notice: text('Pre-order requests are not payments. We will confirm price, availability and delivery with you before you pay anything.', 300),
  successTitle: text('You are on the list', 80),
  successText: text('We have your pre-order request. We will message you on WhatsApp to confirm everything before you pay.', 300),
  closedText: text('Pre-sale is closed right now. Check back soon, or message us on WhatsApp.', 200),
  // The confirmation email the customer receives. {reference} in the subject becomes e.g. PRE-1001.
  emailSubject: text('Your pre-order request {reference}', 100),
  emailIntro: text('', 500),
  emailFooter: text('', 500),
});
export type PresaleConfig = z.infer<typeof PresaleConfigSchema>;
export const presaleDefaults = (): PresaleConfig => PresaleConfigSchema.parse({});
export const resolvePresale = (raw: unknown): PresaleConfig => {
  const r = PresaleConfigSchema.safeParse(raw ?? {});
  return r.success ? r.data : presaleDefaults();
};

/** Open means switched on and today (Lagos) is inside the optional date window. */
export function presaleState(c: PresaleConfig, now = new Date()): 'open' | 'soon' | 'ended' | 'off' {
  if (!c.enabled) return 'off';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now);
  if (c.startsOn && today < c.startsOn) return 'soon';
  if (c.endsOn && today > c.endsOn) return 'ended';
  return 'open';
}

const itemSchema = z.object({
  garment: z.enum(GARMENTS),
  sizes: z.partialRecord(z.enum(SIZES), z.number().int().min(0).max(MAX_PER_SIZE)).default({}),
});

export const PresaleSubmitSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.email('Enter a valid email address').max(254),
  phone: z.string().trim().refine((v) => normaliseNigerianPhone(v) !== null, 'Enter a valid Nigerian WhatsApp number, e.g. 0803 123 4567'),
  state: z.string().trim().min(2, 'Choose your state').max(40),
  city: z.string().trim().min(1, 'Enter your city or town').max(80),
  address: z.string().trim().max(300).optional(),
  items: z.array(itemSchema).max(3),
  notes: z.string().trim().max(1500).optional(),
  whatsappUpdates: z.boolean().default(true),
});
export type PresaleSubmit = z.infer<typeof PresaleSubmitSchema>;

/** Keeps only the sizes with a quantity, drops garments with nothing ordered. */
export function cleanItems(items: { garment: Garment; sizes: Partial<Record<Size, number>> }[]): PresaleItem[] {
  return items
    .map((i) => ({ garment: i.garment, sizes: Object.fromEntries(SIZES.filter((s) => (i.sizes[s] ?? 0) > 0).map((s) => [s, i.sizes[s]!])) as PresaleItem['sizes'] }))
    .filter((i) => itemQty(i) > 0);
}

export function describeItems(items: PresaleItem[], labels: Record<Garment, string> = GARMENT_LABEL) {
  return items.map((i) => `${labels[i.garment]}: ${SIZES.filter((s) => i.sizes[s]).map((s) => `${s} × ${i.sizes[s]}`).join(', ')}`);
}
