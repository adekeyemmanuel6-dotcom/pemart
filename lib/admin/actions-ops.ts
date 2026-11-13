'use server';
import { z } from 'zod';
import { notifyQuoteReady } from '@/lib/notifications';
import { staffUpdateLink } from '@/lib/notifications/whatsapp';
import { changeOrderStatus, moderateReview, sendProof } from '@/lib/orders/service';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/orders/status';
import { publicEnv } from '@/lib/env';
import { normaliseNigerianPhone } from '@/lib/validators/phone';
import { redirect } from 'next/navigation';
import { adm, requirePerm } from './db';
import { flashUrl } from './flash';
import { run, str } from './actions-core';
import type { AdminResult } from './types';

const uuid = z.uuid();
const statusSchema = z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]);
const ERR: Record<string, string> = { bad_transition: 'That status change is not allowed from the current status.', proof_not_approved: 'The design is not approved yet, so production cannot start.', not_found: 'Order not found.', not_awaiting_proof: 'This design is not waiting for a proof.' };

export async function changeStatusAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm(['orders', 'fulfilment']);
  return run(['/admin', '/admin/orders', '/admin/production'], async () => {
    const id = uuid.parse(str(fd, 'orderId')), to = statusSchema.parse(str(fd, 'to'));
    const r = await changeOrderStatus({ orderId: id, to, note: str(fd, 'note') || undefined, actor: me.id });
    if (!r.ok) return { ok: false, message: ERR[r.error] ?? 'Could not change the status.' };
    return { ok: true, message: `Moved to ${STATUS_LABEL[to]}.`, link: r.whatsapp, linkLabel: 'Send WhatsApp update' };
  });
}

/** Move several orders at once (production board). Reports exactly which ones could not move. */
export async function bulkStatusAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm(['orders', 'fulfilment']);
  return run(['/admin', '/admin/orders', '/admin/production'], async () => {
    const ids = fd.getAll('ids').map(String).filter((x) => uuid.safeParse(x).success), to = statusSchema.parse(str(fd, 'to'));
    if (!ids.length) return { ok: false, message: 'Tick at least one order first.' };
    let moved = 0; const failed: string[] = [];
    for (const id of ids) { const r = await changeOrderStatus({ orderId: id, to, actor: me.id }); if (r.ok) moved++; else failed.push(ERR[r.error] ?? r.error); }
    return failed.length ? { ok: moved > 0, message: `Moved ${moved} of ${ids.length}. ${failed.length} could not move (${[...new Set(failed)].join('; ')}).` } : { ok: true, message: `Moved ${moved} ${moved === 1 ? 'order' : 'orders'} to ${STATUS_LABEL[to]}.` };
  });
}

export async function saveNoteAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm(['orders', 'fulfilment']);
  return run('/admin/orders', async () => { await adm('admin_order_note', me, { order_id: uuid.parse(str(fd, 'orderId')), notes: str(fd, 'notes') }); return { ok: true, message: 'Note saved.' }; });
}

/** Records a refund. The money itself is returned in the Paystack dashboard; this only updates our records and the customer's page. */
export async function recordRefundAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('orders');
  return run(['/admin/orders', '/admin'], async () => {
    const r = await changeOrderStatus({ orderId: uuid.parse(str(fd, 'orderId')), to: 'refunded', note: `Refund recorded: ${str(fd, 'note') || 'no note'} (processed in Paystack)`, actor: me.id });
    return r.ok ? { ok: true, message: 'Refund recorded. Remember to issue it in the Paystack dashboard.' } : { ok: false, message: ERR[r.error] ?? 'Could not record the refund.' };
  });
}

export async function sendProofAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm(['fulfilment', 'orders']);
  return run(['/admin/proofs', '/admin'], async () => {
    const path = str(fd, 'path');
    if (!path) return { ok: false, message: 'Upload the proof image first.' };
    const r = await sendProof({ customRequestId: uuid.parse(str(fd, 'customRequestId')), path, message: str(fd, 'message') || undefined, actor: me.id });
    if (!r.ok) return { ok: false, message: ERR[r.error] ?? 'Could not send the proof.' };
    redirect(flashUrl('/admin/proofs', `Proof version ${r.version} sent. The customer has been emailed.`, r.whatsapp, 'Also tell them on WhatsApp'));
  });
}

export async function updateQuoteAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('orders');
  return run('/admin/quotes', async () => {
    const amt = str(fd, 'amount').replace(/[,₦\s]/g, '');
    if (amt && !/^\d+(\.\d{1,2})?$/.test(amt)) return { ok: false, message: 'Enter the quoted amount in Naira, like 800000.' };
    const [n, f = ''] = amt.split('.');
    await adm('admin_quote_update', me, { id: uuid.parse(str(fd, 'id')), status: str(fd, 'status'), quoted_amount_kobo: amt ? Number(n) * 100 + Number(f.padEnd(2, '0')) : null });
    redirect(flashUrl('/admin/quotes', 'Quote updated.'));
  });
}

const addrSchema = z.object({ recipient: z.string().trim().min(2), phone: z.string().refine((v) => normaliseNigerianPhone(v) !== null), line1: z.string().trim().min(4), city: z.string().trim().min(2), state: z.string().min(2) });
export async function quoteToOrderAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('orders');
  return run(['/admin/quotes', '/admin/orders'], async () => {
    const a = addrSchema.safeParse({ recipient: str(fd, 'recipient'), phone: str(fd, 'phone'), line1: str(fd, 'line1'), city: str(fd, 'city'), state: str(fd, 'state') });
    if (!a.success) return { ok: false, message: 'Fill in the delivery details (recipient, a valid phone, street, city, state).' };
    const r = await adm<{ ok: boolean; error?: string; number: string; token: string; email: string; total: number; name: string }>('admin_quote_to_order', me, { id: uuid.parse(str(fd, 'id')), address: { ...a.data, phone: normaliseNigerianPhone(a.data.phone) } });
    if (!r.ok) return { ok: false, message: r.error === 'no_quoted_amount' ? 'Add the quoted amount first.' : r.error === 'already_converted' ? 'This quote already has an order.' : 'Could not create the order.' };
    await notifyQuoteReady({ to: r.email, name: r.name, number: r.number, token: r.token, totalKobo: r.total });
    redirect(flashUrl('/admin/quotes', `Order ${r.number} created and the customer was emailed their payment link.`, `${publicEnv.NEXT_PUBLIC_SITE_URL}/order/${r.number}?t=${r.token}`, 'Open payment link'));
  });
}

export async function moderateReviewAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('reviews');
  return run(['/admin/reviews', '/admin'], async () => {
    const decision = str(fd, 'decision');
    if (decision !== 'approve' && decision !== 'reject') return { ok: false, message: 'Unknown choice.' };
    const r = await moderateReview({ reviewId: uuid.parse(str(fd, 'reviewId')), decision, actor: me.id });
    if (!r.ok) return { ok: false, message: 'Could not update the review.' };
    redirect(flashUrl('/admin/reviews', decision === 'approve' ? (r.creditGranted ? 'Approved. Store credit was issued for the photo.' : 'Approved.') : 'Rejected.'));
  });
}

export { staffUpdateLink };
