import 'server-only';
import { getRpc } from '@/lib/db';
import { getCatalogue } from '@/lib/catalogue/load';
import { publicEnv } from '@/lib/env';
import { logEvent } from '@/lib/log';
import { initializeTransaction, paystackConfigured, paystackMock, paystackPublicKey } from '@/lib/paystack';
import { getSettings } from '@/lib/settings';
import { activeWallets, type CryptoOrderView } from '@/lib/crypto-pay';
import { notifyGiftCard, notifyOrderConfirmed } from '@/lib/notifications';
import type { EmailOrder } from '@/emails/order-confirmation';
import { priceCart } from './pricing';
import type { DbContext, PricingInput, PricingSettings, PublicQuote, Quote } from './types';

export type Who = { profileId?: string | null; email?: string | null };
export type Details = {
  email: string; phone: string; isGift: boolean; giftMessage?: string;
  address: { recipient: string; phone: string; line1: string; area?: string; city: string; state: string; instructions?: string };
};

export async function pricingSettings(): Promise<PricingSettings> {
  const s = await getSettings();
  return { giftWrapKobo: s.gift_wrap_kobo, surpriseNoteKobo: s.surprise_note_kobo, expressKobo: s.express_kobo, expressEnabled: s.express_enabled, upsellProductId: s.upsell_product_id, upsellPriceKobo: s.upsell_price_kobo, revisionFeeKobo: s.revision_fee_kobo, freeShippingThresholdKobo: s.free_shipping_threshold_kobo };
}

/** Quote a bag: catalogue + settings + what the database says about codes, credit and custom briefs. */
export async function quoteCart(input: PricingInput, who: Who = {}, now = new Date()): Promise<Quote> {
  const [cached, settings, rpc] = await Promise.all([getCatalogue(), pricingSettings(), getRpc()]);
  const ctx: DbContext = {};
  let cat = cached;
  if (rpc) {
    // Prices come from the cached catalogue, but availability must be live: overlay current stock.
    const live = await rpc<{ id: string; stock_qty: number; reserved_qty: number }[]>('checkout_stock', {});
    if (live.data?.length) {
      const stock = new Map(live.data.map((r) => [r.id, r]));
      cat = { ...cached, products: cached.products.map((p) => (p.product_variants.some((v) => stock.has(v.id)) ? { ...p, product_variants: p.product_variants.map((v) => (stock.has(v.id) ? { ...v, stock_qty: stock.get(v.id)!.stock_qty, reserved_qty: stock.get(v.id)!.reserved_qty } : v)) } : p)) };
    }
    if (input.code?.trim() || input.giftCode?.trim() || who.profileId) {
      const r = await rpc<Record<string, unknown>>('checkout_context', { code: input.code?.trim() || null, gift_code: input.giftCode?.trim() || null, profile_id: who.profileId ?? null, email: who.email ?? null });
      if (r.data) { Object.assign(ctx, { discount: r.data.discount, gift_card: r.data.gift_card, credit_kobo: r.data.credit_kobo }); }
    }
    const customIds = input.lines.filter((l) => l.kind === 'custom' || l.kind === 'revision').map((l) => l.refId);
    if (customIds.length) {
      const r = await rpc<DbContext['customRequests']>('checkout_custom_requests', { ids: customIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)) });
      ctx.customRequests = r.data ?? [];
    }
  }
  return priceCart(cat, settings, ctx, input, now);
}

export const publicQuote = (q: Quote): PublicQuote => {
  const { reservations: _r, dbItems: _d, discountId: _i, ambassadorCode: _a, giftCardId: _g, ...rest } = q;
  void _r; void _d; void _i; void _a; void _g;
  return rest;
};
export type { PublicQuote };

export type StartResult =
  | { ok: true; mode: 'pay'; reference: string; accessCode: string; publicKey: string; mock: boolean; number: string; token: string; totalKobo: number; email: string }
  | { ok: true; mode: 'paid'; number: string; token: string }
  | { ok: true; mode: 'crypto'; number: string; token: string }
  | { ok: false; message: string; issues?: string[] };

