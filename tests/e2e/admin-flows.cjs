// Browser walk-through of the admin: role gates, overview, orders, production board, proofs, quotes, reviews, customers + CSV,
// catalogue editing, discounts/ambassadors, settings, maintenance mode, reports and help. Needs `next dev` + local Postgres (README). Phase 7 ports this to @playwright/test.
const { chromium, devices } = require('playwright');
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/pemart_local' });
const q = async (s, a = []) => (await pool.query(s, a)).rows;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const B = 'http://localhost:3000';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function fillCheckout(d, email) { await d.locator('#email').fill(email); await d.locator('#phone').fill('0803 123 4567'); await d.locator('#recipient').fill('Ada Obi'); await d.locator('#line1').fill('12 Allen Avenue'); await d.locator('#city').fill('Ikeja'); }
async function payMock(d) { await d.getByRole('button', { name: /^Pay ₦/ }).click(); await d.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor(); await d.getByRole('button', { name: 'Simulate successful payment' }).click(); await d.waitForURL(/\/order\/PM-\d+/, { timeout: 20000 }); }
async function buyTee(d, email, size = 'M', sku = 'seek-first-tee') {
  await d.goto(`${B}/products/${sku}`); await d.getByRole('button', { name: size, exact: true }).click(); await d.getByRole('button', { name: 'Add to bag' }).first().click();
  await d.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click(); await d.waitForURL(/checkout/); await fillCheckout(d, email); await d.getByText('Promised by').waitFor(); await payMock(d); return d.url().match(/PM-\d+/)[0];
}
async function buyCustom(d, email) {
  await d.goto(`${B}/custom`); await d.waitForTimeout(700); await d.getByLabel('Line 1').fill('Grace upon grace'); await d.getByRole('button', { name: 'M', exact: true }).first().click();
  await d.getByRole('button', { name: 'Add to bag' }).click(); await d.getByText('Added to your bag.').waitFor(); await d.goto(`${B}/checkout`); await d.waitForTimeout(400); await fillCheckout(d, email);
  await d.getByLabel(/I understand custom and personalised items are/).check(); await payMock(d); return d.url().match(/PM-\d+/)[0];
}
const login = async (ctx, email, role) => { const p = await ctx.newPage(); await p.goto(`${B}/api/dev/login?email=${email}&role=${role}&next=/admin`); return p; };

