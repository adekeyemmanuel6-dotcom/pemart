import { expect } from '@playwright/test';
import { Pool } from 'pg';

export const B = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3200}`;
export const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pemart_e2e', max: 3 });
export const q = async (s: string, a: unknown[] = []) => (await pool.query(s, a)).rows;

/** A named check. Soft, so one failure doesn't hide the rest of a long walk-through. */
export const ok = (condition: unknown, message: string) => expect.soft(!!condition, message).toBe(true);

export const NUMBER = (url: string) => url.match(/PM-\d+/)![0];

import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

export async function fillCheckout(d: Page, email: string, state?: string) {
  await d.locator('#email').fill(email);
  await d.locator('#phone').fill('0803 123 4567');
  if (await d.locator('#line1').count()) {
    await d.locator('#recipient').fill('Ada Obi'); await d.locator('#line1').fill('12 Allen Avenue'); await d.locator('#city').fill('Ikeja');
    if (state) await d.selectOption('#state', state);
  }
}

export async function payMock(d: Page) {
  await d.getByRole('button', { name: /^Pay ₦/ }).click();
  await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
  await d.getByRole('button', { name: 'Simulate successful payment' }).click();
  await d.waitForURL(/\/order\/PM-\d+/, { timeout: 20_000 });
}

/** Add a tee to the bag, go to checkout and open (then cancel) the payment popup, leaving an unpaid order behind. */
export async function startUnpaidTeeOrder(d: Page, email: string, size = 'M') {
  await d.goto(`${B}/products/seek-first-tee`);
  await d.getByRole('button', { name: size, exact: true }).click();
  await d.getByRole('button', { name: 'Add to bag' }).first().click();
  await d.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click();
  await d.waitForURL(/checkout/);
  await fillCheckout(d, email);
  await d.getByText('Promised by').waitFor();
  await d.getByRole('button', { name: /^Pay ₦/ }).click();
  await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
  await d.getByRole('button', { name: 'Cancel' }).click();
  await d.getByText(/Payment was not completed/).waitFor();
  const [o] = await q(`select o.number, o.total_kobo, p.reference from orders o join payments p on p.order_id = o.id where o.contact_email = $1 order by o.created_at desc limit 1`, [email]);
  return { number: o.number as string, totalKobo: Number(o.total_kobo), reference: o.reference as string };
}

/** Send a Paystack-style webhook, signed (or not) the way Paystack does: HMAC-SHA512 of the raw body. */
export async function sendWebhook(d: Page, body: object, opts: { sign?: boolean; secret?: string } = {}) {
  const raw = JSON.stringify(body);
  const secret = opts.secret ?? 'sk_test_e2e';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.sign !== false) headers['x-paystack-signature'] = createHmac('sha512', secret).update(raw).digest('hex');
  return d.request.post(`${B}/api/webhooks/paystack`, { data: raw, headers });
}

export const lagosDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(d);
};
