// The homepage editor only offers what each section really shows.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { B } from './helpers';

test('each homepage section offers only the fields it uses, in plain words', async ({ page }) => {
  await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin/website`);
  await page.getByRole('tab', { name: 'Homepage' }).or(page.getByRole('button', { name: 'Homepage', exact: true })).first().click();
  await expect(page.getByRole('link', { name: /Combo Management → Website text/ })).toBeVisible();

  const manifesto = page.locator('details', { has: page.getByText(/Manifesto strip/) });
  await manifesto.locator(':scope > summary').click();
  await expect(manifesto.getByLabel('Phrases (one per line)')).toBeVisible();
  for (const label of ['Eyebrow / small heading', 'Text', 'Button or link label', 'Button or link destination']) await expect(manifesto.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(manifesto.getByText('Image description (alt text)')).toHaveCount(0);

  const collections = page.locator('details', { has: page.getByText(/Collections —/) }).first();
  await collections.locator(':scope > summary').click();
  await expect(collections.getByLabel('Heading', { exact: true })).toBeVisible();
  await expect(collections.getByLabel('Text', { exact: true })).toHaveCount(0);

  const featured = page.locator('details', { has: page.getByText(/Featured products/) });
  await featured.locator(':scope > summary').click();
  await expect(featured.getByLabel('Text shown only while there are no products on sale')).toBeVisible();
  await expect(featured.getByText('Image description (alt text)')).toHaveCount(0);

  const philosophy = page.locator('details', { has: page.getByText(/Our philosophy/) });
  await philosophy.locator(':scope > summary').click();
  for (const label of ['Eyebrow / small heading', 'Heading', 'Text', 'Button or link label', 'Button or link destination']) await expect(philosophy.getByLabel(label, { exact: true })).toBeVisible();
  await expect(philosophy.getByText('Image description (alt text)')).toBeVisible();

  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
});
