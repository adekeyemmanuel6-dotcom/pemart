// Word pages and "choose your word" in the combo calculator.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, fillCheckout, payMock, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const WORD = 'e2e-through-christ';

async function refreshCatalogue(page: Page) {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/catalogue`);
  const [p] = await q(`select id from products where slug = 'e2e-tc-hoodie'`);
  await page.goto(`${B}/admin/catalogue/products/${p.id}`);
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Product saved.')).toBeVisible();
  await expect.poll(async () => (await page.request.get(`${B}/words/${WORD}`)).status(), { timeout: 60_000, intervals: [1500] }).toBe(200);
}

test.beforeAll(async () => {
  await q(`delete from products where slug like 'e2e-tc-%'`);
  await q(`delete from designs where slug = $1`, [WORD]);
  const [d] = await q(`insert into designs (slug, name, story_or_verse, verse_reference, is_active) values ($1,'Through Christ That Strengthens Me','I can do all things through Christ who strengthens me.','Philippians 4:13',true) returning id`, [WORD]);
  for (const [slug, name, type, quality, price] of [['e2e-tc-tee-normal', 'Through Christ Normal Tee', 'tee', 'normal', 1200000], ['e2e-tc-tee-premium', 'Through Christ Premium Tee', 'tee', 'premium', 1800000], ['e2e-tc-sweatshirt', 'Through Christ Sweatshirt', 'sweatshirt', null, 2200000], ['e2e-tc-hoodie', 'Through Christ Hoodie', 'hoodie', null, 2800000]] as const) {
    const [p] = await q(`insert into products (slug, name, type, quality, design_id, base_price_kobo, is_active, status, is_made_to_order) values ($1,$2,$3,$4,$5,$6,true,'active',true) returning id`, [slug, name, type, quality, d.id, price]);
    for (const c of ['Black', 'White']) for (const s of ['M', 'L']) await q(`insert into product_variants (product_id, sku, colour, size, stock_qty) values ($1,$2,$3,$4,20)`, [p.id, `${slug}-${c}-${s}`.toUpperCase(), c, s]);
  }
});

test('the word page lists every garment of the word, T-shirts first with Normal before Premium', async ({ page }) => {
  await refreshCatalogue(page);
  await page.goto(`${B}/words/${WORD}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Through Christ That Strengthens Me' })).toBeVisible();
  await expect(page.getByText('Philippians 4:13').first()).toBeVisible();
  const headings = await page.locator('main h2').allTextContents();
  expect(headings.slice(0, 3)).toEqual(['T-shirts', 'Sweatshirts', 'Hoodies']);
  const tees = page.locator('#tee h3');
  await expect(tees).toHaveText(['Through Christ Normal Tee', 'Through Christ Premium Tee']);
  await expect(page.locator('#tee').getByText('Premium', { exact: true })).toBeVisible();
  const a = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});

test('from a word to a purchase: pick the garment, colour and size', async ({ page }) => {
  await page.goto(`${B}/words/${WORD}`);
  await page.getByRole('link', { name: /Through Christ Sweatshirt/ }).first().click();
  await expect(page).toHaveURL(/\/products\/e2e-tc-sweatshirt/);
  await expect(page.getByRole('link', { name: 'See this word in every garment' })).toBeVisible();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Your bag' }).getByText('Through Christ Sweatshirt')).toBeVisible();
});

test('/words lists the word with its garment count and lowest price; the sitemap includes both; an unknown word is a 404', async ({ page }) => {
  await page.goto(`${B}/words`);
  await expect(page.getByRole('link', { name: /Through Christ That Strengthens Me/ })).toBeVisible();
  await expect(page.getByText(/4 garments/)).toBeVisible();
  await expect(page.getByText(/from\s*₦12,000/)).toBeVisible();
  const map = await (await page.request.get(`${B}/sitemap.xml`)).text();
  expect(map).toContain('/words</loc>'); expect(map).toContain(`/words/${WORD}`);
  const a = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
  await page.goto(`${B}/words/not-a-word`);
  await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
});

test('the combo calculator lets the customer choose one of the words, keeps it to the paid order, and the price does not change', async ({ page }) => {
  // price + publish BEHOLD (a SQL publish; the public catalogue refreshes within a minute)
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
  const [admin] = await q(`select id from profiles where role = 'admin' order by created_at limit 1`);
  await q(`update delivery_zones set rate_verified = true, min_days = 3, max_days = 5`);
  await q(`update combo_components set is_active = true, archived_at = null where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame')`);
  await q(`update combo_collections set base_price_kobo = 4500000 where slug = 'behold'`);
  await q(`select public.admin_combo_publish(jsonb_build_object('actor', $1::uuid, 'id', (select id from combo_collections where slug = 'behold')))`, [admin.id]);
  await expect.poll(async () => (await (await page.request.get(`${B}/api/combos`)).text()).includes(WORD), { timeout: 120_000, intervals: [2000] }).toBe(true);

  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}/combos/behold`);
  const dlg = page.getByRole('dialog', { name: 'Build Your Combo' });
  await expect(async () => { await page.getByRole('button', { name: /Customize/ }).first().click(); await expect(dlg).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 40_000 });
  await dlg.locator('label', { hasText: /BEHOLD/ }).first().click();
  await dlg.locator('label', { hasText: /^Premium Cotton T-shirt$/ }).first().click();
  await dlg.getByLabel('Colour').first().selectOption({ index: 1 });
  await dlg.getByLabel('Size').first().selectOption({ index: 2 });
  await expect(dlg.getByTestId('combo-total')).toHaveText('₦45,000');
  await dlg.getByLabel('Word for the garment').selectOption({ label: 'Through Christ That Strengthens Me (Philippians 4:13)' });
  await dlg.getByLabel('Word for your frame').selectOption({ label: 'Through Christ That Strengthens Me (Philippians 4:13)' });
  await expect(dlg.getByTestId('combo-total')).toHaveText('₦45,000');
  const a = await new AxeBuilder({ page }).include('[role=dialog]').withTags(WCAG).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
  await dlg.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click();
  await page.waitForURL(/\/checkout/);
  await fillCheckout(page, 'ada@example.com', 'Lagos');
  await page.getByLabel(/I understand custom and personalised items are/).check();
  await payMock(page);
  const [item] = await q(`select selections from order_items where kind = 'combo'`);
  expect(JSON.stringify(item.selections)).toContain('Through Christ That Strengthens Me');
  await expect(page.getByText(/Word: Through Christ That Strengthens Me/).first()).toBeVisible();
});
