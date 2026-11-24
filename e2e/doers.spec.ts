// THE DOER'S: the owner prices the accessories (diary, pens, …) and customers see them in the total.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { B, q } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await q(`update combo_collections set status = 'draft', published_snapshot = null, base_price_kobo = null where slug = 'doers'`);
  await q(`update combo_slots set extra_price_kobo = null where collection_id = (select id from combo_collections where slug = 'doers')`);
  await q(`update combo_components set is_active = true, archived_at = null where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame','diary-2027','pen','highlight-pen','sticky-notes','perfume')`);
});

test('the owner sets selling prices for the other items, publishes, and customers pay them', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/combos`);
  await page.getByRole('link', { name: /DOER/i }).first().click();
  await page.getByRole('button', { name: '3. Selling prices' }).click();
  const card = page.getByRole('heading', { name: 'Prices of the other items' });
  await expect(card).toBeVisible();
  await expect(page.getByText('2027 Diary (included)')).toBeVisible();
  await expect(page.getByText(/Perfume \(optional add-on\)/)).toBeVisible();
  await page.getByLabel('Selling price (₦)').fill('30000');
  await page.getByLabel('2027 Diary (included)', { exact: true }).fill('7000');
  await page.getByLabel('Pen (included)', { exact: true }).fill('1500');
  await page.getByLabel(/Perfume \(optional add-on\)/).fill('12000');
  await expect(page.getByText('Empty: included free in the package.').first()).toBeVisible();        // highlight pen and sticky notes left free
  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Draft saved/)).toBeVisible();
  const prices = await q(`select s.label, s.extra_price_kobo::int p from combo_slots s join combo_collections c on c.id = s.collection_id where c.slug = 'doers' and s.kind = 'item' and s.extra_price_kobo is not null order by s.label`);
  expect(prices).toEqual([{ label: '2027 Diary', p: 700000 }, { label: 'Pen', p: 150000 }, { label: 'Perfume', p: 1200000 }]);
  await page.getByRole('button', { name: /Preview & publish/ }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText(/Published\. Customers can now/)).toBeVisible();
  await expect.poll(async () => (await (await page.request.get(`${B}/api/combos`)).text()).includes('"slug":"doers"'), { timeout: 150_000, intervals: [2000] }).toBe(true);
});

test('the calculator and the combo page show the item prices and add them to the total', async ({ page }) => {
  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}/combos/doers`);
  await expect(page.getByText(/2027 Diary.*₦7,000/)).toBeVisible();
  await expect(page.getByText(/Highlight Pen.*\(included\)/)).toBeVisible();
  const dlg = page.getByRole('dialog', { name: 'Build Your Combo' });
  await expect(async () => { await page.getByRole('button', { name: /Customize/ }).first().click(); await expect(dlg).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 40_000 });
  await dlg.locator('label', { hasText: /DOER/i }).first().click();
  await dlg.locator('label', { hasText: /^Premium Cotton T-shirt$/ }).first().click();
  await dlg.getByLabel('Colour').first().selectOption({ index: 1 });
  await dlg.getByLabel('Size').first().selectOption({ index: 2 });
  await expect(dlg.getByText(/Included:.*2027 Diary.*₦7,000/)).toBeVisible();
  await expect(dlg.getByTestId('combo-total')).toHaveText('₦38,500');               // 30,000 + diary 7,000 + pen 1,500 (highlight pen and sticky notes free)
  await dlg.getByText('See price breakdown').click();
  await expect(dlg.getByRole('listitem').filter({ hasText: '2027 Diary' }).filter({ hasText: '₦7,000' })).toBeVisible();   // its own line in the breakdown
  await dlg.getByLabel(/Add Perfume/).check();
  await expect(dlg.getByTestId('combo-total')).toHaveText('₦50,500');                // + perfume 12,000
});
