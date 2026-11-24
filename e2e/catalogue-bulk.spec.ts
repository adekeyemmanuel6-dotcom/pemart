// Catalogue: tick many products, set status / one price for all, delete archived ones.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { B, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const URL_ = `${B}/admin/catalogue?tab=products&q=e2e-bulk`;

test.beforeAll(async () => {
  await q(`delete from products where slug like 'e2e-bulk-%'`);
  for (const [slug, status, price] of [['e2e-bulk-draft-1', 'draft', 0], ['e2e-bulk-draft-2', 'draft', 0], ['e2e-bulk-draft-3', 'draft', 0], ['e2e-bulk-old-1', 'archived', 500000], ['e2e-bulk-old-2', 'archived', 500000]] as const)
    await q(`insert into products (slug, name, type, base_price_kobo, status) values ($1, $1, 'tee', $2, $3)`, [slug, price, status]);
});

test('select all shown, set one price on the drafts, set them active', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/catalogue`);
  await page.goto(URL_);
  const bulk = page.getByRole('region', { name: 'Bulk actions' });
  await expect(bulk.getByText('0', { exact: true })).toBeVisible();
  await page.getByLabel('Select all shown products').check();
  await expect(bulk.getByText(/of 5 shown selected/)).toContainText('5');
  await page.getByLabel('Select all shown products').uncheck();
  for (const n of ['e2e-bulk-draft-1', 'e2e-bulk-draft-2', 'e2e-bulk-draft-3']) await page.getByLabel(`Select ${n}`).check();
  await expect(bulk.getByText(/of 5 shown selected/)).toContainText('3');
  await bulk.getByLabel('Same price for selected (₦)').fill('18,000');
  await bulk.getByRole('button', { name: 'Set price' }).click();
  await expect(page.getByText('Price set on 3 products.')).toBeVisible();
  expect((await q(`select base_price_kobo::int p from products where slug like 'e2e-bulk-draft-%'`)).map((r) => r.p)).toEqual([1800000, 1800000, 1800000]);
  await expect(page.getByRole('row', { name: /e2e-bulk-draft-1/ })).toContainText('₦18,000');
  // zero or junk is refused, nothing changes
  await bulk.getByLabel('Same price for selected (₦)').fill('0');
  await bulk.getByRole('button', { name: 'Set price' }).click();
  await expect(page.getByText(/Enter a price above zero/)).toBeVisible();
  // status for the selection
  await page.getByLabel('Select e2e-bulk-draft-1').check();
  await bulk.getByLabel('Set status of selected').selectOption('active');
  await bulk.getByRole('button', { name: 'Set status' }).click();
  await expect(page.getByText(/products? set to active/)).toBeVisible();
  expect((await q(`select slug, status from products where slug like 'e2e-bulk-draft-%' order by slug`)).map((r) => r.status)).toEqual(['active', 'active', 'active']);
  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});

test('delete archived: only archived ones, only after confirming; active ones are never deleted', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/catalogue`);
  await page.goto(URL_);
  const bulk = page.getByRole('region', { name: 'Bulk actions' });
  await expect(bulk.getByRole('button', { name: /Delete/ })).toBeVisible();
  await expect(bulk.getByText('Select archived products to delete them.')).toBeVisible();
  // an active product ticked together with archived ones is ignored
  await page.getByLabel('Select e2e-bulk-draft-1').check();
  await page.getByLabel('Select e2e-bulk-old-1').check();
  await page.getByLabel('Select e2e-bulk-old-2').check();
  await expect(bulk.getByText(/2 archived selected/)).toBeVisible();
  await expect(bulk.getByText(/1 not archived: ignored/)).toBeVisible();
  // without the confirm box ticked nothing is deleted
  page.once('dialog', (d) => d.accept());
  await bulk.getByRole('button', { name: /Delete 2 archived/ }).click();
  await expect(page.getByText('Tick the box to confirm the permanent delete.')).toBeVisible();
  expect(await q(`select 1 from products where slug like 'e2e-bulk-old-%'`)).toHaveLength(2);
  await bulk.getByLabel('Yes, delete permanently').check();
  page.once('dialog', (d) => d.accept());
  await bulk.getByRole('button', { name: /Delete 2 archived/ }).click();
  await expect(page.getByText(/2 products deleted/)).toBeVisible();
  expect(await q(`select 1 from products where slug like 'e2e-bulk-old-%'`)).toHaveLength(0);
  expect(await q(`select 1 from products where slug = 'e2e-bulk-draft-1'`)).toHaveLength(1);
  await expect(page.getByRole('row', { name: /e2e-bulk-old-1/ })).toHaveCount(0);
});