const friendlyDbError = async (msg: string): Promise<string> => {
  if (msg.includes('shipping_')) return 'Your delivery service needs confirmation. Please refresh your quote or contact our team before paying.';
  if (msg.startsWith('out_of_stock:')) {
    const sku = msg.split(':')[1] ?? '';
    const cat = await getCatalogue();
    const p = cat.products.find((x) => x.product_variants.some((v) => v.sku === sku));
    return `Sorry, ${p?.name ?? 'an item in your bag'} just sold out. Please update your bag and try again.`;
  }
  if (msg.startsWith('unavailable:')) return 'An item in your bag is no longer available. Please update your bag.';
  if (msg.includes('insufficient_credit')) return 'Your store credit changed. Please review your order and try again.';
  if (msg.includes('gift_card_unavailable')) return 'That gift card can no longer cover this order. Please review your order.';
  return 'We could not create your order. Please try again.';
};

/**
 * Re-price everything from the database, create the order (stock held, status pending_payment) in one
 * transaction, then start the Paystack transaction for the amount we computed.
 */
export async function createOrderAndInitPayment(input: PricingInput, details: Details, who: Who, now = new Date(), method: 'paystack' | 'crypto' = 'paystack'): Promise<StartResult> {
  const rpc = await getRpc();
  if (!rpc) return { ok: false, message: 'Checkout is not connected to a database yet. Add your Supabase keys to take orders.' };
  if (method === 'crypto' && activeWallets(await getSettings()).length === 0) return { ok: false, message: 'Paying with crypto is not available right now. Please pay with Paystack.' };
  const quote = await quoteCart({ ...input, state: details.address.state, city: details.address.city }, { ...who, email: details.email }, now);
  if (!quote.ok) return { ok: false, message: quote.issues[0] ?? 'Please review your bag.', issues: quote.issues };
  if (!quote.digitalOnly && !quote.zone) return { ok: false, message: 'Choose where we are delivering to.' };

  const reference = `pm_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const created = await rpc<{ order_id: string; number: string; token: string; total: number; reference: string }>('checkout_create_order', {
    profile_id: who.profileId ?? null, contact_email: details.email, contact_phone: details.phone, address: details.address,
    delivery_zone_id: quote.zone?.id ?? null, delivery_zone_name: quote.zone?.name ?? null, is_gift: details.isGift, gift_message: details.giftMessage ?? null,
    ship_ready_first: quote.shipReadyFirstKobo > 0, express: quote.expressKobo > 0, surprise_note: quote.surpriseNoteKobo > 0,
    shipping_eligible_subtotal: quote.eligibleMerchandiseKobo,
    subtotal: quote.subtotalKobo, discount: quote.discount?.amountKobo ?? 0, delivery_fee: quote.deliveryFeeKobo, gift_wrap: quote.giftWrapKobo,
    surprise_note_fee: quote.surpriseNoteKobo, express_fee: quote.expressKobo, ship_ready_first_fee: quote.shipReadyFirstKobo,
    credit_used: quote.creditAppliedKobo, gift_card_used: quote.giftCardAppliedKobo, total: quote.totalKobo,
    discount_code_id: quote.discountId, discount_code: quote.discount?.code ?? null, ambassador_code: quote.ambassadorCode, gift_card_id: quote.giftCardId,
    has_custom: quote.hasCustom, has_bundle: quote.hasBundle,
    reserve: quote.reservations.map((r) => ({ variant_id: r.variantId, qty: r.qty })),
    items: quote.dbItems.map((i) => ({ ...i, gift_message: i.gift_message ?? null })),
    payment_reference: reference, expires_at: new Date(now.getTime() + 24 * 3600_000).toISOString(),
  });
  if (created.error || !created.data) {
    logEvent('checkout.create_failed', { error: created.error?.message });
    return { ok: false, message: await friendlyDbError(created.error?.message ?? '') };
  }
  const order = created.data;
  logEvent('checkout.order_created', { number: order.number, totalKobo: order.total, reference });

  // Fully covered by gift card / credit: no payment step, settle straight away.
  if (quote.totalKobo === 0) {
    const settled = await settlePayment(reference, { source: 'free_order', amountKobo: 0, currency: 'NGN', payload: { free: true } });
    return settled.ok ? { ok: true, mode: 'paid', number: order.number, token: order.token } : { ok: false, message: 'We could not complete your order. Please contact us on WhatsApp.' };
  }

  if (method === 'crypto') {
    const switched = await rpc('checkout_use_crypto', { order_id: order.order_id, reference });
    if (switched.error) {
      logEvent('checkout.crypto_failed', { number: order.number, error: switched.error.message });
      await rpc('checkout_cancel_order', { order_id: order.order_id, note: 'Crypto payment could not be started' });
      return { ok: false, message: 'Paying with crypto is not available right now. Please pay with Paystack.' };
    }
    logEvent('checkout.crypto_started', { number: order.number });
    return { ok: true, mode: 'crypto', number: order.number, token: order.token };
  }

  if (!paystackConfigured()) {
    await rpc('checkout_cancel_order', { order_id: order.order_id, note: 'Payments not configured' });
    return { ok: false, message: 'Payments are not set up yet. Add your Paystack keys to take orders.' };
  }
  const init = await initializeTransaction({
    email: details.email, amountKobo: quote.totalKobo, reference, callbackUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/order/${order.number}?t=${order.token}`,
    metadata: { order_id: order.order_id, order_number: order.number },
  });
  if (!init.ok) {
    await rpc('checkout_cancel_order', { order_id: order.order_id, note: 'Payment could not be started' });
    return { ok: false, message: init.message };
  }
  return { ok: true, mode: 'pay', reference, accessCode: init.accessCode, publicKey: paystackPublicKey(), mock: paystackMock(), number: order.number, token: order.token, totalKobo: quote.totalKobo, email: details.email };
}

