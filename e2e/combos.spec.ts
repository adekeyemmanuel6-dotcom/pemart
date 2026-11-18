// Combo calculator on the storefront: the required price scenarios, modal accessibility, bag, checkout, order snapshot.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { B, fillCheckout, payMock, q } from './helpers';

test.describe.configure({ mode: 'serial' });
const dlg = (p: Page) => p.getByRole('dialog', { name: 'Build Your Combo' });
const total = (p: Page) => dlg(p).getByTestId('combo-total');

/** Admin-style publish from SQL: every price below is the TEST's own; the product ships with none. */
async function seed(page: Page) {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
  const [admin] = await q(`select id from profiles where role = 'admin' order by created_at limit 1`);
  await q(`update combo_collections set status='draft', published_snapshot=null, base_price_kobo=null; delete from combo_price_rules; truncate orders restart identity cascade;
           update combo_components set is_active = true, archived_at = null, inventory_status = 'made_to_order' where slug in ('premium-tshirt','sweatshirt','hoodie','custom-frame')`);
  await q(`update delivery_zones set rate_verified = true`); // delivery rates must be verified by the owner before any order can be paid
  const id = async (table: string, slug: string) => (await q(`select id from ${table} where slug = $1`, [slug]))[0].id as string;
  const col = async (slug: string) => await id('combo_collections', slug);
  const opt = async (comp: string, o: string) => (await q(`select o.id from combo_component_options o join combo_components c on c.id = o.component_id where c.slug = $1 and o.slug = $2`, [comp, o]))[0].id as string;
  const f16x20 = await opt('custom-frame', '16x20'), f12x16 = await opt('custom-frame', '12x16');
  const rule = async (c: string, kind: string, comp: string | null, option: string | null, amount: number) =>
    q(`insert into combo_price_rules (collection_id, kind, component_id, option_id, amount_kobo) values ($1,$2,$3,$4,$5)`, [c, kind, comp, option, amount]);
  const hoodie = await id('combo_components', 'hoodie'), sweat = await id('combo_components', 'sweatshirt');
  const behold = await col('behold'), abide = await col('abide'), doers = await col('doers');
  await q(`update combo_collections set base_price_kobo = 4500000 where id = $1`, [behold]);
  await q(`update combo_collections set base_price_kobo = 6000000 where id = $1`, [abide]);
  for (const c of [behold, abide]) { await rule(c, 'garment_adjust', hoodie, null, 1000000); await rule(c, 'frame_size_adjust', null, f16x20, 700000); await rule(c, 'frame_size_adjust', null, f12x16, 0); }
  await rule(abide, 'garment_adjust', sweat, null, 500000);
  for (const c of [behold, abide]) await q(`select public.admin_combo_publish(jsonb_build_object('actor', $1::uuid, 'id', $2::uuid))`, [admin.id, c]);
  // The Doer's is published WITHOUT a price on purpose: the calculator must refuse it.
  await q(`select public.admin_combo_publish(jsonb_build_object('actor', $1::uuid, 'id', $2::uuid))`, [admin.id, doers]);
  await q(`update combo_slots set extra_price_kobo = 1200000 where collection_id = $1 and label = 'Perfume'`, [doers]);
  // The storefront reads published combos through a one-minute cache (an admin publish refreshes it at once; a SQL publish cannot).
  await expect.poll(async () => (await (await page.request.get(`${B}/api/combos`)).text()).includes('"slug":"abide"'), { timeout: 120_000, intervals: [2000] }).toBe(true);
}

async function open(page: Page, slug?: string) {
  await page.goto(`${B}/?preview=1`); // the store is locked to /presale until launch; staff preview cookie
  await page.goto(`${B}/${slug ? `combos/${slug}` : ''}`);
  await expect(async () => { await page.getByRole('button', { name: slug ? /Customize/ : 'Build Your Combo' }).first().click(); await expect(dlg(page)).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 40_000 });
}
const pick = async (page: Page, name: RegExp) => dlg(page).locator('label', { hasText: name }).first().click();
async function garment(page: Page, name: string) {
  await dlg(page).locator('label', { hasText: new RegExp(`^${name}$`) }).first().click();
  await dlg(page).getByLabel('Colour').first().selectOption({ index: 1 });
  await dlg(page).getByLabel('Size').first().selectOption({ index: 2 });
}
const frame = async (page: Page, i: number, size: RegExp, text?: string) => {
  const group = dlg(page).getByRole('radiogroup', { name: `Frame ${i} size` });
  await group.locator('label', { hasText: size }).click();
  if (text) await dlg(page).getByLabel(new RegExp(`Scripture or promise for (frame ${i}|your frame)`)).fill(text);
};

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000); const c = await browser.newContext(); await seed(await c.newPage()); await c.close(); });

test('BEHOLD: T-shirt + 12×16 = base; hoodie + 16×20 = base + both extras', async ({ page }) => {
  await open(page);
  await pick(page, /BEHOLD/);
  await garment(page, 'Premium Cotton T-shirt');
  await frame(page, 1, /12 × 16/, 'Psalm 119:18');
  await expect(total(page)).toHaveText('₦45,000');
  await garment(page, 'Hoodie');
  await dlg(page).getByRole('radiogroup', { name: 'Frame 1 size' }).locator('label', { hasText: /16 × 20/ }).click();
  await expect(total(page)).toHaveText('₦62,000'); // 45,000 + 10,000 hoodie + 7,000 frame
});

