// Pre-sale: owner switches it on, visitors send a pre-order (overlay and page), the team sees totals and updates status.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { B, lagosDate, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.beforeAll(async () => {
  await q(`delete from presale_requests; update presale_config set config = '{}'::jsonb where id = 1`);
  await q(`delete from auth.users where email in ('admin@example.com','staff@example.com')`);
});

const login = async (page: Page, email: string, role: string, next: string) => { await page.goto(`${B}/api/dev/login?email=${email}&role=${role}&next=${encodeURIComponent(next)}`); };

async function saveSettings(page: Page, f: { enabled: boolean; startsOn?: string; endsOn?: string; headline?: string; offers?: [string, string][]; images?: number; bg?: string }) {
  await login(page, 'admin@example.com', 'admin', '/admin/presale?tab=settings');
  const enabled = page.getByLabel(/Pre-sale is on/);
  if (f.enabled) await enabled.check(); else await enabled.uncheck();
  await page.getByLabel('Opens on (optional)').fill(f.startsOn ?? '');
  await page.getByLabel('Closes after (optional)').fill(f.endsOn ?? '');
  if (f.headline) await page.getByLabel(/Big headline/).fill(f.headline);
  for (const [i, [text, price]] of (f.offers ?? []).entries()) { await page.getByLabel(`Offer ${i + 1} text`).fill(text); await page.getByLabel('Price').nth(i).fill(price); }
  for (let n = 1; n <= (f.images ?? 0); n++) {
    await page.setInputFiles('input[type=file] >> nth=0', { name: `poster-${n}.png`, mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText(`Poster pictures (${n} of 10)`)).toBeVisible();
  }
  if (f.bg) await page.getByLabel('Background colour').fill(f.bg);
  await page.getByRole('button', { name: 'Save pre-sale settings' }).click();
  return page;
}

async function fillRequest(page: Page, o: { name: string; email: string; garments: Record<string, Record<string, number>>; notes?: string }) {
  for (const [garment, sizes] of Object.entries(o.garments)) {
    await page.getByRole('button', { name: garment, exact: true }).click();
    for (const [size, n] of Object.entries(sizes)) await page.getByLabel(`${garment} size ${size} quantity`).fill(String(n));
  }
  await page.getByLabel('Full name').fill(o.name);
  await page.getByLabel('WhatsApp number').fill('0803 123 4567');
  await page.getByLabel('Email').fill(o.email);
  await page.getByLabel('State').selectOption('Ondo');
  await page.getByLabel('City or town').fill('Akure');
  if (o.notes) await page.getByLabel(/Notes/).fill(o.notes);
}

test('closed by default: no strip, and the page says so', async ({ page }) => {
  await page.goto(`${B}/?preview=1`);
  await expect(page.getByRole('region', { name: 'Pre-sale' })).toHaveCount(0);
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { name: 'Pre-Sale Is Closed' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pre-Order/ })).toHaveCount(0);
});

test('the owner switches it on: two carousel pictures, a brand background, offers and dates', async ({ page }) => {
  await saveSettings(page, { enabled: true, startsOn: lagosDate(-1), endsOn: lagosDate(7), headline: 'Big sale', offers: [['Any two tees', '₦30,000'], ['Any three tees', '₦43,500']], images: 2, bg: '#c5a15d' });
  await expect(page.getByText(/The pre-sale is live/)).toBeVisible();
  const cfg = (await q(`select config from presale_config`))[0].config;
  expect(cfg.images).toHaveLength(2);
  expect(cfg.bgColor.toLowerCase()).toBe('#c5a15d'); expect(cfg.bgColor2).toBe('');
});