export type SettleResult = { ok: boolean; already?: boolean; number?: string; token?: string; status?: string; error?: string; needsRefund?: boolean };

/** Mark a payment as paid exactly once. Safe to call from verify and webhook, in any order, any number of times. */
export async function settlePayment(reference: string, e: { source: 'verify' | 'webhook' | 'free_order'; amountKobo: number; currency: string; payload: unknown }): Promise<SettleResult> {
  const rpc = await getRpc();
  if (!rpc) return { ok: false, error: 'no_database' };
  const r = await rpc<{ ok: boolean; already?: boolean; error?: string; number?: string; token?: string; status?: string; needs_refund?: boolean; gift_cards?: { code: string; amount: number; recipient_email?: string; message?: string }[] }>(
    'checkout_mark_paid', { reference, amount: e.amountKobo, currency: e.currency, payload: e.payload });
  if (r.error || !r.data) { logEvent('payment.settle_error', { reference, source: e.source, error: r.error?.message }); return { ok: false, error: 'db_error' }; }
  const d = r.data;
  logEvent('payment.settled', { reference, source: e.source, ok: d.ok, already: !!d.already, error: d.error, number: d.number, needsRefund: !!d.needs_refund });
  if (!d.ok) return { ok: false, error: d.error };
  if (!d.already && !d.needs_refund && d.number && d.token) await sendOrderEmails(d.number, d.token, d.gift_cards ?? []);
  return { ok: true, already: !!d.already, number: d.number, token: d.token, status: d.status, needsRefund: d.needs_refund };
}

export async function sendOrderEmails(number: string, token: string, giftCards: { code: string; amount: number; recipient_email?: string; message?: string }[]) {
  try {
    const order = await fetchOrder({ number, token });
    if (!order) return;
    await notifyOrderConfirmed(order.contact_email, toEmailOrder(order));
    for (const g of giftCards) await notifyGiftCard({ to: g.recipient_email || order.contact_email, code: g.code, amountKobo: g.amount, message: g.message, from: g.recipient_email ? order.address?.recipient : null });
  } catch (err) { logEvent('email.order_error', { number, error: (err as Error).message }); }
}

