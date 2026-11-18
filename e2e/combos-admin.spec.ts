// Combo Management: owner sets prices from nothing, publishes, edits, unpublishes. Drafts are never public.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const login = async (page: Page, role: string, next: string) => { await page.goto(`${B}/api/dev/login?email=${role}@example.com&role=${role}&next=${encodeURIComponent(next)}`); };

test.beforeAll(async () => {
  await q(`update combo_collections set status = 'draft', published_snapshot = null, published_at = null, base_price_kobo = null; delete from combo_price_rules`);
});

test('list shows seeded drafts without prices; page passes axe', async ({ page }) => {
  await login(page, 'admin', '/admin/combos');
  await expect(page.getByRole('heading', { name: 'Combo Management' })).toBeVisible();
  for (const n of ['Behold', 'Abide', 'The Doer']) await expect(page.getByRole('heading', { name: new RegExp(n, 'i') }).first()).toBeVisible();
  await expect(page.getByText('No price set').first()).toBeVisible();
  const a = await new AxeBuilder({ page }).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
});

test('owner prices BEHOLD, previews, publishes; customers see it only after', async ({ page }) => {
  await login(page, 'admin', '/admin/combos');
  await page.getByRole('link', { name: /Behold/i }).first().click();
  await page.getByRole('button', { name: '3. Selling prices' }).click();
  await page.getByLabel('Selling price (₦)').fill('45000');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Draft saved/)).toBeVisible();
  const before = await (await page.request.get(`${B}/api/combos`)).json();
  expect(JSON.stringify(before)).not.toContain('"slug":"behold"');
  await page.getByRole('button', { name: /Preview & publish/ }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText(/Published\. Customers can now/)).toBeVisible();
  const after = await (await page.request.get(`${B}/api/combos`)).json();
  const text = JSON.stringify(after);
  expect(text).toContain('"slug":"behold"');
  expect(text).not.toMatch(/internal_cost|overheads/);
});

test('owner sees the private costs tab', async ({ page }) => {
  await login(page, 'admin', '/admin/combos');
  await page.getByRole('link', { name: /Behold/i }).first().click();
  await expect(page.getByRole('button', { name: /Costs & profit/ })).toBeVisible();
  await page.getByRole('button', { name: /Costs & profit/ }).click();
  await expect(page.getByText(/Estimated profit per selection/)).toBeVisible();
});

test('unpublish removes it from the public list', async ({ page }) => {
  await login(page, 'admin', '/admin/combos');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Unpublish' }).first().click();
  await expect(page.getByRole('button', { name: 'Unpublish' })).toHaveCount(0);
  await expect.poll(async () => JSON.stringify(await (await page.request.get(`${B}/api/combos`)).json())).not.toContain('"slug":"behold"');
});
