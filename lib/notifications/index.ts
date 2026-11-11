import 'server-only';
import { createElement } from 'react';
import BulkQuoteReceived from '@/emails/bulk-quote';
import GiftCardEmail from '@/emails/gift-card';
import OrderConfirmation, { type EmailOrder } from '@/emails/order-confirmation';
import AbandonedCheckout from '@/emails/abandoned-checkout';
import OrderStatus, { statusCopy } from '@/emails/order-status';
import ProofApproved from '@/emails/proof-approved';
import ProofReady from '@/emails/proof-ready';
import ReviewRequest from '@/emails/review-request';
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

const orderLink = (number: string, token: string, hash = '') => `${site()}/order/${number}?t=${token}${hash}`;

export async function notifyProofReady(o: { to: string; number: string; token: string; version: number; message?: string | null }) {
  return sendEmail({ to: o.to, subject: `Your design proof is ready (order ${o.number})`, tag: 'proof-ready', react: createElement(ProofReady, { number: o.number, version: o.version, message: o.message, link: orderLink(o.number, o.token, '#proofs'), siteUrl: site(), whatsappUrl: await wa() }) });
}

export async function notifyProofApproved(o: { to: string; number: string; token: string; promisedBy: string | null }) {
  return sendEmail({ to: o.to, subject: `Design approved: order ${o.number}`, tag: 'proof-approved', react: createElement(ProofApproved, { number: o.number, promisedBy: o.promisedBy, link: orderLink(o.number, o.token), siteUrl: site(), whatsappUrl: await wa() }) });
}

/** In production, out for delivery, delivered. Other statuses do not email the customer. */
export async function notifyOrderStatus(o: { to: string; number: string; token: string; status: string; promisedBy?: string | null }) {
  const copy = statusCopy(o.status);
  if (!copy) return { sent: false, reason: 'no_template' };
  return sendEmail({ to: o.to, subject: `Order ${o.number} ${copy.subject}`, tag: `status-${o.status}`, react: createElement(OrderStatus, { number: o.number, status: o.status, promisedBy: o.promisedBy, link: orderLink(o.number, o.token), siteUrl: site(), whatsappUrl: await wa() }) });
}

export async function notifyReviewRequest(o: { to: string; number: string; token: string; creditKobo: number }) {
  return sendEmail({ to: o.to, subject: 'How is it? Earn store credit with a photo review', tag: 'review-request', react: createElement(ReviewRequest, { number: o.number, creditKobo: o.creditKobo, link: `${site()}/order/${o.number}/review?t=${o.token}`, siteUrl: site(), whatsappUrl: await wa() }) });
}

export async function notifyAbandoned(o: { to: string; number: string; token: string; totalKobo: number }) {
  return sendEmail({ to: o.to, subject: 'You left something behind', tag: 'abandoned-checkout', react: createElement(AbandonedCheckout, { number: o.number, totalKobo: o.totalKobo, link: orderLink(o.number, o.token), siteUrl: site(), whatsappUrl: await wa() }) });
}

/** A plain note to the shop owner (revision requested, etc). No-op until ADMIN_NOTIFY_EMAIL is set. */
export async function notifyAdmin(subject: string, text: string) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return { sent: false, reason: 'no_admin_email' };
  return sendEmail({ to, subject, tag: 'admin', react: createElement('pre', null, text) });
}