export type Proof = { version: number; path: string; message: string | null; sent_at: string };
export type CustomRequestView = {
  id: string; tier: 'personalise' | 'text_design' | 'full_custom'; product_type: string; colour: string | null; status: string; proofs: Proof[];
  feedback: { version: number; note: string; at: string }[]; revisions_used: number; revisions_paid: number;
  text_fields: { lines?: string[]; name?: string; date?: string; verse?: string; size?: string }; type_style: string | null; notes: string | null; print_positions: string[]; design_slug: string | null;
};
export type OrderView = {
  id: string; number: string; status: string; has_custom: boolean; contact_email: string; contact_phone: string;
  subtotal_kobo: number; discount_kobo: number; delivery_fee_kobo: number; gift_wrap_kobo: number; surprise_note_kobo: number; express_kobo: number; ship_ready_first_kobo: number;
  credit_used_kobo: number; gift_card_used_kobo: number; total_kobo: number;
  address: { recipient: string; phone: string; line1: string; area?: string; city: string; state: string };
  delivery_zone_name: string | null; is_gift: boolean; gift_message: string | null; discount_code: string | null; payment_reference: string | null;
  paid_at: string | null; production_start_at: string | null; promised_by: string | null; delivered_at: string | null; expires_at: string | null; created_at: string; token: string; profile_id: string | null;
  custom_requests: CustomRequestView[];
  items: { id: string; kind: string; name: string; options: Record<string, unknown>; selections: { label: string; productName: string; colour?: string; size?: string; option?: string; customText?: string }[] | null; unit_price_kobo: number; quantity: number; custom_request_id: string | null; gift_message: string | null; review_status: string | null }[];
  events: { status: string; note: string | null; created_at: string }[];
};

/** Crypto details for an order the caller has ALREADY authorised (via fetchOrder). Null for Paystack orders or before 0018. */
export async function fetchCryptoPayment(orderId: string): Promise<CryptoOrderView | null> {
  const rpc = await getRpc();
  if (!rpc) return null;
  const r = await rpc<CryptoOrderView | null>('checkout_get_crypto', { order_id: orderId });
  return r.error ? null : r.data ?? null;
}

export async function fetchOrder(q: { number: string; token?: string; contact?: string; profileId?: string | null }): Promise<OrderView | null> {
  const rpc = await getRpc();
  if (!rpc) return null;
  const r = await rpc<OrderView | null>('checkout_get_order', { number: q.number, token: q.token ?? null, contact: q.contact ?? null, profile_id: q.profileId ?? null });
  return r.data ?? null;
}

export function toEmailOrder(o: OrderView): EmailOrder {
  const extras = o.gift_wrap_kobo + o.surprise_note_kobo + o.express_kobo + o.ship_ready_first_kobo;
  return {
    number: o.number, token: o.token, hasCustom: o.has_custom, proofHours: o.has_custom ? 24 : null, promisedBy: o.promised_by,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitKobo: i.unit_price_kobo, giftMessage: i.gift_message,
      contents: (i.selections ?? []).map((s) => `${s.label}: ${[s.productName, s.colour, s.size, s.option, s.customText ? `"${s.customText}"` : ''].filter(Boolean).join(' · ')}`) })),
    subtotalKobo: o.subtotal_kobo, discountKobo: o.discount_kobo, deliveryFeeKobo: o.delivery_fee_kobo, extrasKobo: extras, creditKobo: o.credit_used_kobo, giftCardKobo: o.gift_card_used_kobo, totalKobo: o.total_kobo,
    address: o.address, giftMessage: o.gift_message,
  };
}

export async function expireUnpaidOrders(now = new Date()): Promise<number> {
  const rpc = await getRpc();
  if (!rpc) return 0;
  const r = await rpc<{ cancelled: number }>('checkout_cancel_expired', { now: now.toISOString() });
  const n = r.data?.cancelled ?? 0;
  logEvent('checkout.expired_cancelled', { count: n });
  return n;
}