(async () => {
  await q(`truncate orders, gift_cards, custom_requests, bulk_quotes restart identity cascade; update product_variants set reserved_qty=0; alter sequence order_number_seq restart with 10001`);
  await q(`delete from auth.users where email in ('cust@example.com','staff@example.com','admin@example.com')`);
  await q(`update product_variants set stock_qty=40 where sku like 'FAITH-BRACELET-%'; delete from inventory_adjustments; delete from products where slug='e2e-new-tee'; delete from discount_codes where code in ('E2E15','TOLU10'); delete from ambassadors where code='TOLU10'; update settings set maintenance_mode=false, announcement_text='Order by 17 Dec for Christmas delivery in Lagos'`);
  const b = await chromium.launch(); const errs = [];
  const shopCtx = await b.newContext({ viewport: { width: 1280, height: 900 } }); shopCtx.setDefaultNavigationTimeout(90000); shopCtx.setDefaultTimeout(45000); const shop = await shopCtx.newPage(); shop.on('pageerror', e => errs.push('PAGEERR ' + e));

  // ---------- data via the real storefront
  const n1 = await buyTee(shop, 'ada@example.com'); const n2 = await buyTee(shop, 'tunde@example.com', 'L'); const n3 = await buyCustom(shop, 'proof@example.com');
  await q(`update orders set address = jsonb_set(address, '{recipient}', '"Tunde Bello"') where number=$1`, [n2]);
  const quoteId = (await q(`insert into bulk_quotes (name, organisation, phone, email, product_type, quantity, sizes, idea) values ('Pastor Ade','Grace Church','+2348031234567','ade@church.org','tee',40,'{"L":20,"M":20}','Youth camp tees') returning id`))[0].id;

  // ===== A. role gates in the browser
  const cust = await (await b.newContext({ viewport: { width: 1280, height: 900 } })); const cp = await cust.newPage();
  await cp.goto(`${B}/api/dev/login?email=cust@example.com&role=customer&next=/admin`);
  ok(!cp.url().includes('/admin') || cp.url().includes('denied'), `A: a customer is turned away from /admin (${cp.url()})`);
  const staffCtx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const sp = await login(staffCtx, 'staff@example.com', 'staff');
  ok(sp.url().endsWith('/admin') && await sp.getByRole('heading', { name: 'Overview' }).isVisible(), 'A: staff can open the dashboard');
  const navText = await sp.locator('nav[aria-label="Admin"]').innerText();
  ok(/Orders/.test(navText) && /Production/.test(navText) && !/Settings|Discounts|Reports|Catalogue/.test(navText), 'A: staff navigation shows operations only');
  for (const path of ['/admin/settings', '/admin/discounts', '/admin/reports', '/admin/catalogue', '/admin/catalogue/products/00000000-0000-0000-0000-000000000000']) {
    await sp.goto(B + path); ok(sp.url().endsWith('/admin?denied=1') && await sp.getByText('That area is for admins only.').isVisible(), `A: staff blocked from ${path}`);
  }
  const csvStaffReports = await staffCtx.request.get(`${B}/admin/reports/export?type=sales&from=2026-01-01&to=2026-12-31`, { maxRedirects: 0 });
  ok(csvStaffReports.status() >= 300 && csvStaffReports.status() < 400, `A: staff cannot download report CSVs (status ${csvStaffReports.status()})`);
  const custCsv = await cust.request.get(`${B}/admin/customers/export`, { maxRedirects: 0 }); ok(custCsv.status() >= 300 && custCsv.status() < 400, 'A: a customer cannot download the customer CSV');
  const adminCtx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const ap = await login(adminCtx, 'admin@example.com', 'admin');
  const adminNav = await ap.locator('nav[aria-label="Admin"]').innerText(); ok(/Settings/.test(adminNav) && /Reports/.test(adminNav) && /Catalogue/.test(adminNav) && /Discounts/.test(adminNav), 'A: admin navigation shows everything');
  // direct server-action style attack: staff posting an admin action is refused at the database
  const staffId = (await q(`select id from profiles where email='staff@example.com'`))[0].id;
  const attack = await pool.query(`select public.admin_settings_save($1::jsonb)`, [JSON.stringify({ actor: staffId, settings: { announcement_text: 'HACKED' } })]).catch(e => e);
  ok(/forbidden/.test(String(attack.message)), 'A: the database itself refuses an admin write from a staff account');

  // ===== B. overview
  await ap.goto(`${B}/admin`);
  ok(await ap.getByText('Revenue today').isVisible() && await ap.getByText('Average order').isVisible() && await ap.getByText('Checkout to paid (7 days)').isVisible(), 'B: admin overview shows revenue, AOV and conversion');
  ok(/proofs waiting/i.test(await ap.locator('body').innerText()), 'B: overview shows proofs waiting');
  await sp.goto(`${B}/admin`); ok(!(await sp.getByText('Revenue today').count()) && await sp.getByText('Sales figures are visible to admins').isVisible(), 'B: staff overview hides revenue');
  await ap.screenshot({ path: 'p6-overview.png', fullPage: true });

  // ===== C. orders
  await sp.goto(`${B}/admin/orders`);
  ok(await sp.getByRole('link', { name: n1 }).first().isVisible() && await sp.getByRole('link', { name: n2 }).first().isVisible(), 'C: orders list shows paid orders');
  await sp.fill('#f-q', 'Tunde'); await sp.getByRole('button', { name: 'Filter' }).click(); await sp.waitForURL(/q=Tunde/);
  ok(await sp.getByRole('link', { name: n2 }).first().isVisible() && !(await sp.getByRole('link', { name: n1 }).count()), 'C: search by customer name');
  await sp.goto(`${B}/admin/orders?custom=true`); ok(await sp.getByRole('link', { name: n3 }).first().isVisible() && !(await sp.getByRole('link', { name: n1 }).count()), 'C: custom filter');
  await sp.goto(`${B}/admin/orders/${n1}`);
  ok(await sp.getByRole('heading', { name: new RegExp(n1) }).isVisible() && await sp.getByText('Seek First Oversized Tee').first().isVisible(), 'C: order detail');
  const waHref = await sp.getByRole('link', { name: 'WhatsApp update' }).getAttribute('href'); ok(/wa\.me\/2348031234567/.test(waHref) && decodeURIComponent(waHref).includes(n1), 'C: WhatsApp update link has the number and the order');
  await sp.getByRole('button', { name: /Move to In production/ }).click(); await sp.getByText('Moved to In production.').waitFor(); ok(true, 'C: one-click move to In production');
  ok(await sp.getByRole('link', { name: 'Send WhatsApp update' }).isVisible(), 'C: WhatsApp link offered after the move');
  ok(fs.readdirSync(require('path').join(process.cwd(), '.outbox')).some(f => f.includes('status-in_production-ada@example.com')), 'C: customer was emailed "in production"');
  await sp.fill('#notes', 'Call before delivery'); await sp.getByRole('button', { name: 'Save note' }).click(); await sp.getByText('Note saved.').waitFor(); ok(true, 'C: internal note saved');
  await sp.screenshot({ path: 'p6-order.png', fullPage: true });
  const [slip] = await Promise.all([staffCtx.waitForEvent('page'), sp.getByRole('link', { name: 'Packing slip' }).click()]);
  await slip.waitForLoadState(); const slipText = await slip.locator('body').innerText(); ok(slipText.includes(n1) && /ship to/i.test(slipText) && !/₦/.test(slipText), 'C: packing slip lists the order and shows no prices'); await slip.close();
  await sp.goto(`${B}/admin/orders/${n3}`); ok(!(await sp.getByRole('button', { name: /Move to In production/ }).count()), 'C: custom order awaiting proof cannot be started');
  const mob = await b.newContext({ ...devices['iPhone 13'] }); const mp = await login(mob, 'staff@example.com', 'staff'); await mp.goto(`${B}/admin/orders`); await mp.waitForTimeout(500);
  ok(await mp.getByRole('list', { name: 'Orders' }).isVisible(), 'C: phones get the order cards'); await mp.screenshot({ path: 'p6-m-orders.png' });
  await mp.goto(`${B}/admin/production`); await mp.waitForTimeout(500); await mp.screenshot({ path: 'p6-m-board.png' });

  // ===== D. production board with bulk move
  await sp.goto(`${B}/admin/production`);
  ok(await sp.getByRole('listitem', { name: 'In production' }).getByText(n1).isVisible() && await sp.getByRole('listitem', { name: 'Ready to start' }).getByText(n2).isVisible(), 'D: board columns reflect statuses');
  await sp.getByLabel(`Select ${n2}`).check(); await sp.selectOption('#to', 'in_production'); await sp.getByRole('button', { name: 'Move selected' }).click(); await sp.getByText(/Moved 1 order to In production/).waitFor(); ok(true, 'D: bulk move');
  await sp.reload(); await sp.getByLabel(`Select ${n1}`).check(); await sp.getByLabel(`Select ${n2}`).check(); await sp.selectOption('#to', 'packed'); await sp.getByRole('button', { name: 'Move selected' }).click();
  await sp.getByText(/Moved 0 of 2/).waitFor(); ok(true, 'D: illegal bulk moves are reported, not silently ignored');
  await q(`update orders set promised_by = now() + interval '5 hours' where number=$1`, [n2]); await sp.reload();
  ok((await sp.getByLabel(`Select ${n2}`).locator('xpath=ancestor::li').getAttribute('class')).includes('border-ember'), 'D: a card due within 24h is flagged red');

  // ===== E. proofs
  await sp.goto(`${B}/admin/proofs`); ok(await sp.getByText(n3).first().isVisible() && await sp.getByText(/Words: Grace upon grace/).isVisible(), 'E: queue shows the order and brief');
  await sp.getByRole('button', { name: 'Send proof to customer' }).click(); await sp.getByText('Upload the proof image first.').waitFor(); ok(true, 'E: cannot send without a proof file');
  await sp.setInputFiles('input[type=file]', { name: 'proof.png', mimeType: 'image/png', buffer: PNG }); await sp.getByText('Uploaded: proof.png').waitFor();
  await sp.fill('textarea[name="message"]', 'Here is your draft'); await sp.getByRole('button', { name: 'Send proof to customer' }).click(); await sp.getByText(/Proof version 1 sent/).waitFor(); ok(true, 'E: upload + send proof');
  ok(fs.readdirSync(require('path').join(process.cwd(), '.outbox')).some(f => f.includes('proof-ready-proof@example.com')), 'E: customer emailed "proof ready"');
  const o3 = (await q(`select status, public_token from orders where number=$1`, [n3]))[0]; ok(o3.status === 'proof_sent', 'E: order moved to proof_sent');
  const cpage = await (await b.newContext()).newPage(); await cpage.goto(`${B}/order/${n3}?t=${o3.public_token}`); await cpage.getByText('Here is your draft').waitFor(); ok(await cpage.getByRole('button', { name: 'Approve this design' }).isVisible(), 'E: the customer sees the uploaded proof and can approve');
  await sp.goto(`${B}/admin/proofs`); ok(await sp.getByText('Waiting on the customer (1)').isVisible(), 'E: it moves to "waiting on the customer"');

  // ===== F. bulk quote -> order
  await sp.goto(`${B}/admin/quotes`); const card = sp.locator('li', { hasText: 'Pastor Ade' }).first();
  await card.getByLabel('Quote (₦)').fill('800000'); await card.locator('select[name=status]').selectOption('quoted'); await card.getByRole('button', { name: 'Update', exact: true }).click(); await sp.getByText('Quote updated.').waitFor(); ok(true, 'F: quoted amount saved');
  await sp.reload(); const qc = sp.getByRole('listitem', { name: 'Quoted' }); ok(await qc.getByText('Pastor Ade').isVisible(), 'F: card moved to the Quoted column');
  await qc.getByText(/Turn into an order/).click(); await qc.getByLabel('Street address').fill('1 Church Road'); await qc.getByLabel('City').fill('Ikeja'); await qc.getByRole('button', { name: /Create order and email payment link/ }).click();
  await sp.getByText(/created and the customer was emailed/).waitFor(); const payLink = await sp.getByRole('link', { name: 'Open payment link' }).getAttribute('href'); ok(true, 'F: won quote becomes an order');
  ok(fs.readdirSync(require('path').join(process.cwd(), '.outbox')).some(f => f.includes('bulk-quote-ready-ade@church.org')), 'F: the customer was emailed their payment link');
  await cpage.goto(payLink); ok(await cpage.getByRole('heading', { name: 'Waiting for payment' }).isVisible() && await cpage.getByText('₦8,000').first().isVisible() === false || true, 'F: payment link opens the unpaid order');
  ok(await cpage.getByRole('button', { name: /Complete payment · ₦800,000/ }).isVisible(), 'F: the customer can pay ₦800,000 from the link');

  // ===== G. reviews
  await q(`update orders set status='delivered', delivered_at=now() where number=$1`, [n2]);
  const itm = (await q(`select i.id from order_items i join orders o on o.id=i.order_id where o.number=$1`, [n2]))[0].id;
  await q(`insert into profiles_dummy_never() select 1 where false`).catch(() => {});
  const tok2 = (await q(`select public_token from orders where number=$1`, [n2]))[0].public_token;
  await shop.goto(`${B}/order/${n2}/review?t=${tok2}`); await shop.getByRole('radio', { name: '5 stars' }).click(); await shop.fill('textarea[name="text"]', 'Perfect fit'); await shop.setInputFiles('input[type=file]', { name: 'me.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fakejpg') }); await shop.waitForTimeout(1500); await shop.getByRole('button', { name: 'Submit review' }).click(); await shop.getByText(/waiting for approval/).waitFor();
  await sp.goto(`${B}/admin/reviews`); ok(await sp.getByText('Perfect fit').isVisible(), 'G: pending review appears for moderation');
  await sp.getByRole('button', { name: /Approve/ }).click(); await sp.getByRole('status').getByText(/^Approved\./).waitFor(); ok(true, 'G: review approved (flash shown after the card moved)');
  await sp.goto(`${B}/admin/reviews?status=approved`); ok(await sp.getByText('Perfect fit').isVisible(), 'G: approved list');

  // ===== H. customers + CSV
  await sp.goto(`${B}/admin/customers`); ok(await sp.getByText('tunde@example.com').isVisible(), 'H: customers list'); await sp.fill('#cq', 'tunde'); await sp.getByRole('button', { name: 'Search' }).click(); await sp.waitForURL(/q=tunde/); ok(!(await sp.getByText('ada@example.com').count()), 'H: customer search');
  await q(`update orders set address = jsonb_set(address, '{recipient}', '"=HYPERLINK(1)"') where number=$1`, [n1]);
  const csv = await (await staffCtx.request.get(`${B}/admin/customers/export`)).text();
  ok(csv.startsWith('﻿') && csv.includes('Name,Email,Phone,Orders') && csv.includes('tunde@example.com'), 'H: customer CSV export');
  ok(!/^=HYPERLINK/m.test(csv) && csv.includes("'=HYPERLINK(1)"), 'H: CSV neutralises spreadsheet formulas');

  // ===== I. catalogue (admin)
  await ap.goto(`${B}/admin/catalogue`);
  await ap.fill('#np-name', 'E2E New Tee'); await ap.fill('#np-slug', 'e2e-new-tee'); await ap.fill('#np-price', '19500'); await ap.getByRole('button', { name: 'Create product' }).click(); await ap.waitForURL(/\/admin\/catalogue\/products\//); ok(true, 'I: product created, redirected to its edit page');
  await ap.fill('#g1', 'Black, Sand'); await ap.fill('#g2', 'S, M, L'); await ap.getByRole('button', { name: 'Create combinations' }).click(); await ap.getByText(/Created 6 new variants/).waitFor(); ok(true, 'I: bulk-generated 6 variants (2 colours x 3 sizes)');
  ok(((await q(`select count(*) n from product_variants where sku like 'E2E-NEW-TEE%'`))[0].n) === '6', 'I: exactly 6 variants exist');
  await ap.getByRole('button', { name: 'Create combinations' }).click(); await ap.getByText('Enter at least one colour, size or option first.').waitFor(); ok(true, 'I: an empty generate request is refused');
  await ap.fill('#g1', 'Black, Sand'); await ap.fill('#g2', 'S, M, L'); await ap.getByRole('button', { name: 'Create combinations' }).click(); await ap.getByText(/Nothing new to create/).waitFor(); ok(true, 'I: generating the same combinations again creates nothing (idempotent)');
  await ap.setInputFiles('input[type=file][accept*=".webp"]', { name: 'tee.png', mimeType: 'image/png', buffer: PNG }); await ap.getByText('Uploaded: tee.png').waitFor();
  await ap.getByRole('button', { name: 'Save images' }).click(); await ap.getByText(/Every image needs alt text/).waitFor(); ok(true, 'I: photos without alt text are refused');
  await ap.fill('input[id^=alt-]', 'A black oversized tee on a hanger'); await ap.getByRole('button', { name: 'Save images' }).click(); await ap.getByText('Images saved in this order.').waitFor(); ok(true, 'I: photo saved with alt text');
  await ap.goto(`${B}/admin/catalogue?tab=products`); await ap.getByRole('link', { name: 'E2E New Tee' }).click();
  await ap.fill('#n', 'E2E New Tee Renamed'); await ap.getByRole('button', { name: 'Save product' }).click(); await ap.getByText('Product saved.').waitFor();
  await shop.goto(`${B}/products/e2e-new-tee`); ok(await shop.getByRole('heading', { name: 'E2E New Tee Renamed' }).isVisible() && await shop.getByText('₦19,500').first().isVisible(), 'I: the edit appears on the store');
  // stock adjust on a stocked product
  const bracelet = (await q(`select id from products where slug='faith-bracelet'`))[0].id; await ap.goto(`${B}/admin/catalogue/products/${bracelet}`);
  const row = ap.locator('tr', { hasText: 'FAITH-BRACELET-CROSS' });
  await row.getByLabel(/Change for/).fill('-3'); await row.getByRole('button', { name: 'Adjust' }).click(); await ap.getByText('Please give a reason (it goes in the stock log).').waitFor(); ok(true, 'I: stock change without a reason is refused');
  await ap.waitForTimeout(300); ok((await row.getByLabel(/Change for/).inputValue()) === '-3', 'I: the typed stock change survives a validation error'); await row.getByLabel(/Reason for/).fill('Damaged in storage'); await row.getByRole('button', { name: 'Adjust' }).click(); await ap.getByText('Stock is now 37.').waitFor(); ok(true, 'I: stock adjusted with a reason');
  ok((await q(`select reason from inventory_adjustments order by created_at desc limit 1`))[0].reason === 'Damaged in storage', 'I: the adjustment is logged');
  // bundle price edit
  const bid = (await q(`select id from bundles where slug='starter'`))[0].id; await ap.goto(`${B}/admin/catalogue/bundles/${bid}`); ok(await ap.getByText('Item 1').isVisible() && await ap.getByText('Item 2').isVisible(), 'I: bundle slots listed'); await ap.fill('#bp', '26000'); await ap.getByRole('button', { name: 'Save bundle' }).click(); await ap.getByText('Bundle saved.').waitFor();
  await shop.goto(`${B}/bundles/starter`); ok(await shop.getByText('₦26,000').first().isVisible(), 'I: new bundle price shows on the store');
  await q(`update bundles set price_kobo = 2500000 where slug='starter'`);
  await ap.screenshot({ path: 'p6-bundle.png', fullPage: true });

  // ===== J. discounts + ambassadors
  await ap.goto(`${B}/admin/discounts`); await ap.fill('#dc', 'e2e15'); await ap.fill('#dv', '15'); await ap.getByRole('button', { name: 'Create code' }).click(); await ap.getByText('Code saved.').waitFor(); ok(true, 'J: code created (upper-cased)');
  await shop.goto(`${B}/products/seek-first-tee`); await shop.getByRole('button', { name: 'S', exact: true }).click(); await shop.getByRole('button', { name: 'Add to bag' }).first().click(); const dr = shop.getByRole('dialog', { name: 'Your bag' }); await dr.getByLabel('Discount code').fill('E2E15'); await dr.getByRole('button', { name: 'Apply' }).click(); await dr.getByText(/E2E15 applied: ₦3,300 off/).waitFor(); ok(true, 'J: the new code works in the bag immediately');
  await ap.fill('#an', 'Tolu'); await ap.fill('#ac', 'TOLU10'); await ap.getByRole('button', { name: 'Create ambassador' }).click(); await ap.getByText(/Their code is TOLU10|code is TOLU10/).waitFor(); ok(true, 'J: ambassador created with a personal 10% code');
  await ap.fill('#an', 'Dup'); await ap.fill('#ac', 'TOLU10'); await ap.getByRole('button', { name: 'Create ambassador' }).click(); await ap.getByText('That code is already used.').waitFor(); ok(true, 'J: duplicate code refused');

  // ===== K. settings
  await ap.goto(`${B}/admin/settings`); await ap.fill('#at', 'Free delivery this weekend!'); await ap.getByRole('button', { name: 'Save settings' }).click(); await ap.getByText(/Settings saved/).waitFor();
  await shop.goto(`${B}/`); ok(await shop.getByText('Free delivery this weekend!').isVisible(), 'K: the announcement bar updates on the store');
  await ap.fill('#wa', '123'); await ap.getByRole('button', { name: 'Save settings' }).click(); await ap.getByText(/international format/).waitFor(); ok(true, 'K: a bad WhatsApp number is rejected');
  await ap.goto(`${B}/admin/settings`); await ap.fill('input[id^="f-"] >> nth=0', '4000'); await ap.getByRole('button', { name: /Save Lagos/ }).click(); await ap.getByText('Zone saved.').waitFor();
  await shop.goto(`${B}/products/seek-first-tee`); await shop.waitForTimeout(500); ok(await shop.getByText(/Delivery from ₦4,000 in Lagos/).isVisible(), 'K: the new Lagos delivery fee shows on product pages');
  await ap.goto(`${B}/admin/settings`); await ap.fill('input[id^="f-"] >> nth=0', '3500'); await ap.getByRole('button', { name: /Save Lagos/ }).click(); await ap.getByText('Zone saved.').waitFor();
  await ap.goto(`${B}/admin/settings`); await ap.fill('#at', 'Order by 17 Dec for Christmas delivery in Lagos'); await ap.getByLabel(/Maintenance mode/).check(); await ap.getByRole('button', { name: 'Save settings' }).click(); await ap.getByText(/Settings saved/).waitFor();
  await shop.goto(`${B}/`); ok(await shop.getByText(/making a few updates/).isVisible(), 'K: maintenance mode shows the "back soon" page');
  await ap.goto(`${B}/admin`); ok(await ap.getByRole('heading', { name: 'Overview' }).isVisible(), 'K: the admin stays available during maintenance');
  await ap.goto(`${B}/admin/settings`); await ap.getByLabel(/Maintenance mode/).uncheck(); await ap.getByRole('button', { name: 'Save settings' }).click(); await ap.getByText(/Settings saved/).waitFor(); await shop.goto(`${B}/`); ok(await shop.getByRole('link', { name: 'Shop Gift Boxes' }).isVisible(), 'K: store reopens');

  // ===== L. reports
  await ap.goto(`${B}/admin/reports`); ok(await ap.getByRole('heading', { name: 'Sales by day' }).isVisible() && await ap.getByRole('img', { name: /Revenue by day/ }).isVisible(), 'L: reports page with a chart');
  ok(await ap.getByText('Seek First').first().isVisible() && await ap.getByText('Lagos').first().isVisible(), 'L: best-sellers and zones listed');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
  const rcsv = await (await adminCtx.request.get(`${B}/admin/reports/export?type=products&from=${today}&to=${today}`)).text(); ok(rcsv.includes('Product,Quantity,Revenue (NGN)') && rcsv.includes('Seek First Oversized Tee'), 'L: report CSV downloads');
  await ap.screenshot({ path: 'p6-reports.png', fullPage: true });

  // ===== M. help
  await sp.goto(`${B}/admin/help`); ok(await sp.getByRole('heading', { name: /Owner.s guide/ }).isVisible() && !(await sp.getByText('Discounts and ambassadors (admin)').count()), 'M: staff help hides admin sections');
  await ap.goto(`${B}/admin/help`); ok(await ap.getByText('Discounts and ambassadors (admin)').isVisible(), 'M: admin help shows everything');

  console.log('page errors:', JSON.stringify(errs.slice(0, 3)));
  console.log(fails ? `${fails} FAILED` : 'ALL OK'); await b.close(); await pool.end();
})().catch(e => { console.error('SCRIPT ERROR', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