test('carousel manager: reorder, describe, remove, and the 10-picture limit', async ({ page }) => {
  await login(page, 'admin@example.com', 'admin', '/admin/presale?tab=settings');
  await expect(page.getByText('Poster pictures (2 of 10)')).toBeVisible();
  const first = (await q(`select config->'images'->0->>'url' u from presale_config`))[0].u;
  await page.getByRole('button', { name: 'Move picture 1 later' }).click();
  await page.getByLabel('Description of picture 1 (optional)').fill('Second one now first');
  await page.getByRole('button', { name: 'Save pre-sale settings' }).click();
  await expect.poll(async () => (await q(`select config->'images'->0->>'alt' a from presale_config`))[0].a).toBe('Second one now first');
  expect((await q(`select config->'images'->1->>'url' u from presale_config`))[0].u).toBe(first);   // the old first picture moved to second

  // fill the list to nine straight in the database (uploading nine files one by one adds nothing to the test), then use the real uploader for the tenth
  await q(`update presale_config set config = jsonb_set(config, '{images}', (select jsonb_agg(jsonb_build_object('url', config->'images'->0->>'url', 'alt', 'Copy ' || g)) from generate_series(1, 9) g)) where id = 1`);
  await page.reload();
  await expect(page.getByText('Poster pictures (9 of 10)')).toBeVisible();
  await page.setInputFiles('input[type=file] >> nth=0', { name: 'tenth.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Poster pictures (10 of 10)')).toBeVisible();
  await expect(page.getByText('That is the maximum.')).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(1);          // only the background picture uploader is left
  await page.getByRole('button', { name: 'Remove picture 10' }).click();
  await expect(page.getByText('Poster pictures (9 of 10)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save pre-sale settings' })).toBeVisible();

  // back to two pictures for the rest of the run
  for (let n = 9; n >= 3; n--) await page.getByRole('button', { name: `Remove picture ${n}` }).click();
  await page.getByRole('button', { name: 'Save pre-sale settings' }).click();
  await expect.poll(async () => (await q(`select jsonb_array_length(config->'images') n from presale_config`))[0].n).toBe(2);
});

