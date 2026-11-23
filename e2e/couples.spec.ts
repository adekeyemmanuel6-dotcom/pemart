// Couples edition: two garments, one per person, everything else the same.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, fillCheckout, payMock, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const dlg = (p: Page) => p.getByRole('dialog', { name: 'Build Your Combo' });
const total = (p: Page) => dlg(p).getByTestId('combo-total');

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  const c = await browser.newContext(); const page = await c.newPage();
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
  const [admin] = await q(`select id from profiles where role = 'admin' order by created_at limit 1`);
  await q(`update delivery_zones set rate_verified = true, min_days = 3, max_days = 5`);
  await q(`update combo_components set is_active = true, archived_at = null where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame')`);
  await q(`update combo_collections set status = 'draft', published_snapshot = null, base_price_kobo = null`);
  await q(`delete from combo_price_rules`);
  await q(`truncate orders restart identity cascade`);
  const id = async (slug: string) => (await q(`select id from combo_collections where slug = $1`, [slug]))[0].id as string;
  const comp = async (slug: string) => (await q(`select id from combo_components where slug = $1`, [slug]))[0].id as string;
  await q(`update combo_collections set base_price_kobo = 4500000 where slug = 'behold'`);
  await q(`update combo_collections set base_price_kobo = 8000000 where slug = 'behold-couples'`);
  for (const col of ['behold', 'behold-couples']) await q(`insert into combo_price_rules (collection_id, kind, component_id, amount_kobo) values ($1,'garment_adjust',$2,1000000)`, [await id(col), await comp('hoodie')]);
  for (const col of ['behold', 'behold-couples']) await q(`select public.admin_combo_publish(jsonb_build_object('actor', $1::uuid, 'id', $2::uuid))`, [admin.id, await id(col)]);
  await expect.poll(async () => (await (await page.request.get(`${B}/api/combos`)).text()).includes('behold-couples'), { timeout: 150_000, intervals: [2000] }).toBe(true);
  await c.close();
});

async function open(page: Page, path = '/') {
  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}${path}`);
  await expect(async () => { await page.getByRole('button', { name: path === '/' ? 'Build Your Combo' : /Customize/ }).first().click(); await expect(dlg(page)).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 40_000 });
}
async function garment(page: Page, i: number, name: string) {
  const fs = dlg(page).locator('fieldset', { hasText: new RegExp(`\\(${i} of 2\\)`) });
  await fs.locator('label', { hasText: new RegExp(`^${name}$`) }).click();
  await fs.getByLabel('Colour').selectOption({ index: 1 });
  await fs.getByLabel('Size').selectOption({ index: 2 });
}

test('"Just me" / "For two" switch: the couples edition asks for two garments and prices each', async ({ page }) => {
  await open(page);
  await dlg(page).locator('label', { hasText: /BEHOLD/ }).first().click();
  await expect(dlg(page).getByRole('radiogroup', { name: 'Who is it for' })).toBeVisible();
  await expect(dlg(page).locator('label', { hasText: /BEHOLD COLLECTION FOR COUPLES/ })).toHaveCount(0);   // listed once, reached by the switch
  await dlg(page).getByRole('radiogroup', { name: 'Who is it for' }).locator('label', { hasText: 'For two (couples)' }).click();
  await expect(dlg(page).getByText('Customised garment (1 of 2)')).toBeVisible();
  await expect(dlg(page).getByText('Customised garment (2 of 2)')).toBeVisible();
  await garment(page, 1, 'Premium Cotton T-shirt');
  await garment(page, 2, 'Hoodie');
  await expect(total(page)).toHaveText('₦90,000');                       // 80,000 + hoodie 10,000
  await garment(page, 1, 'Hoodie');
  await expect(total(page)).toHaveText('₦100,000');                      // two hoodies
  await dlg(page).getByText('See price breakdown').click();
  await expect(dlg(page).getByText('Hoodie × 2')).toBeVisible();
  await dlg(page).getByText('See price breakdown').click();
  const a = await new AxeBuilder({ page }).include('[role=dialog]').withTags(WCAG).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
  await dlg(page).getByRole('radiogroup', { name: 'Who is it for' }).locator('label', { hasText: 'Just me' }).click();
  await expect(dlg(page).getByText(/\(2 of 2\)/)).toHaveCount(0);
});

test('both people must choose before it can go in the bag; then it is bought and the order lists both garments', async ({ page }) => {
  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}/combos/behold-couples`);
  await expect(page.getByText('2 garments, one for each of you')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See the single edition' })).toBeVisible();
  await open(page, '/combos/behold-couples');
  await expect(dlg(page).getByRole('radiogroup', { name: 'Who is it for' })).toBeVisible();
  await garment(page, 1, 'Premium Cotton T-shirt');
  await dlg(page).getByRole('button', { name: 'Add to bag' }).click();
  await expect(dlg(page).getByRole('alert')).toContainText(/Choose a (size|colour) for your/i);
  await garment(page, 2, 'Hoodie');
  await dlg(page).getByLabel(/Scripture or promise for your frame|Or write your own for your frame/).fill('Ruth 1:16');
  await dlg(page).getByRole('button', { name: 'Add to bag' }).click();
  const drawer = page.getByRole('dialog', { name: 'Your bag' });
  await expect(drawer.getByText('BEHOLD COLLECTION FOR COUPLES')).toBeVisible();
  await expect(drawer.getByText('₦90,000').first()).toBeVisible();
  await drawer.getByRole('link', { name: /^Checkout/ }).click();
  await page.waitForURL(/\/checkout/);
  await fillCheckout(page, 'pair@example.com', 'Lagos');
  await page.getByLabel(/I understand custom and personalised items are/).check();
  await payMock(page);
  const [item] = await q(`select selections from order_items where kind = 'combo'`);
  expect((item.selections as { productName: string }[]).filter((r) => /Hoodie|T-shirt/.test(r.productName)).map((r) => r.productName).sort()).toEqual(['Hoodie', 'Premium Cotton T-shirt']);
  await expect(page.getByText(/Customised garment \(?1/).first()).toBeVisible();
});

test('/combos lists a collection once, with a couples link; the admin can make an edition and sees it flagged', async ({ page }) => {
  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}/combos`);
  await expect(page.getByRole('heading', { name: /BEHOLD COLLECTION/ })).toHaveCount(1);
  await expect(page.getByText(/Couples edition \(2 garments\)/)).toBeVisible();
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/combos`);
  await expect(page.getByText(/Couples edition of BEHOLD COLLECTION/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make couples edition' })).toHaveCount(0);   // every collection already has its edition
});
