// Garments: a sweatshirt of a word, Normal/Premium quality, and photos that follow the chosen colour.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const BLACK = '/brand/wear-the-word-logo-black.png', WHITE = '/brand/wear-the-word-logo-white.png';

test.beforeAll(async () => {
  await q(`delete from products where slug like 'e2e-word-%'`);
  const [d] = await q(`select id from designs order by name limit 1`);
  for (const [slug, name, type, quality] of [['e2e-word-sweatshirt', 'Through Christ Sweatshirt', 'sweatshirt', null], ['e2e-word-tee-premium', 'Through Christ Premium Tee', 'tee', 'premium'], ['e2e-word-tee-normal', 'Through Christ Normal Tee', 'tee', 'normal']] as const) {
    const [p] = await q(`insert into products (slug, name, type, quality, design_id, base_price_kobo, is_active, status, is_made_to_order) values ($1,$2,$3,$4,$5,1800000,true,'active',true) returning id`, [slug, name, type, quality, d.id]);
    for (const c of ['Black', 'White']) for (const s of ['M', 'L']) await q(`insert into product_variants (product_id, sku, colour, size, stock_qty) values ($1,$2,$3,$4,20)`, [p.id, `${slug}-${c}-${s}`.toUpperCase(), c, s]);
    await q(`insert into product_images (product_id, url, alt, view, sort_order, colour) values ($1,$2,'Black version','front',0,'Black'), ($1,$3,'White version','front',1,'White')`, [p.id, BLACK, WHITE]);
  }
});

/** Rows were inserted with SQL, so ask the admin to save a product once: that refreshes the storefront's catalogue cache, as a real edit does. */
async function refreshCatalogue(page: Page) {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/catalogue`);
  const [p] = await q(`select id from products where slug = 'e2e-word-sweatshirt'`);
  await page.goto(`${B}/admin/catalogue/products/${p.id}`);
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Product saved.')).toBeVisible();
  await expect.poll(async () => (await page.request.get(`${B}/products/e2e-word-sweatshirt`)).status(), { timeout: 60_000, intervals: [1500] }).toBe(200);
}
test.beforeEach(async ({ page }, info) => { if (info.title.startsWith('a sweatshirt product page')) await refreshCatalogue(page); });

test('a sweatshirt product page shows its photo for the chosen colour', async ({ page }) => {
  await page.goto(`${B}/products/e2e-word-sweatshirt`);
  await expect(page.getByRole('heading', { name: 'Through Christ Sweatshirt' })).toBeVisible();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await expect(page.getByAltText('White version').first()).toBeVisible();
  await expect(page.getByAltText('Black version')).toHaveCount(0);
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await expect(page.getByAltText('Black version').first()).toBeVisible();
  await expect(page.getByAltText('White version')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Size guide/i }).or(page.getByRole('button', { name: /Size guide/i })).first()).toBeVisible();
});

test('Normal and Premium tees are separate products and say so', async ({ page }) => {
  await page.goto(`${B}/products/e2e-word-tee-premium`);
  await expect(page.getByText('Premium quality')).toBeVisible();
  await page.goto(`${B}/products/e2e-word-tee-normal`);
  await expect(page.getByText('Normal quality')).toBeVisible();
  await page.goto(`${B}/products/e2e-word-sweatshirt`);
  await expect(page.getByText(/(Premium|Normal) quality/)).toHaveCount(0);
});

test('the shop can be filtered to sweatshirts and the menu lists them', async ({ page }) => {
  await page.goto(`${B}/collections/all?type=sweatshirt`);
  await expect(page.getByRole('link', { name: /Through Christ Sweatshirt/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Through Christ Premium Tee/ })).toHaveCount(0);
  await page.goto(`${B}/collections/all?type=tee`);
  await expect(page.getByText('Premium', { exact: true }).first()).toBeVisible(); // the card tag
});

test('a customer can buy the sweatshirt in the colour and size shown', async ({ page }) => {
  await page.goto(`${B}/products/e2e-word-sweatshirt`);
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Your bag' });
  await expect(drawer.getByText('Through Christ Sweatshirt')).toBeVisible();
  await expect(drawer.getByText('₦18,000').first()).toBeVisible();
});

test('admin: choose the type, quality and which colour each photo belongs to', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/catalogue`);
  const [p] = await q(`select id from products where slug = 'e2e-word-tee-normal'`);
  await page.goto(`${B}/admin/catalogue/products/${p.id}`);
  await expect(page.getByLabel('Type')).toBeVisible();
  await page.getByLabel('Quality (T-shirts)').selectOption('premium');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Product saved.')).toBeVisible();
  expect((await q(`select quality from products where slug = 'e2e-word-tee-normal'`))[0].quality).toBe('premium');
  await expect(page.getByLabel('Colour for image 1')).toHaveValue('Black');
  await page.getByLabel('Colour for image 2').selectOption('');
  await page.getByRole('button', { name: 'Save images' }).click();
  await expect(page.getByText('Images saved in this order.')).toBeVisible();
  expect((await q(`select colour from product_images where product_id = $1 order by sort_order`, [p.id])).map((r) => r.colour)).toEqual(['Black', null]);
  await q(`update products set quality = 'normal' where slug = 'e2e-word-tee-normal'`);
  const a = await new AxeBuilder({ page }).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});

test('product pages stay accessible', async ({ page }) => {
  await page.goto(`${B}/products/e2e-word-sweatshirt`);
  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});
