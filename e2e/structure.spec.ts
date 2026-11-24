// The site is organised around the combo collections (homepage, menu, footer, couples hub), and the owner can choose the fonts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const c = await browser.newContext(); const page = await c.newPage();
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
  const [admin] = await q(`select id from profiles where role = 'admin' order by created_at limit 1`);
  await q(`update combo_components set is_active = true, archived_at = null where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame')`);
  await q(`update combo_collections set status = 'draft', published_snapshot = null, base_price_kobo = null`);
  await q(`update combo_collections set base_price_kobo = 4500000 where slug = 'behold'`);
  await q(`update combo_collections set base_price_kobo = 6000000 where slug = 'abide'`);
  await q(`update combo_collections set base_price_kobo = 8000000 where slug = 'behold-couples'`);
  for (const slug of ['behold', 'abide', 'behold-couples']) await q(`select public.admin_combo_publish(jsonb_build_object('actor', $1::uuid, 'id', (select id from combo_collections where slug = $2)))`, [admin.id, slug]);
  await expect.poll(async () => { const t = await (await page.request.get(`${B}/api/combos`)).text(); return t.includes('behold-couples') && t.includes('"slug":"abide"') && t.includes('"base_price_kobo":4500000'); }, { timeout: 150_000, intervals: [2000] }).toBe(true);
  await c.close();
});

async function storefront(page: Page, path = '/') { await page.goto(`${B}/?preview=1`); await page.goto(`${B}${path}`); }

test('homepage: the collections section shows the published collections and the Couples Collection', async ({ page }) => {
  await storefront(page);
  const sec = page.getByRole('region', { name: 'Choose Your Collection' });
  await expect(sec).toBeVisible();
  const names = await sec.locator('h3').allTextContents();
  expect(names).toEqual(['BEHOLD COLLECTION', 'ABIDE COLLECTION', 'Couples Collection']);        // THE DOER'S is not published yet, so it is not listed
  await expect(sec.getByRole('link', { name: /BEHOLD COLLECTION/ })).toHaveAttribute('href', '/combos/behold');
  await expect(sec.getByRole('link', { name: /Couples Collection/ })).toHaveAttribute('href', '/couples');
  await expect(sec.getByText(/From ₦45,000/)).toBeVisible();
  await expect(sec.getByText(/From ₦80,000/)).toBeVisible();                                   // the couples tile shows its own starting price
  const a = await new AxeBuilder({ page }).include('#combo-collections-title').withTags(WCAG).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});

test('the menu and the footer list the same collections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await storefront(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Collections' }).click();
  const panel = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['BEHOLD COLLECTION', 'ABIDE COLLECTION', 'Couples Collection']) await expect(panel.getByRole('link', { name }).first()).toBeVisible();
  const footer = page.getByRole('navigation', { name: 'Collections' });
  for (const name of ['BEHOLD COLLECTION', 'ABIDE COLLECTION', 'Couples Collection']) await expect(footer.getByRole('link', { name })).toBeVisible();
});

test('the Couples Collection page leads with the couples editions', async ({ page }) => {
  await storefront(page, '/couples');
  await expect(page.getByRole('heading', { level: 1, name: 'Couples Collection' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /FOR COUPLES/ })).toBeVisible();
  await expect(page.getByText('2 garments, one for each of you')).toBeVisible();
  await expect(page.getByText('From ₦80,000')).toBeVisible();
  await storefront(page, '/combos');
  await expect(page.getByRole('heading', { name: 'Couples Collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /BEHOLD COLLECTION/ })).toHaveCount(1);
});

test('the owner chooses the heading and paragraph fonts and the shop uses them', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/website`);
  await page.getByRole('button', { name: 'Brand & SEO', exact: true }).click();
  await page.getByLabel('Heading font').selectOption('oswald');
  await page.getByLabel('Paragraph font').selectOption('lora');
  await expect(page.getByTestId('sample-headingFont')).toHaveCSS('font-family', /Naira.*oswald/i);
  await expect(page.getByTestId('sample-bodyFont')).toHaveCSS('font-family', /Naira.*lora/i);
  // fonts that suit only headings are not offered for paragraphs, and the other way round
  await expect(page.getByLabel('Paragraph font').locator('option', { hasText: 'Anton' })).toHaveCount(0);
  await expect(page.getByLabel('Heading font').locator('option', { hasText: 'DM Sans' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText('Unpublished changes')).toHaveCount(0, { timeout: 30_000 });   // the page says so until the new version is live
  await expect(async () => {
    await storefront(page);
    const h = await page.locator('h2.display').first().evaluate((el) => getComputedStyle(el).fontFamily);
    const p = await page.locator('section p').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h).toMatch(/oswald/i); expect(p).toMatch(/lora/i);
  }).toPass({ timeout: 90_000 });
  // only the chosen fonts are downloaded
  const loaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.toLowerCase()); });
  expect(loaded.some((f) => /oswald/.test(f))).toBe(true);
  expect(loaded.some((f) => /playfair|poppins|montserrat/.test(f))).toBe(false);
  // back to the original look
  await page.goto(`${B}/admin/website`);
  await page.getByRole('button', { name: 'Brand & SEO', exact: true }).click();
  await page.getByLabel('Heading font').selectOption('default');
  await page.getByLabel('Paragraph font').selectOption('default');
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText('Unpublished changes')).toHaveCount(0, { timeout: 30_000 });   // the page says so until the new version is live
});
