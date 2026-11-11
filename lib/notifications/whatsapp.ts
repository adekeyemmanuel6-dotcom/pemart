import { whatsappLink } from '@/lib/site';

/**
 * WhatsApp at launch = click-to-chat links with the order number and status pre-filled, so staff (or the
 * customer) can send an update in one tap. `WhatsAppChannel` is the seam for the WhatsApp Business Cloud API:
 * implement `send` later and register it in notifications/index.ts, with no other code changing.
 */
export interface WhatsAppChannel { send(toE164: string, template: string, vars: Record<string, string>): Promise<void> }

export const orderStatusMessage = (number: string, status: string, promisedBy?: string | null) =>
  `Hi, this is Pemart about order ${number}. Status: ${status.replace(/_/g, ' ')}.${promisedBy ? ` Expected by ${new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(promisedBy))}.` : ''}`;

export const customerOrderLink = (shopNumber: string | null, number: string) => whatsappLink(shopNumber, `Hi Pemart, I have a question about order ${number}.`);
export const staffUpdateLink = (customerPhoneE164: string, number: string, status: string, promisedBy?: string | null) =>
  whatsappLink(customerPhoneE164, orderStatusMessage(number, status, promisedBy));
