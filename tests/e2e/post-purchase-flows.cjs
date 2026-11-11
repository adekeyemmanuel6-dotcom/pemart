// Browser walk-through of tracking, the proof round trip (incl. the paid extra revision), resuming payment, reviews + store credit,
// the account area and the role gates. Needs `next dev` + local Postgres + PAYSTACK_MOCK=1 (see README). Phase 7 converts this to @playwright/test.
const { chromium, devices } = require('playwright');
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/pemart_local' });
const q = async (s, a = []) => (await pool.query(s, a)).rows;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const B = 'http://localhost:3000';
const staffRpc = async (fn, arg) => (await q(`select public.${fn}($1::jsonb) r`, [JSON.stringify(arg)]))[0].r;

async function fillCheckout(d, email) {
  await d.locator('#email').fill(email); await d.locator('#phone').fill('0803 123 4567');
  await d.locator('#recipient').fill('Ada Obi'); await d.locator('#line1').fill('12 Allen Avenue'); await d.locator('#city').fill('Ikeja');
}
async function payMock(d) {
  await d.getByRole('button', { name: /^Pay ₦/ }).click();
  await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
  await d.getByRole('button', { name: 'Simulate successful payment' }).click();
  await d.waitForURL(/\/order\/PM-\d+/, { timeout: 20000 });
}
async function buyTee(d, email, size = 'M') {
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: size, exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  await d.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/checkout/);
  await fillCheckout(d, email); await d.getByText('Promised by').waitFor(); await payMock(d);
  return d.url().match(/PM-\d+/)[0];
}
async function buyCustom(d, email, words = 'Grace upon grace') {
  await d.goto(`${B}/custom`); await d.waitForTimeout(700);
  await d.getByLabel('Line 1').fill(words); await d.getByRole('button', { name: 'M', exact: true }).first().click();
  await d.getByRole('button', { name: 'Add to bag' }).click(); await d.getByText('Added to your bag.').waitFor();
  await d.goto(`${B}/checkout`); await d.waitForTimeout(400); await fillCheckout(d, email);
  await d.getByLabel(/I understand custom and personalised items are/).check(); await payMock(d);
  return d.url().match(/PM-\d+/)[0];
}