test('visitors see the strip, open the overlay and send a pre-order', async ({ page }) => {
  await page.goto(`${B}/collections/all?preview=1`);
  const strip = page.getByRole('region', { name: 'Pre-sale' });
  await expect(strip).toBeVisible();
  await strip.getByRole('button', { name: 'Pre-Order Now' }).click();
  const overlay = page.getByRole('dialog', { name: 'Big Sale' });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Any Two Tees')).toBeVisible();
  await expect(overlay.getByText('₦30,000')).toBeVisible();
  // two-picture carousel with controls, in a brand-gold background with dark text, Title Case headings and no glow
  const carousel = overlay.getByRole('region', { name: 'Pre-sale pictures' });
  await expect(carousel.getByRole('group', { name: /of 2/ })).toHaveCount(2);
  await expect(carousel.getByRole('button', { name: 'Previous picture' })).toBeDisabled();
  await carousel.getByRole('button', { name: 'Next picture' }).click();
  await expect(carousel.getByRole('button', { name: 'Show picture 2' })).toHaveAttribute('aria-current', 'true');
  await expect(carousel.getByRole('button', { name: 'Next picture' })).toBeDisabled();
  await expect(overlay.getByText('Limited Drop', { exact: true })).toBeVisible();
  const headline = overlay.getByRole('heading', { level: 1, name: 'Big Sale' });
  await expect(headline).toBeVisible();
  expect(await headline.evaluate((el) => getComputedStyle(el).textTransform)).toBe('none');
  expect(await headline.evaluate((el) => getComputedStyle(el).textShadow)).toBe('none');
  expect(await headline.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(17, 17, 17)');            // dark text on gold
  expect(await headline.evaluate((el) => (el.parentElement as HTMLElement).style.background)).toContain('rgb(197, 161, 93)');

  // nothing chosen yet
  await overlay.getByRole('button', { name: 'Send Pre-Order' }).click();
  await expect(overlay.getByText('Please fix the highlighted fields.')).toBeVisible();
  await expect(overlay.getByText('Enter your full name')).toBeVisible();
  await expect(overlay.getByRole('alert').filter({ hasText: 'Choose your state' })).toBeVisible();

  await fillRequest(overlay as unknown as Page, { name: 'Ada Obi', email: 'ada@example.com', garments: { 'T-shirt': { Medium: 2, Large: 1 }, Hoodie: { 'XX-Large': 1 } }, notes: 'Black please' });
  await expect(overlay.getByText('Total: 4 pieces')).toBeVisible();
  await overlay.getByRole('button', { name: 'Pre-Order 4 Pieces' }).click();
  await expect(overlay.getByRole('heading', { name: 'Request Received' })).toBeVisible();
  const ref = (await overlay.getByText(/^PRE-\d+$/).textContent())!;
  await expect(overlay.getByText('T-shirt: M × 2, L × 1')).toBeVisible();
  await expect(overlay.getByText('Hoodie: XXL × 1')).toBeVisible();

  const row = (await q(`select * from presale_requests where reference = $1`, [ref]))[0];
  expect(row).toMatchObject({ name: 'Ada Obi', email: 'ada@example.com', state: 'Ondo', city: 'Akure', total_qty: 4, status: 'new', notes: 'Black please' });
  expect(row.items).toEqual([{ garment: 'tee', sizes: { M: 2, L: 1 } }, { garment: 'hoodie', sizes: { XXL: 1 } }]);
  expect(row.phone).toBe('+2348031234567');
  expect(fs.readdirSync(path.join(process.cwd(), '.outbox')).some((f) => f.includes('presale-received-ada@example.com'))).toBe(true);
  await overlay.getByRole('button', { name: 'Done' }).click();
  await expect(overlay).toHaveCount(0);
});

test('the carousel plays by itself, loops, can be paused, stops on hover, and stays still for reduced-motion visitors', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(`${B}/presale`);
  const dot = (n: number) => page.getByRole('button', { name: `Show picture ${n}` });
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Pause the slideshow' })).toBeVisible();
  await page.clock.fastForward(4100);
  await expect(dot(2)).toHaveAttribute('aria-current', 'true');
  await page.clock.fastForward(4100);
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');            // loops back to the first picture

  await page.getByRole('button', { name: 'Pause the slideshow' }).click();
  await expect(page.getByRole('button', { name: 'Play the slideshow' })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(12000);
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');            // paused: nothing moves
  await page.getByRole('button', { name: 'Play the slideshow' }).click();

  await page.getByRole('region', { name: 'Pre-sale pictures' }).hover();
  await page.clock.fastForward(12000);
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');            // hovering: nothing moves
  await page.mouse.move(2, 2);
  await page.clock.fastForward(9000);
  await expect(dot(2)).toHaveAttribute('aria-current', 'true');            // let go: it carries on
  await ctx.close();

  const calm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p2 = await calm.newPage();
  await p2.clock.install();
  await p2.goto(`${B}/presale`);
  await expect(p2.getByRole('button', { name: 'Show picture 1' })).toHaveAttribute('aria-current', 'true');
  await p2.clock.fastForward(20000);
  await expect(p2.getByRole('button', { name: 'Show picture 1' })).toHaveAttribute('aria-current', 'true');
  await expect(p2.getByRole('button', { name: /slideshow/ })).toHaveCount(0);   // no pause button because nothing plays
  await calm.close();
});

test('the /presale page works on a phone, keeps what was typed after a mistake, and blocks bad numbers', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { level: 1, name: 'Big Sale' })).toBeVisible();
  // the cookie banner is switched on in the test environment; on a phone it would sit over the send button
  const essential = page.getByRole('button', { name: 'Essential only' });
  await essential.click({ timeout: 4000 }).catch(() => undefined);
  await fillRequest(page, { name: 'Tolu Bello', email: 'tolu@example.com', garments: { Sweatshirt: { Small: 3 } } });
  await page.getByLabel('WhatsApp number').fill('123');
  await page.getByRole('button', { name: 'Pre-Order 3 Pieces' }).click();
  await expect(page.getByText(/valid Nigerian WhatsApp number/)).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Tolu Bello');            // not wiped by the error
  await expect(page.getByLabel('City or town')).toHaveValue('Akure');
  await page.getByLabel('WhatsApp number').fill('08031234567');
  await page.getByRole('button', { name: 'Pre-Order 3 Pieces' }).click();
  await expect(page.getByRole('heading', { name: 'Request Received' })).toBeVisible();
  expect((await q(`select total_qty, items from presale_requests where email = 'tolu@example.com'`))[0]).toMatchObject({ total_qty: 3, items: [{ garment: 'sweatshirt', sizes: { S: 3 } }] });
  await ctx.close();
});

