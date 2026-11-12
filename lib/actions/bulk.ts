'use server';
import { z } from 'zod';
import { BULK_MIN, bulkTier } from '@/lib/bulk';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyBulkQuote } from '@/lib/notifications';
import { normaliseNigerianPhone } from '@/lib/validators/phone';

export type BulkState = { ok: boolean; demo?: boolean; values?: Record<string, string>; message: string; fieldErrors?: Record<string, string>; ref?: string; quantity?: number } | null;

const sizeKeys = ['S', 'M', 'L', 'XL', 'XXL'] as const;
const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  organisation: z.string().trim().max(120).optional(),
  phone: z.string().trim().refine((v) => normaliseNigerianPhone(v) !== null, 'Enter a valid Nigerian WhatsApp number, e.g. 0803 123 4567'),
  email: z.email('Enter a valid email address').max(254),
  productType: z.enum(['tee', 'hoodie', 'frame', 'gift_set', 'other']),
  quantity: z.coerce.number().int().min(BULK_MIN, `Bulk pricing starts at ${BULK_MIN} pieces`).max(20000),
  dateNeeded: z.string().optional().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date'),
  idea: z.string().trim().max(2000).optional(),
  uploadPaths: z.array(z.string().max(300).regex(/^(guest\/[0-9a-f-]{36}\/[\w.-]+|demo\/.+)$/, 'Invalid upload')).max(5),
});

/** Saves a bulk quote request. Admin notification by email is added with the email system in Phase 4. */
export async function submitBulkQuote(_prev: BulkState, fd: FormData): Promise<BulkState> {
  // Echoed back on failure: React resets uncontrolled fields after an action, so the form refills from this.
  const values: Record<string, string> = {};
  for (const [k, val] of fd.entries()) if (typeof val === 'string' && k !== 'uploadPaths') values[k] = val;
  const ip = await clientIp();
  if (!(await rateLimit(`bulk:${ip}`, 5, 30 * 60_000)).ok) return { ok: false, values, message: 'Too many requests. Please try again in a little while, or message us on WhatsApp.' };

  let uploadPaths: string[] = [];
  try { uploadPaths = JSON.parse(String(fd.get('uploadPaths') ?? '[]')); } catch { /* treated as empty */ }
  const sizes: Record<string, number> = {};
  for (const k of sizeKeys) { const n = Math.max(0, parseInt(String(fd.get(`size_${k}`) ?? '0'), 10) || 0); if (n > 0) sizes[k] = n; }

  const parsed = schema.safeParse({
    name: fd.get('name'), organisation: fd.get('organisation') || undefined, phone: fd.get('phone'), email: String(fd.get('email') ?? '').toLowerCase(),
    productType: fd.get('productType'), quantity: fd.get('quantity'), dateNeeded: fd.get('dateNeeded') || undefined, idea: fd.get('idea') || undefined, uploadPaths,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, values, message: 'Please fix the highlighted fields.', fieldErrors };
  }
  const v = parsed.data;
  const sizeTotal = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (sizeTotal > v.quantity) return { ok: false, values, message: 'Please fix the highlighted fields.', fieldErrors: { sizes: 'Your size breakdown adds up to more than the quantity.' } };
  const tier = bulkTier(v.quantity);

  if (!isSupabaseConfigured || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY))
    return { ok: true, demo: true, quantity: v.quantity, message: `Demo mode: your request is valid (${tier?.note ?? 'quote'}) but was not saved because the database is not connected yet.` };

  const { data, error } = await createAdminClient().from('bulk_quotes').insert({
    name: v.name, organisation: v.organisation ?? null, phone: normaliseNigerianPhone(v.phone)!, email: v.email, product_type: v.productType,
    quantity: v.quantity, sizes: sizeTotal ? sizes : null, date_needed: v.dateNeeded ?? null, idea: v.idea ?? null, upload_paths: v.uploadPaths,
  }).select('id').single();
  if (error || !data) return { ok: false, values, message: 'We could not save your request. Please try again or message us on WhatsApp.' };
  const ref = data.id.slice(0, 8).toUpperCase();
  // Email the customer a receipt and tell the admin. Never blocks or fails the request.
  void notifyBulkQuote({ to: v.email, name: v.name, quantity: v.quantity, ref, summary: `Bulk quote ${ref}\n${v.name}${v.organisation ? ` (${v.organisation})` : ''}\n${normaliseNigerianPhone(v.phone)} | ${v.email}\n${v.quantity} x ${v.productType}\nNeeded: ${v.dateNeeded ?? 'n/a'}\nSizes: ${JSON.stringify(sizes)}\nIdea: ${v.idea ?? ''}` });
  return { ok: true, quantity: v.quantity, ref, message: "Thank you. We've got your request and will send a quote soon." };
}
