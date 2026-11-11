// Buying flows: guest tee with code, Couple's Christmas Box, custom design, price tampering, ambassador, bag rules.
// Ported from the Phase 4-6 walk-through scripts. Runs against `next dev` + local Postgres (see playwright.config.ts).
import { test, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { B, ok, pool, q } from './helpers';
const bagLines = (d) => d.evaluate(() => JSON.parse(localStorage.getItem('pemart-bag') || '{"state":{"lines":[]}}').state.lines);

async function fillCheckout(d, o: { email?: string; state?: string } = {}) {
  await d.locator('#email').fill(o.email ?? 'ada@example.com');
  await d.locator('#phone').fill('0803 123 4567');
  if (await d.locator('#line1').count()) {
    await d.locator('#recipient').fill('Ada Obi'); await d.locator('#line1').fill('12 Allen Avenue'); await d.locator('#city').fill('Ikeja');
    if (o.state) await d.selectOption('#state', o.state);
  }
}
async function payMock(d) {
  await d.getByRole('button', { name: /^Pay ₦/ }).click();
  await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
  await d.getByRole('button', { name: 'Simulate successful payment' }).click();
  await d.waitForURL(/\/order\/PM-\d+/, { timeout: 20000 });
}



test("Buying flows: guest tee with code, Couple's Christmas Box, custom design, price tampering, ambassador, bag rules", async ({ browser }) => {
  test.setTimeout(1_200_000);
  await q(`truncate orders, gift_cards, custom_requests restart identity cascade; update product_variants set reserved_qty=0; update product_variants set stock_qty=40 where sku like 'FAITH-BRACELET-%'; update discount_codes set times_used=0; alter sequence order_number_seq restart with 10001`);
  const b = browser;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const d = await ctx.newPage(); const errs = [];
  d.on('console', m => m.type() === 'error' && errs.push(m.text())); d.on('pageerror', e => errs.push('PAGEERR ' + e));

  // ===== A. guest buys a ready tee to Lagos with a code
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: 'M', exact: true }).click();
  await d.getByRole('button', { name: 'Add to bag' }).first().click();
  const drawer = d.getByRole('dialog', { name: 'Your bag' });
  await drawer.getByText('Seek First Oversized Tee').waitFor();
  ok(await drawer.getByText('₦22,000').first().isVisible(), 'A: drawer opens with the tee and its server price');
  ok(await drawer.getByText(/away from free delivery in Lagos/).isVisible(), 'A: free-delivery progress shows');
  ok(await drawer.getByText(/Arrives by/).isVisible(), 'A: estimated delivery date shown');
  await drawer.getByLabel('Discount code').fill('pemart10'); await drawer.getByRole('button', { name: 'Apply' }).click();
  await drawer.getByText(/PEMART10 applied: ₦2,200 off/).waitFor(); ok(true, 'A: discount code applied (₦2,200 off)');
  await d.screenshot({ path: 'test-results/shots/p4-drawer.png' });
  await drawer.getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/\/checkout/);
  await fillCheckout(d);
  await d.getByText('Promised by').waitFor();
  const aside = d.locator('aside[aria-label="Review and pay"]');
  ok((await aside.innerText()).includes('₦23,300'), 'A: checkout total = ₦22,000 - ₦2,200 + ₦3,500 = ₦23,300');
  await d.screenshot({ path: 'test-results/shots/p4-checkout.png', fullPage: true });
  await payMock(d);
  ok(await d.getByRole('heading', { name: /Your order is in/ }).isVisible(), 'A: confirmation page');
  const oA = (await q(`select * from orders order by created_at desc limit 1`))[0];
  ok(oA.status === 'paid' && Number(oA.total_kobo) === 2330000, 'A: DB order paid with ₦23,300 total');
  const days = (+new Date(oA.promised_by) - +new Date(oA.paid_at)) / 86400000;
  ok(Math.abs(days - 5) < 0.01, `A: promised date is 5 days after payment (${days.toFixed(2)})`);
  ok((await bagLines(d)).length === 0, 'A: bag cleared after payment');
  ok((await d.locator('main').innerText()).includes('Arriving by'), 'A: order page shows promised date');
  await d.screenshot({ path: 'test-results/shots/p4-order.png', fullPage: true });

  // ===== B. Couple's Christmas Box, gift message, every selection through to order + email
  await d.goto(`${B}/bundles/couples-christmas-box?design=my-beloved&his=L&her=M`); await d.waitForTimeout(800);
  await d.locator('li', { hasText: '3. His perfume' }).getByRole('button', { name: 'Blue Amber' }).click();
  await d.locator('li', { hasText: '4. Her perfume' }).getByRole('button', { name: 'White Jasmine' }).click();
  await d.locator('li', { hasText: '5. Couple bracelets' }).getByRole('button', { name: 'Infinity' }).click();
  await d.locator('li', { hasText: '6. Flying orb ball' }).getByRole('button', { name: 'Ember Orange' }).click();
  await d.locator('#gift-msg').fill('Merry Christmas, my love');
  await d.getByRole('button', { name: 'Add bundle to bag' }).click();
  const drawer2 = d.getByRole('dialog', { name: 'Your bag' });
  await drawer2.getByText("What's inside").click();
  ok(await drawer2.getByText(/His perfume: .*Blue Amber/).isVisible() && await drawer2.getByText(/Her perfume: .*White Jasmine/).isVisible(), 'B: every selection visible in the bag');
  ok(await drawer2.getByText('“Merry Christmas, my love”').isVisible(), 'B: gift message in the bag');
  ok(await drawer2.getByText('You have free delivery in Lagos').isVisible(), 'B: ₦89,000 box earns free Lagos delivery');
  await drawer2.getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/\/checkout/);
  await fillCheckout(d, { email: 'love@example.com' });
  await d.getByText('Promised by').waitFor(); await payMock(d);
  const oB = (await q(`select o.*, i.selections, i.gift_message from orders o join order_items i on i.order_id=o.id where o.has_bundle order by o.created_at desc limit 1`))[0];
  ok(oB.status === 'paid' && Number(oB.total_kobo) === 8900000 && oB.selections.length === 6 && oB.gift_message === 'Merry Christmas, my love', "B: DB order has 6 selections, gift message, ₦89,000 (free delivery)");
  const orderText = await d.locator('main').innerText();
  ok(/His tee/.test(orderText) && /Blue Amber/.test(orderText) && /Infinity/.test(orderText) && /Ember Orange/.test(orderText), 'B: order page lists every selection');
  const outbox = fs.readdirSync(path.join(process.cwd(), '.outbox')).filter(f => f.includes('love'));
  const html = outbox.length ? fs.readFileSync(path.join(process.cwd(), '.outbox', outbox[0]), 'utf8') : '';
  ok(/Blue Amber/.test(html) && /White Jasmine/.test(html) && /Merry Christmas/.test(html), 'B: confirmation email contains every selection and the gift message');

  // ===== C. custom text design: pay, awaiting_proof, no promise yet
  await d.goto(`${B}/custom`); await d.waitForTimeout(800);
  await d.getByLabel('Line 1').fill('Grace upon grace'); await d.getByRole('button', { name: 'M', exact: true }).first().click();
  await d.getByRole('button', { name: 'Add to bag' }).click(); await d.getByText('Added to your bag.').waitFor();
  await d.goto(`${B}/checkout`); await d.waitForTimeout(500);
  await fillCheckout(d, { email: 'custom@example.com' });
  await d.getByText(/starts when you approve your proof/).first().waitFor();
  ok(await d.getByRole('button', { name: /^Pay ₦/ }).isDisabled(), 'C: pay is blocked until the final-sale box is ticked');
  await d.getByLabel(/I understand custom and personalised items are/).check();
  ok((await aside.innerText()).includes('₦30,500'), 'C: total = ₦22,000 tee + ₦5,000 design fee + ₦3,500 delivery = ₦30,500');
  await payMock(d);
  const oC = (await q(`select * from orders where has_custom order by created_at desc limit 1`))[0];
  ok(oC.status === 'awaiting_proof' && oC.promised_by === null && oC.production_start_at === null, 'C: custom order is awaiting_proof with no production start or promise');
  ok(/proof/i.test(await d.locator('main').innerText()), 'C: order page explains the proof step');
  ok((await q(`select status from custom_requests`))[0].status === 'awaiting_proof', 'C: custom request moved to awaiting_proof');

  // ===== D. tampering: change prices/quantities in the browser
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: 'S', exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  await d.keyboard.press('Escape');
  await d.evaluate(() => { const s = JSON.parse(localStorage.getItem('pemart-bag')); s.state.lines = s.state.lines.map(l => ({ ...l, price: 1, priceKobo: 1, unitKobo: 1, total: 1 })); localStorage.setItem('pemart-bag', JSON.stringify(s)); });
  await d.goto(`${B}/checkout`); await d.waitForTimeout(500); await fillCheckout(d, { email: 'tamper@example.com' });
  await d.getByText('Promised by').waitFor();
  ok((await aside.innerText()).includes('₦25,500'), 'D: tampered prices ignored: total is still ₦25,500');
  await payMock(d);
  ok(Number((await q(`select total_kobo from orders where contact_email='tamper@example.com'`))[0].total_kobo) === 2550000, 'D: DB charged ₦25,500 despite the tampered bag');

  // ===== G. ambassador code -> pending commission
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: 'L', exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  const dr = d.getByRole('dialog', { name: 'Your bag' }); await dr.getByLabel('Discount code').fill('GRACE10'); await dr.getByRole('button', { name: 'Apply' }).click();
  await dr.getByText(/GRACE10 applied/).waitFor(); await dr.getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/checkout/);
  await fillCheckout(d, { email: 'amb@example.com' }); await d.getByText('Promised by').waitFor(); await payMock(d);
  const com = await q(`select c.* from commissions c join orders o on o.id=c.order_id where o.contact_email='amb@example.com'`);
  ok(com.length === 1 && com[0].status === 'pending' && Number(com[0].amount_kobo) === 220000, 'G: ambassador code → one pending commission of ₦2,200');

  // ===== H. bag behaviour: upsell, quantity, free-delivery, remove, sold-out blocks checkout
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: 'XL', exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  const d3 = d.getByRole('dialog', { name: 'Your bag' }); await d3.getByLabel('Choose a style').selectOption({ label: 'Anchor' });
  await d3.getByRole('button', { name: 'Add', exact: true }).click(); await d3.getByText('Special offer price').waitFor();
  ok(await d3.getByText('₦4,500').first().isVisible(), 'H: upsell added at the special price ₦4,500');
  await d3.getByRole('link', { name: 'View full bag' }).click(); await d.waitForURL(/\/bag/);
  const inc = d.getByRole('group', { name: /Quantity for Seek First/ }).getByRole('button', { name: 'Increase quantity' }); await inc.click(); await d.waitForTimeout(400); await inc.click(); await d.waitForTimeout(700);
  ok(await d.getByText(/You have free delivery in Lagos|away from free delivery/).first().isVisible(), 'H: bag page progress updates with quantity');
  await q(`update product_variants set stock_qty = 0 where sku='FAITH-BRACELET-ANCHOR'`);
  await d.reload(); await d.waitForTimeout(1500);
  ok(await d.getByText('Sold out').first().isVisible() || await d.getByText(/Only \d+ left|no longer available/).first().isVisible(), 'H: sold-out item flagged in the bag');
  ok(await d.getByRole('button', { name: /Fix the items above/ }).isDisabled(), 'H: checkout blocked while an item is unavailable');
  await q(`update product_variants set stock_qty = 40 where sku='FAITH-BRACELET-ANCHOR'`);

  // ===== misc
  const unauth = await d.request.post(`${B}/api/webhooks/paystack`, { data: '{"event":"charge.success","data":{"reference":"x","amount":1}}', headers: { 'x-paystack-signature': 'bad' } });
  ok(unauth.status() === 401, 'webhook: bad signature rejected over HTTP');
  const cron = await d.request.get(`${B}/api/cron/expire`, { headers: { authorization: 'Bearer cron-secret' } }); ok(cron.status() === 200, 'cron: authorised call works');
  ok((await d.request.get(`${B}/api/cron/expire`)).status() === 401, 'cron: unauthenticated call rejected');
  const nf = await d.goto(`${B}/order/PM-10001?t=wrong`); ok(await d.getByText(/couldn't find that order/).isVisible(), 'order page: wrong token shows not-found, no data leak');

  // mobile checkout screenshot
  const m = await b.newContext({ ...devices['iPhone 13'] }); const mp = await m.newPage();
  await mp.goto(`${B}/products/seek-first-hoodie`); await mp.getByRole('button', { name: 'M', exact: true }).click(); await mp.getByRole('button', { name: 'Add to bag' }).first().click(); await mp.waitForTimeout(1200);
  await mp.screenshot({ path: 'test-results/shots/p4-m-drawer.png' });
  console.log('console errors:', JSON.stringify(errs.filter(e => !/40[0-9] |401|webpack|hydrat/i.test(e)).slice(0, 5)));
});
