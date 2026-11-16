'use server';
import { revalidatePath } from 'next/cache';
import { clientIp } from '@/lib/client-ip';
import { getRpc } from '@/lib/db';
import { logEvent } from '@/lib/log';
import { notifyPresale } from '@/lib/notifications';
import { rateLimit } from '@/lib/rate-limit';
import { normaliseNigerianPhone } from '@/lib/validators/phone';
import { GARMENT_LABEL, PresaleSubmitSchema, cleanItems, describeItems, presaleState, totalQty, type Garment } from '@/lib/presale/schema';
import { getPresaleConfig } from '@/lib/presale/server';

export type PresaleState = {
  ok: boolean; message: string; values?: Record<string, string>; fieldErrors?: Record<string, string>;
  reference?: string; lines?: string[]; total?: number; demo?: boolean;
} | null;

/** Saves a pre-sale request. Validates everything again here (the browser form is only a convenience). */
export async function submitPresale(_prev: PresaleState, fd: FormData): Promise<PresaleState> {
  // Echoed back on failure: React resets uncontrolled fields after an action, so the form refills from this.
  const values: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string') values[k] = v;
  const fail = (message: string, fieldErrors?: Record<string, string>): PresaleState => ({ ok: false, message, values, fieldErrors });

  const config = await getPresaleConfig();
  const state = presaleState(config);
  if (state !== 'open') return fail(config.closedText);

  if (!(await rateLimit(`presale:${await clientIp()}`, 6, 30 * 60_000)).ok) return fail('Too many requests. Please try again in a little while, or message us on WhatsApp.');

  let rawItems: unknown = [];
  try { rawItems = JSON.parse(String(fd.get('items') ?? '[]')); } catch { /* handled below as an empty order */ }
  const parsed = PresaleSubmitSchema.safeParse({
    name: String(fd.get('name') ?? ''), email: String(fd.get('email') ?? '').toLowerCase(), phone: String(fd.get('phone') ?? ''), state: String(fd.get('state') ?? ''), city: String(fd.get('city') ?? ''),
    address: fd.get('address') || undefined, items: rawItems, notes: fd.get('notes') || undefined, whatsappUpdates: fd.get('whatsappUpdates') === 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return fail('Please fix the highlighted fields.', fieldErrors);
  }
  const v = parsed.data;
  const items = cleanItems(v.items).filter((i) => config.garments.includes(i.garment));
  if (totalQty(items) < 1) return fail('Choose at least one piece: pick a garment and enter a quantity for one or more sizes.', { items: 'Add at least one piece.' });

  const rpc = await getRpc();
  if (!rpc) return { ok: true, demo: true, message: 'Demo mode: your request is valid but was not saved because the database is not connected yet.', total: totalQty(items), lines: describeItems(items, config.garmentLabels) };
  const phone = normaliseNigerianPhone(v.phone)!;
  const r = await rpc<{ reference: string; total_qty: number }>('presale_submit', {
    name: v.name, email: v.email, phone, state: v.state, city: v.city, address: v.address ?? null, items, notes: v.notes ?? null, whatsapp_updates: v.whatsappUpdates,
  });
  if (r.error || !r.data) {
    logEvent('presale.save_failed', { error: r.error?.message });
    return fail('We could not save your request. Please try again, or message us on WhatsApp.');
  }
  const labels = config.garmentLabels as Record<Garment, string>;
  const lines = describeItems(items, { ...GARMENT_LABEL, ...labels });
  const location = [v.city, v.state].join(', ');
  logEvent('presale.submitted', { reference: r.data.reference, total: r.data.total_qty });
  const summary = [`Pre-order ${r.data.reference} (${r.data.total_qty} pieces)`, v.name, `${phone} | ${v.email}`, `${location}${v.address ? ` | ${v.address}` : ''}`, ...lines, v.notes ? `Notes: ${v.notes}` : '', `WhatsApp updates: ${v.whatsappUpdates ? 'yes' : 'no'}`].filter(Boolean).join('\n');
  void notifyPresale({ to: v.email, name: v.name, reference: r.data.reference, lines, location, successText: config.successText, summary }).catch(() => undefined);
  revalidatePath('/admin/presale');
  return { ok: true, message: config.successText, reference: r.data.reference, lines, total: r.data.total_qty };
}
