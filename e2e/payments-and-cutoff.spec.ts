// Acceptance criteria: webhook signature + duplicate handling, and the Christmas cutoff notices.
import { expect, test } from '@playwright/test';
import { B, lagosDate, ok, q, sendWebhook, startUnpaidTeeOrder } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await q(`truncate orders, gift_cards, custom_requests restart identity cascade; update product_variants set reserved_qty = 0; alter sequence order_number_seq restart with 10001`);
});

test('Paystack webhook: bad signatures are rejected, a signed event pays the order once, duplicates change nothing', async ({ page }) => {
  const o = await startUnpaidTeeOrder(page, 'hook@example.com', 'L');
  const event = (amount: number) => ({ event: 'charge.success', data: { reference: o.reference, amount, currency: 'NGN', status: 'success' } });

  expect((await sendWebhook(page, event(o.totalKobo), { sign: false })).status(), 'no signature').toBe(401);
  expect((await sendWebhook(page, event(o.totalKobo), { secret: 'sk_test_wrong' })).status(), 'signed with the wrong key').toBe(401);
  expect((await q(`select status from orders where number = $1`, [o.number]))[0].status, 'still unpaid after rejected calls').toBe('pending_payment');

  expect((await sendWebhook(page, event(1))).status(), 'a signed event for the wrong amount is acknowledged').toBe(200);
  expect((await q(`select status from orders where number = $1`, [o.number]))[0].status, 'a wrong amount does not pay the order').toBe('pending_payment');

  expect((await sendWebhook(page, event(o.totalKobo))).status(), 'valid signed event').toBe(200);
  const paid = (await q(`select status, paid_at from orders where number = $1`, [o.number]))[0];
  expect(paid.status).toBe('paid');
  const stockAfterFirst = (await q(`select sum(stock_qty) s from product_variants`))[0].s;

  expect((await sendWebhook(page, event(o.totalKobo))).status(), 'duplicate delivery').toBe(200);
  expect((await sendWebhook(page, event(o.totalKobo))).status(), 'third delivery').toBe(200);
  const again = (await q(`select status, paid_at from orders where number = $1`, [o.number]))[0];
  expect(+new Date(again.paid_at), 'paid_at is not rewritten by a duplicate').toBe(+new Date(paid.paid_at));
  expect((await q(`select count(*)::int n from payments where reference = $1 and status = 'success'`, [o.reference]))[0].n).toBe(1);
  expect((await q(`select count(*)::int n from order_events where order_id = (select id from orders where number = $1) and status = 'paid'`, [o.number]))[0].n, 'one paid event').toBe(1);
  expect((await q(`select sum(stock_qty) s from product_variants`))[0].s, 'stock is not deducted twice').toBe(stockAfterFirst);

  await page.goto(`${B}/order/${o.number}`);
  // the order link needs its private token; the webhook result is also visible through tracking
  const token = (await q(`select public_token from orders where number = $1`, [o.number]))[0].public_token;
  await page.goto(`${B}/order/${o.number}?t=${token}`);
  await expect(page.getByRole('heading', { name: /Your order is in/ })).toBeVisible();
});

test('Gift-box cutoff: countdown before the date; plain notice, disabled urgency and a checkout warning after it', async ({ page, browser }) => {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await admin.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/settings`);
  const lagos = (await q(`select id, christmas_cutoff_date from delivery_zones where name = 'Lagos'`))[0];
  const setCutoff = async (date: string) => {
    await admin.goto(`${B}/admin/settings`);
    await admin.locator(`#c-${lagos.id}`).fill(date);
    await admin.getByRole('button', { name: /Save Lagos/ }).click();
    await admin.getByText('Zone saved.').waitFor();
  };

  try {
    // before the cutoff: a countdown for Lagos
    await setCutoff(lagosDate(5));
    await page.goto(`${B}/gift-boxes`);
    await expect(page.getByRole('heading', { name: /Order for Christmas delivery in Lagos/ })).toBeVisible();
    ok(!(await page.getByRole('heading', { name: /cutoff has passed/ }).count()), 'no "passed" notice while the cutoff is ahead');

    // after the cutoff: the notice says so, and checkout warns before payment
    await setCutoff(lagosDate(-1));
    await page.goto(`${B}/gift-boxes`);
    await expect(page.getByRole('heading', { name: /The Lagos Christmas cutoff has passed/ })).toBeVisible();

    await page.goto(`${B}/bundles/couples-christmas-box?design=my-beloved&his=L&her=M`);
    await page.locator('li', { hasText: '3. His perfume' }).getByRole('button', { name: 'Blue Amber' }).click();
    await page.locator('li', { hasText: '4. Her perfume' }).getByRole('button', { name: 'White Jasmine' }).click();
    await page.locator('li', { hasText: '5. Couple bracelets' }).getByRole('button', { name: 'Infinity' }).click();
    await page.locator('li', { hasText: '6. Flying orb ball' }).getByRole('button', { name: 'Ember Orange' }).click();
    await page.getByRole('button', { name: 'Add bundle to bag' }).click();
    await page.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click();
    await page.waitForURL(/\/checkout/);
    await page.locator('#email').fill('late@example.com');
    await expect(page.getByRole('complementary', { name: 'Review and pay' }).getByText(/Christmas cutoff has passed, so gift boxes ordered now will not arrive before Christmas/)).toBeVisible();
  } finally {
    await setCutoff('2026-12-17');
    await adminCtx.close();
  }
});