(async () => {
  await q(`truncate orders, gift_cards, custom_requests restart identity cascade; delete from auth.users; update product_variants set reserved_qty=0; alter sequence order_number_seq restart with 10001`);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const d = await ctx.newPage(); const errs = [];
  d.on('console', m => m.type() === 'error' && errs.push(m.text())); d.on('pageerror', e => errs.push('PAGEERR ' + e));

  // ===== 1. guest tracking
  const n1 = await buyTee(d, 'ada@example.com');
  await d.goto(`${B}/track`);
  await d.fill('#number', n1); await d.fill('#contact', 'wrong@example.com'); await d.getByRole('button', { name: 'Track my order' }).click();
  await d.getByText(/couldn't find an order with those details/).waitFor(); ok(true, '1: wrong contact → generic "not found" message');
  ok((await d.inputValue('#number')) === n1, '1: the number the visitor typed is kept after an error');
  await d.fill('#contact', '08031234567'); await d.getByRole('button', { name: 'Track my order' }).click();
  await d.waitForURL(/\/order\/PM-\d+\?t=/); ok(await d.getByRole('heading', { name: /Your order is in/ }).isVisible(), '1: phone + number → order page (no login)');
  await d.goto(`${B}/track`); await d.fill('#number', 'pm10001'); await d.fill('#contact', 'ADA@example.com'); await d.getByRole('button', { name: 'Track my order' }).click();
  await d.waitForURL(/\/order\/PM-10001/); ok(true, '1: lower-case number without dash and upper-case email still work');
  await d.screenshot({ path: 'p5-track.png' });

  // ===== 2. proof round trip as a guest with the private link
  const n2 = await buyCustom(d, 'proof@example.com');
  const orderUrl = d.url();
  ok(/design proof/i.test(await d.locator('main').innerText()) && await d.getByText(/preparing your first proof/i).isVisible(), '2: order page says the first proof is being prepared');
  const cr = (await q(`select c.id from custom_requests c join order_items i on i.custom_request_id=c.id join orders o on o.id=i.order_id where o.number=$1`, [n2]))[0].id;
  await staffRpc('proof_send', { custom_request_id: cr, path: '/designs/seek-first-card.svg', message: 'Here is your first draft' });
  await d.reload(); await d.getByRole('button', { name: 'Approve this design' }).waitFor();
  ok(await d.getByText('Here is your first draft').isVisible() && await d.getByText('Needs your answer').isVisible(), '2: proof appears with the designer message');
  await d.screenshot({ path: 'p5-proof.png', fullPage: true });
  await d.getByRole('button', { name: 'Request changes' }).click(); await d.getByText(/Please tell us what to change|Something went wrong/).waitFor({ timeout: 8000 }).catch(() => {});
  ok(await d.getByText(/tell us what to change/i).first().isVisible(), '2: requesting changes needs a note');
  await d.fill('textarea[name="note"]', 'Make the text bigger'); await d.getByRole('button', { name: 'Request changes' }).click();
  await d.getByText("Thanks. We'll send a new proof soon.").waitFor(); ok(true, '2: revision requested');
  let o = (await q(`select * from orders where number=$1`, [n2]))[0];
  ok(o.status === 'revision_requested' && o.promised_by === null, '2: order is revision_requested with no promise yet');
  await staffRpc('proof_send', { custom_request_id: cr, path: '/designs/glory-highest-card.svg', message: 'Bigger now' });
  await d.reload(); await d.getByText('Proof version 2', { exact: false }).first().waitFor(); ok(true, '2: version 2 shown');
  await d.getByRole('button', { name: 'Approve this design' }).click(); await d.locator('[role=status]').getByText('Approved. Your 5-day delivery clock has started.').waitFor();
  o = (await q(`select * from orders where number=$1`, [n2]))[0];
  ok(o.status === 'approved' && o.production_start_at && Math.abs((new Date(o.promised_by) - new Date(o.production_start_at)) / 86400000 - 5) < 0.01, '2: approval starts the clock; promised_by = +5 days');
  await d.reload(); ok(await d.getByText('You approved this design.').isVisible() && await d.getByText(/Arriving by/).isVisible(), '2: order page now shows the promised date');

  // ===== 3. free revision used → buy an extra revision (paid add-on)
  const n3 = await buyCustom(d, 'rev@example.com', 'Be bold');
  const cr3 = (await q(`select c.id from custom_requests c join order_items i on i.custom_request_id=c.id join orders o on o.id=i.order_id where o.number=$1`, [n3]))[0].id;
  const url3 = d.url();
  await staffRpc('proof_send', { custom_request_id: cr3, path: '/designs/seek-first-card.svg' });
  await d.reload(); await d.fill('textarea[name="note"]', 'Change one'); await d.getByRole('button', { name: 'Request changes' }).click(); await d.getByText("Thanks. We'll send a new proof soon.").waitFor();
  await staffRpc('proof_send', { custom_request_id: cr3, path: '/designs/seek-first-card.svg' });
  await d.reload(); await d.getByText(/extra revision: ₦2,000/).waitFor(); ok(true, '3: label shows the extra revision price once the free one is used');
  await d.fill('textarea[name="note"]', 'Change two'); await d.getByRole('button', { name: 'Request changes' }).click();
  await d.getByRole('button', { name: /Buy an extra revision/ }).waitFor(); ok(true, '3: second revision offers the paid add-on');
  await d.getByRole('button', { name: /Buy an extra revision/ }).click(); await d.waitForURL(/checkout/);
  await d.locator('#email').fill('rev@example.com'); await d.locator('#phone').fill('0803 123 4567');
  await d.getByRole('button', { name: /^Pay ₦2,000/ }).waitFor();
  ok(!(await d.locator('#line1').count()), '3: the add-on needs no delivery address');
  ok((await d.locator('aside[aria-label="Review and pay"]').innerText()).includes('₦2,000'), '3: add-on costs ₦2,000');
  await payMock(d);
  ok((await q(`select revisions_paid from custom_requests where id=$1`, [cr3]))[0].revisions_paid === 1, '3: paying grants one more revision');
  await d.goto(url3); await d.fill('textarea[name="note"]', 'Change two'); await d.getByRole('button', { name: 'Request changes' }).click(); await d.getByText("Thanks. We'll send a new proof soon.").waitFor(); ok(true, '3: the extra revision works');

  // ===== 4. resume an unpaid order
  await d.goto(`${B}/products/seek-first-tee`); await d.getByRole('button', { name: 'L', exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  await d.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/checkout/);
  await fillCheckout(d, 'later@example.com'); await d.getByText('Promised by').waitFor();
  await d.getByRole('button', { name: /^Pay ₦/ }).click(); await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor(); await d.getByRole('button', { name: 'Cancel' }).click();
  await d.getByText(/Payment was not completed/).waitFor(); ok(true, '4: cancelling the popup keeps the order saved');
  const pend = (await q(`select number, public_token from orders where contact_email='later@example.com'`))[0];
  await d.goto(`${B}/order/${pend.number}?t=${pend.public_token}`);
  ok(await d.getByRole('heading', { name: 'Waiting for payment' }).isVisible(), '4: order page shows it is waiting for payment');
  await d.getByRole('button', { name: /Complete payment/ }).click(); await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
  await d.getByRole('button', { name: 'Simulate successful payment' }).click(); await d.getByRole('heading', { name: /Your order is in/ }).waitFor({ timeout: 15000 });
  ok((await q(`select status from orders where number=$1`, [pend.number]))[0].status === 'paid', '4: resumed payment completes the order');

  // ===== 5. reminders cron
  await q(`update orders set created_at = now() - interval '2 hours' where number=$1`, [(await q(`insert into orders (contact_email, contact_phone, status, subtotal_kobo, total_kobo, address, expires_at) values ('abandon@example.com','+2348031234567','pending_payment',100,100,'{"recipient":"A","line1":"x","city":"c","state":"Lagos"}', now() + interval '10 hours') returning number`))[0].number]);
  const noauth = await d.request.get(`${B}/api/cron/reminders`); ok(noauth.status() === 401, '5: reminders cron rejects requests without the secret');
  const cron = await (await d.request.get(`${B}/api/cron/reminders`, { headers: { authorization: 'Bearer cron-secret' } })).json();
  ok(cron.ok && cron.abandoned === 1, `5: abandoned-checkout reminder sent (${JSON.stringify(cron)})`);
  ok(fs.readdirSync(require('path').join(process.cwd(), '.outbox')).some(f => f.includes('abandoned-checkout-abandon@example.com')), '5: the reminder email was produced');
  ok(fs.readdirSync(require('path').join(process.cwd(), '.outbox')).some(f => f.includes('order-confirmation-proof@example.com')), '5: order confirmation email for the custom order exists');

  // ===== 6. signed-in account (dev login)
  const a = await ctx.newPage(); a.on('pageerror', e => errs.push('PAGEERR ' + e));
  const lo = await a.goto(`${B}/account`); ok(a.url().includes('/auth/sign-in'), '6: /account redirects signed-out visitors to sign-in');
  await a.goto(`${B}/api/dev/login?email=ada@example.com&next=/account`);
  ok(await a.getByRole('heading', { name: /^Hi/ }).isVisible(), '6: dev login lands on the account page');
  ok(await a.getByText(n1).first().isVisible(), '6: order placed as a guest with the same email shows in the account');
  ok(!(await a.locator('main').innerText()).includes(n2), "6: someone else's order does not appear");
  // address
  await a.getByRole('button', { name: 'Add an address' }).click();
  await a.fill('#a-recipient', 'Ada Obi'); await a.fill('#a-phone', '0803 123 4567'); await a.fill('#a-line1', '12 Allen Avenue'); await a.fill('#a-city', 'Ikeja');
  await a.getByRole('button', { name: 'Save address' }).click(); await a.getByText('12 Allen Avenue').first().waitFor();
  ok(await a.getByText('Default').first().isVisible(), '6: first address becomes the default');
  await a.getByRole('button', { name: 'Add an address' }).click(); await a.fill('#a-recipient', 'Tunde'); await a.fill('#a-phone', 'bad'); await a.fill('#a-line1', '3 Road'); await a.fill('#a-city', 'Abeokuta');
  await a.getByRole('button', { name: 'Save address' }).click(); await a.getByText('Enter a valid Nigerian phone number').first().waitFor(); ok(true, '6: address phone is validated');
  await a.fill('#a-phone', '0803 123 4567'); await a.selectOption('#a-state', 'Ogun'); await a.getByRole('button', { name: 'Save address' }).click(); await a.getByText('3 Road').first().waitFor(); ok(true, '6: second address saved (Ogun zone)');
  // wishlist
  await a.goto(`${B}/products/seek-first-tee`); await a.getByRole('button', { name: 'Save to wishlist' }).click(); await a.getByRole('button', { name: 'Remove from wishlist' }).waitFor();
  await a.goto(`${B}/account`); ok(await a.getByRole('heading', { name: 'Seek First Oversized Tee' }).isVisible(), '6: wishlisted product appears in the account');
  // profile
  await a.fill('#p-name', 'Ada Obi'); await a.getByRole('button', { name: 'Save', exact: true }).click(); await a.getByText('Saved.').waitFor(); ok(true, '6: profile saved');
  // review + credit
  await q(`update orders set status='delivered', delivered_at=now() where number=$1`, [n1]);
  await a.goto(`${B}/account`); await a.getByRole('link', { name: 'Leave a review' }).first().click();
  await a.getByRole('radio', { name: '5 stars' }).click(); await a.fill('textarea[name="text"]', 'Great fit'); await a.setInputFiles('input[type=file]', { name: 'me.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fakejpg') });
  await a.getByText(/Demo mode/).waitFor({ timeout: 10000 }).catch(() => {});
  await a.getByRole('button', { name: 'Submit review' }).click(); await a.getByText(/store credit is added once it is approved/).waitFor(); ok(true, '6: photo review submitted (pending)');
  const rv = (await q(`select id, status, photo_urls from reviews`))[0]; ok(rv.status === 'pending' && rv.photo_urls.length === 1, '6: review is pending with its photo');
  const pubBefore = (await q(`select count(*) n from reviews where status='approved'`))[0].n; ok(pubBefore === '0', '6: pending review is not public');
  const mod = await staffRpc('review_moderate', { review_id: rv.id, decision: 'approve' }); ok(mod.credit_granted === true, '6: approving the photo review grants credit');
  await a.goto(`${B}/account`); ok(await a.getByLabel('Store credit ₦2,000').isVisible(), '6: account shows ₦2,000 store credit');
  await a.screenshot({ path: 'p5-account.png', fullPage: true });

  // ===== 7. role gates
  await a.goto(`${B}/admin`); ok(!a.url().includes('/admin') || a.url().includes('denied'), `7: a customer cannot open /admin (${a.url()})`);
  await a.goto(`${B}/api/dev/login?email=staff@example.com&role=staff&next=/admin`); ok(a.url().endsWith('/admin') && await a.getByRole('heading', { name: 'Overview' }).isVisible(), '7: staff can open /admin');
  await a.goto(`${B}/api/dev/login?logout=1`);
  // dev login is not available outside dev mode
  ok((await a.request.get(`${B}/api/dev/login?email=x@y.z`, { maxRedirects: 0 })).status() !== 404, '(dev login exists in dev mode)');

  console.log('console errors:', JSON.stringify(errs.filter(e => !/40[0-9] |401|webpack|hydrat|Failed to load resource/i.test(e)).slice(0, 5)));
  console.log(fails ? `${fails} FAILED` : 'ALL OK'); await b.close(); await pool.end();
})().catch(e => { console.error('SCRIPT ERROR', e.message.split('\n').slice(0, 7).join('\n')); process.exit(1); });