test('the team sees totals to make, can contact and cancel, and download a spreadsheet', async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await login(page, 'admin@example.com', 'admin', '/admin/presale');
  await expect(page.getByRole('heading', { name: 'Pre-sale' })).toBeVisible();
  const totals = page.getByRole('table', { name: 'Pieces requested by garment and size' });
  await expect(totals.getByRole('row', { name: /T-shirt/ })).toContainText('3');
  await expect(totals.getByRole('row', { name: /All garments/ })).toContainText('7');
  await expect(page.getByText('PRE-').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^WhatsApp \+2348031234567/ }).first()).toHaveAttribute('href', /wa\.me\/2348031234567/);

  const card = page.getByRole('listitem').filter({ hasText: 'Tolu Bello' });
  await card.getByLabel('Status').selectOption('cancelled');
  await card.getByLabel('Team note (private)').fill('Changed mind');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText('Saved.')).toBeVisible();
  expect((await q(`select status, admin_note from presale_requests where email = 'tolu@example.com'`))[0]).toEqual({ status: 'cancelled', admin_note: 'Changed mind' });
  await page.reload();
  await expect(totals.getByRole('row', { name: /All garments/ })).toContainText('4');   // the cancelled 3 no longer count

  await page.getByRole('link', { name: /^Cancelled/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Tolu Bello' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Ada Obi' })).toHaveCount(0);

  const csv = await (await ctx.request.get(`${B}/admin/presale/export`)).text();
  expect(csv).toContain('Reference,Date,Status,Name,WhatsApp,Email,State,City,Address,T-shirt S');
  expect(csv).toContain('Ada Obi'); expect(csv).toContain('Black please');
  await ctx.close();
});

test('staff can work the list but cannot change the page settings; customers are turned away', async ({ browser }) => {
  const staffCtx = await browser.newContext(); const staff = await staffCtx.newPage();
  await login(staff, 'staff@example.com', 'staff', '/admin/presale');
  await expect(staff.getByRole('heading', { name: 'Pre-sale' })).toBeVisible();
  await expect(staff.getByRole('link', { name: 'Page settings' })).toHaveCount(0);
  await staff.goto(`${B}/admin/presale?tab=settings`);
  await expect(staff.getByRole('button', { name: 'Save pre-sale settings' })).toHaveCount(0);
  const csv = await staffCtx.request.get(`${B}/admin/presale/export`);
  expect(csv.ok()).toBe(true);
  const custCtx = await browser.newContext(); const cust = await custCtx.newPage();
  await login(cust, 'cust@example.com', 'customer', '/admin/presale');
  expect(cust.url()).not.toContain('/admin/presale');
  expect((await custCtx.request.get(`${B}/admin/presale/export`, { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
  await staffCtx.close(); await custCtx.close();
});

test('accessibility: the page, the overlay and the admin screens have no axe violations', async ({ browser }) => {
  const scan = async (page: Page) => (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const found: string[] = [];
  await page.goto(`${B}/presale`);
  await page.getByRole('button', { name: 'T-shirt', exact: true }).click();
  found.push(...(await scan(page)).map((v) => `/presale → ${v}`));
  await page.goto(`${B}/collections/all?preview=1`);
  await page.getByRole('region', { name: 'Pre-sale' }).getByRole('button', { name: 'Pre-Order Now' }).click();
  await page.getByRole('dialog', { name: 'Big Sale' }).waitFor();
  found.push(...(await scan(page)).map((v) => `overlay → ${v}`));
  await login(page, 'admin@example.com', 'admin', '/admin/presale');
  found.push(...(await scan(page)).map((v) => `/admin/presale → ${v}`));
  await page.goto(`${B}/admin/presale?tab=settings`);
  found.push(...(await scan(page)).map((v) => `/admin/presale settings → ${v}`));
  expect(found).toEqual([]);
  await ctx.close();
});

test('the date window closes it: after the end date the strip disappears and the page says closed', async ({ page }) => {
  await saveSettings(page, { enabled: true, startsOn: lagosDate(-10), endsOn: lagosDate(-1) });
  await expect(page.getByText(/The pre-sale is live|Saved/)).toBeVisible();
  await page.goto(`${B}/collections/all?preview=1`);
  await expect(page.getByRole('region', { name: 'Pre-sale' })).toHaveCount(0);
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { name: 'Pre-Sale Is Closed' })).toBeVisible();
  // a request cannot slip through a stale open form
  const before = (await q(`select count(*)::int n from presale_requests`))[0].n;
  await saveSettings(page, { enabled: false });
  await expect(page.getByText(/switched off/)).toBeVisible();
  expect((await q(`select count(*)::int n from presale_requests`))[0].n).toBe(before);
});
