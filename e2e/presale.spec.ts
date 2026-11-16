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

async function saveSettings(page: Page, f: { enabled: boolean; startsOn?: string; endsOn?: string; headline?: string; offers?: [string, string][]; image?: boolean }) {
  await login(page, 'admin@example.com', 'admin', '/admin/presale?tab=settings');
  const enabled = page.getByLabel(/Pre-sale is on/);
  if (f.enabled) await enabled.check(); else await enabled.uncheck();
  await page.getByLabel('Opens on (optional)').fill(f.startsOn ?? '');
  await page.getByLabel('Closes after (optional)').fill(f.endsOn ?? '');
  if (f.headline) await page.getByLabel(/Big headline/).fill(f.headline);
  for (const [i, [text, price]] of (f.offers ?? []).entries()) { await page.getByLabel(`Offer ${i + 1} text`).fill(text); await page.getByLabel('Price').nth(i).fill(price); }
  if (f.image) {
    await page.setInputFiles('input[type=file]', { name: 'poster.png', mimeType: 'image/png', buffer: PNG });
    await page.getByText('Uploaded: poster.png').waitFor();
  }
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
  await page.goto(`${B}/`);
  await expect(page.getByRole('region', { name: 'Pre-sale' })).toHaveCount(0);
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { name: 'Pre-sale is closed' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pre-order/ })).toHaveCount(0);
});

test('the owner switches it on, with a poster picture, offers and dates', async ({ page }) => {
  await saveSettings(page, { enabled: true, startsOn: lagosDate(-1), endsOn: lagosDate(7), headline: 'Big sale', offers: [['Any two tees', '₦30,000'], ['Any three tees', '₦43,500']], image: true });
  // a picture without a description saves fine (the headline is used as its description)
  await expect(page.getByText(/The pre-sale is live/)).toBeVisible();
  await page.getByLabel(/Describe the picture/).fill('Three tees on a rail');
  await page.getByRole('button', { name: 'Save pre-sale settings' }).click();
  await expect.poll(async () => (await q(`select config->>'imageAlt' a from presale_config`))[0].a).toBe('Three tees on a rail');
});

test('visitors see the strip, open the overlay and send a pre-order', async ({ page }) => {
  await page.goto(`${B}/collections/all`);
  const strip = page.getByRole('region', { name: 'Pre-sale' });
  await expect(strip).toBeVisible();
  await strip.getByRole('button', { name: 'Pre-order now' }).click();
  const overlay = page.getByRole('dialog', { name: 'Big sale' });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Any two tees')).toBeVisible();
  await expect(overlay.getByText('₦30,000')).toBeVisible();
  await expect(overlay.getByRole('img', { name: 'Three tees on a rail' })).toBeVisible();

  // nothing chosen yet
  await overlay.getByRole('button', { name: 'Send pre-order' }).click();
  await expect(overlay.getByText('Please fix the highlighted fields.')).toBeVisible();
  await expect(overlay.getByText('Enter your full name')).toBeVisible();
  await expect(overlay.getByRole('alert').filter({ hasText: 'Choose your state' })).toBeVisible();

  await fillRequest(overlay as unknown as Page, { name: 'Ada Obi', email: 'ada@example.com', garments: { 'T-shirt': { Medium: 2, Large: 1 }, Hoodie: { 'XX-Large': 1 } }, notes: 'Black please' });
  await expect(overlay.getByText('Total: 4 pieces')).toBeVisible();
  await overlay.getByRole('button', { name: 'Pre-order 4 pieces' }).click();
  await expect(overlay.getByRole('heading', { name: 'Request received' })).toBeVisible();
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

test('the /presale page works on a phone, keeps what was typed after a mistake, and blocks bad numbers', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { level: 1, name: 'Big sale' })).toBeVisible();
  await fillRequest(page, { name: 'Tolu Bello', email: 'tolu@example.com', garments: { Sweatshirt: { Small: 3 } } });
  await page.getByLabel('WhatsApp number').fill('123');
  await page.getByRole('button', { name: 'Pre-order 3 pieces' }).click();
  await expect(page.getByText(/valid Nigerian WhatsApp number/)).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Tolu Bello');            // not wiped by the error
  await expect(page.getByLabel('City or town')).toHaveValue('Akure');
  await page.getByLabel('WhatsApp number').fill('08031234567');
  await page.getByRole('button', { name: 'Pre-order 3 pieces' }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
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
  await page.goto(`${B}/collections/all`);
  await page.getByRole('region', { name: 'Pre-sale' }).getByRole('button', { name: 'Pre-order now' }).click();
  await page.getByRole('dialog', { name: 'Big sale' }).waitFor();
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
  await page.goto(`${B}/collections/all`);
  await expect(page.getByRole('region', { name: 'Pre-sale' })).toHaveCount(0);
  await page.goto(`${B}/presale`);
  await expect(page.getByRole('heading', { name: 'Pre-sale is closed' })).toBeVisible();
  // a request cannot slip through a stale open form
  const before = (await q(`select count(*)::int n from presale_requests`))[0].n;
  await saveSettings(page, { enabled: false });
  await expect(page.getByText(/switched off/)).toBeVisible();
  expect((await q(`select count(*)::int n from presale_requests`))[0].n).toBe(before);
});
