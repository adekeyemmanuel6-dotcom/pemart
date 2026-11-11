import 'server-only';
import { createElement } from 'react';
import BulkQuoteReceived from '@/emails/bulk-quote';
import GiftCardEmail from '@/emails/gift-card';
import OrderConfirmation, { type EmailOrder } from '@/emails/order-confirmation';
import { publicEnv } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { whatsappLink } from '@/lib/site';
import { sendEmail } from './email';

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL;
const wa = async () => whatsappLink((await getSettings()).whatsapp_number, 'Hi Pemart, I have a question.');

/** Notification entry points. Each event fans out to its channels (email now, WhatsApp API later). */
export async function notifyOrderConfirmed(to: string, order: EmailOrder) {
  return sendEmail({ to, subject: `Order ${order.number} confirmed`, tag: 'order-confirmation', react: createElement(OrderConfirmation, { o: order, siteUrl: site(), whatsappUrl: await wa() }) });
}

export async function notifyGiftCard(g: { to: string; code: string; amountKobo: number; message?: string | null; from?: string | null }) {
  return sendEmail({ to: g.to, subject: 'You have a Pemart gift card', tag: 'gift-card', react: createElement(GiftCardEmail, { ...g, siteUrl: site(), whatsappUrl: await wa() }) });
}

export async function notifyBulkQuote(q: { to: string; name: string; quantity: number; ref: string; summary: string }) {
  const customer = await sendEmail({ to: q.to, subject: 'We got your bulk quote request', tag: 'bulk-quote', react: createElement(BulkQuoteReceived, { name: q.name, quantity: q.quantity, ref: q.ref, siteUrl: site(), whatsappUrl: await wa() }) });
  const admin = process.env.ADMIN_NOTIFY_EMAIL;
  if (admin) await sendEmail({ to: admin, subject: `New bulk quote ${q.ref}: ${q.quantity} pieces`, tag: 'bulk-quote-admin', react: createElement('pre', null, q.summary) });
  return customer;
}