test('ABIDE: three frames, sweatshirt, mixed sizes priced per frame', async ({ page }) => {
  await open(page);
  await pick(page, /ABIDE/);
  await garment(page, 'Sweatshirt');
  for (const i of [1, 2, 3]) await frame(page, i, /12 × 16/, `Verse ${i}`);
  await expect(total(page)).toHaveText('₦65,000'); // 60,000 + 5,000
  for (const i of [1, 2, 3]) await frame(page, i, /16 × 20/);
  await expect(total(page)).toHaveText('₦86,000'); // + 3 x 7,000
  await garment(page, 'Hoodie');
  await expect(total(page)).toHaveText('₦91,000'); // 60,000 + 10,000 + 21,000
  await frame(page, 1, /12 × 16/);
  await expect(total(page)).toHaveText('₦84,000'); // mixed: 2 x 16x20, 1 x 12x16
});

test('THE DOER\'S without a selling price says so and cannot be bought', async ({ page }) => {
  await open(page);
  await pick(page, /DOER/);
  await expect(total(page)).toHaveText('Price currently unavailable');
  await expect(dlg(page).getByRole('button', { name: 'Add to bag' })).toBeDisabled();
  await expect(dlg(page).getByText(/Included:.*2027 Diary/)).toBeVisible();
});

test('The calculator never shows internal costs', async ({ page }) => {
  await open(page);
  await pick(page, /BEHOLD/);
  expect(await dlg(page).innerText()).not.toMatch(/internal|margin|profit|overhead|your cost/i);
  expect(await page.content()).not.toMatch(/internal_cost|overheads/);
  expect(JSON.stringify(await (await page.request.get(`${B}/api/combos`)).json())).not.toMatch(/internal_cost|overheads/);
});

test('modal: Esc closes and returns focus, draft survives, axe clean, labelled controls', async ({ page }) => {
  await open(page);
  await pick(page, /BEHOLD/);
  await garment(page, 'Hoodie');
  const a = await new AxeBuilder({ page }).include('[role=dialog]').analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Build Your Combo' }).first()).toBeFocused();
  await page.getByRole('button', { name: 'Build Your Combo' }).first().click();
  await expect(dlg(page).getByLabel('Size').first()).toHaveValue(/.+/); // draft kept
});

test('mobile: full-height sheet, sticky total and button reachable', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${B}/?preview=1`);
  await page.goto(`${B}/combos/behold`);
  await expect(async () => { await page.getByRole('button', { name: /Customize/ }).first().click(); await expect(dlg(page)).toBeVisible({ timeout: 3000 }); }).toPass({ timeout: 40_000 }); // first click can land before hydration
  const box = await dlg(page).boundingBox();
  expect(box!.width).toBeGreaterThan(380); expect(box!.height).toBeGreaterThan(770);
  await expect(dlg(page).getByRole('button', { name: 'Add to bag' })).toBeInViewport();
  await expect(total(page)).toBeInViewport();
  await ctx.close();
});

test('add to bag -> checkout -> paid order keeps every choice', async ({ page }) => {
  await open(page);
  await pick(page, /ABIDE/);
  await garment(page, 'Hoodie');
  await frame(page, 1, /12 × 16/, 'Psalm 23');
  await frame(page, 2, /16 × 20/, 'Isaiah 41:10');
  await frame(page, 3, /16 × 20/, 'Jeremiah 29:11');
  await expect(total(page)).toHaveText('₦84,000');
  await dlg(page).getByRole('button', { name: 'Add to bag' }).click();
  const drawer = page.getByRole('dialog', { name: 'Your bag' });
  await expect(drawer.getByText('ABIDE COLLECTION')).toBeVisible();
  await expect(drawer.getByText('₦84,000').first()).toBeVisible();
  await drawer.getByRole('link', { name: /^Checkout/ }).click();
  await page.waitForURL(/\/checkout/);
  await fillCheckout(page, 'ada@example.com', 'Lagos');
  await page.getByLabel(/I understand custom and personalised items are/).check();
  await payMock(page);
  const items = await q(`select kind, options, selections, unit_price_kobo from order_items where kind = 'combo'`);
  expect(items).toHaveLength(1);
  expect(JSON.stringify(items[0].selections)).toMatch(/Isaiah 41:10/);
  expect(items[0].options.comboSlug).toBe('abide');
  await expect(page.getByText(/Jeremiah 29:11/)).toBeVisible();
});

test('a price change after adding is caught: the server price wins, nothing is charged at the old price', async ({ page }) => {
  await open(page, 'behold');
  await pick(page, /BEHOLD/);
  await garment(page, 'Premium Cotton T-shirt');
  await frame(page, 1, /12 × 16/);
  await dlg(page).getByRole('button', { name: 'Add to bag' }).click();
  await q(`update combo_collections set base_price_kobo = 5000000 where slug='behold'; select public.admin_combo_publish(jsonb_build_object('actor', (select id from profiles where role='admin' limit 1), 'id', (select id from combo_collections where slug='behold')))`);
  await page.goto(`${B}/bag`);
  await expect(page.getByText('₦50,000').first()).toBeVisible();
});
