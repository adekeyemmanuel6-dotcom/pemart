// Launch-readiness checks on the public site: consent-gated analytics, first-order offer, SEO, accessibility and CSP.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { B, ok, q } from './helpers';

declare global { interface Window { dataLayer?: unknown[]; gtag?: unknown; fbq?: { queue?: unknown[] } } }

const THIRD_PARTY = /googletagmanager\.com|connect\.facebook\.net|vercel-scripts\.com|google-analytics\.com/;

/** Answer third-party script requests with an empty script so tests are offline-safe, and record what was asked for. */
async function stubThirdParties(page: Page) {
  const seen: string[] = [];
  await page.route(THIRD_PARTY, (route) => { seen.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
  return seen;
}
const dataLayer = (page: Page) => page.evaluate(() => (window.dataLayer ?? []).map((x) => Array.from(x as ArrayLike<unknown>).slice(0, 2).join(':')));
const pixelQueue = (page: Page) => page.evaluate(() => ((window.fbq?.queue ?? []) as unknown[][]).map((x) => Array.from(x).slice(0, 2).join(':')));

test.describe('cookie consent and analytics', () => {
  test('nothing third-party loads before consent; "Essential only" keeps it that way', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); const seen = await stubThirdParties(page);
    await page.goto(`${B}/products/seek-first-tee`);
    await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeVisible();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await page.keyboard.press('Escape');
    expect(seen, 'no analytics requests before a choice').toEqual([]);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toHaveCount(0);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('pemart-consent')))!)).toMatchObject({ analytics: false, marketing: false });
    expect((await page.evaluate(() => localStorage.getItem('pemart-consent')))).toContain('"ts"');
    expect(seen).toEqual([]);
    expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
    await ctx.close();
  });

  test('"Accept all" starts GA4 + Meta Pixel and the four commerce events fire (purchase only once)', async ({ browser }) => {
    await q(`truncate orders, gift_cards, custom_requests restart identity cascade; update product_variants set reserved_qty = 0`);
    const ctx = await browser.newContext(); const page = await ctx.newPage(); const seen = await stubThirdParties(page);
    await page.goto(`${B}/products/seek-first-tee`);
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect.poll(() => seen.join(' ')).toMatch(/googletagmanager\.com\/gtag\/js\?id=G-E2ETEST/);
    expect(seen.join(' ')).toMatch(/connect\.facebook\.net\/en_US\/fbevents\.js/);

    await page.goto(`${B}/products/seek-first-tee`);
    await expect.poll(() => dataLayer(page)).toContain('event:view_item');
    expect(await pixelQueue(page)).toContain('track:ViewContent');

    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    expect(await dataLayer(page)).toContain('event:add_to_cart');
    expect(await pixelQueue(page)).toContain('track:AddToCart');
    const gaItem = await page.evaluate(() => (window.dataLayer as unknown[]).map((x) => Array.from(x as ArrayLike<unknown>)).find((a) => a[1] === 'add_to_cart'));
    expect(gaItem?.[2]).toMatchObject({ currency: 'NGN', value: 22000, items: [{ item_name: 'Seek First Oversized Tee', price: 22000, quantity: 1 }] });

    await page.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click();
    await page.waitForURL(/checkout/);
    await page.locator('#email').fill('track@example.com'); await page.locator('#phone').fill('0803 123 4567');
    await page.locator('#recipient').fill('Ada Obi'); await page.locator('#line1').fill('12 Allen Avenue'); await page.locator('#city').fill('Ikeja');
    await page.getByText('Promised by').waitFor();
    await expect.poll(() => dataLayer(page)).toContain('event:begin_checkout');
    expect(await pixelQueue(page)).toContain('track:InitiateCheckout');

    await page.getByRole('button', { name: /^Pay ₦/ }).click();
    await page.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
    await page.getByRole('button', { name: 'Simulate successful payment' }).click();
    await page.waitForURL(/\/order\/PM-\d+/);
    await expect.poll(() => dataLayer(page)).toContain('event:purchase');
    const purchase = await page.evaluate(() => (window.dataLayer as unknown[]).map((x) => Array.from(x as ArrayLike<unknown>)).find((a) => a[1] === 'purchase'));
    expect(purchase?.[2]).toMatchObject({ currency: 'NGN', transaction_id: expect.stringMatching(/^PM-\d+$/), value: expect.any(Number) });

    await page.reload();
    await page.waitForLoadState('networkidle');
    const purchases = (await dataLayer(page)).filter((e) => e === 'event:purchase');
    expect(purchases.length, 'a refresh does not count the sale twice').toBe(0);
    await ctx.close();
  });

  test('"Cookie settings" re-opens the banner and withdrawing consent stops tracking', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await stubThirdParties(page);
    await page.goto(`${B}/`);
    await page.getByRole('button', { name: 'Accept all' }).click();
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    const banner = page.getByRole('dialog', { name: 'Cookie preferences' });
    await expect(banner).toBeVisible();
    await banner.getByLabel(/Analytics/).uncheck();
    await banner.getByLabel(/Marketing/).uncheck();
    await banner.getByRole('button', { name: 'Save choices' }).click();
    await page.waitForLoadState('load');
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('pemart-consent')))!)).toMatchObject({ analytics: false, marketing: false });
    expect(await page.evaluate(() => typeof window.gtag), 'a reload after withdrawing leaves no GA').toBe('undefined');
    await ctx.close();
  });
});

test.describe('first-order offer', () => {
  test.beforeAll(async () => { await q(`delete from subscribers where email like '%@offer.test'`); });

  test('after 20 seconds the popup shows once; claiming issues a single-use code, applies it to the bag and emails it', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await stubThirdParties(page);
    await page.clock.install();
    await page.goto(`${B}/collections/kingdom`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.clock.fastForward(21_000);
    const popup = page.getByRole('dialog', { name: '10% off your first order' });
    await expect(popup).toBeVisible();

    await popup.getByRole('button', { name: 'Get my code' }).click();
    await expect(popup.getByRole('alert')).toContainText('Enter your email or phone number');
    await popup.getByLabel('Email').fill('nope');
    await popup.getByRole('button', { name: 'Get my code' }).click();
    await expect(popup.getByRole('alert')).toContainText('valid email');

    await popup.getByLabel('Email').fill('First@Offer.test');
    await popup.getByRole('button', { name: 'Get my code' }).click();
    const code = (await popup.getByText(/^PEM-[A-Z2-9]{6}$/).textContent())!;
    expect(code).toMatch(/^PEM-/);
    expect((await q(`select consent_at, offer_code from subscribers where email = 'first@offer.test'`))[0]).toMatchObject({ offer_code: code });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pemart-bag')!).state.code)).toBe(code);
    ok(fs.readdirSync(path.join(process.cwd(), '.outbox')).some((f) => f.includes('welcome-offer-first@offer.test')), 'the welcome email with the code was produced');
    await popup.getByRole('button', { name: 'Start shopping' }).click();

    // once only: a new page load does not show it again
    await page.reload();
    await page.clock.fastForward(21_000);
    await expect(page.getByRole('dialog', { name: '10% off your first order' })).toHaveCount(0);

    // the code takes 10% off the bag
    await page.goto(`${B}/products/seek-first-tee`);
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Your bag' }).getByText(new RegExp(`${code} applied: ₦2,200 off`))).toBeVisible();
    await ctx.close();
  });

  test('the popup also appears after 20 seconds, and the footer sign-up issues the same code to the same email', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await stubThirdParties(page);
    await page.clock.install();
    await page.goto(`${B}/about`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.clock.fastForward(19_000);
    await expect(page.getByRole('dialog', { name: '10% off your first order' })).toHaveCount(0);
    await page.clock.fastForward(2_000);
    await expect(page.getByRole('dialog', { name: '10% off your first order' })).toBeVisible();
    await page.keyboard.press('Escape');

    const email = 'again@offer.test';
    const footer = page.locator('footer');
    await footer.getByLabel('Get 10% off your first order').fill(email);
    await footer.getByRole('button', { name: 'Join' }).click();
    await expect(footer.getByRole('status')).toContainText('PEM-');
    const first = (await footer.getByRole('status').textContent())!.match(/PEM-[A-Z2-9]{6}/)![0];
    await footer.getByLabel('Get 10% off your first order').fill(email);
    await footer.getByRole('button', { name: 'Join' }).click();
    await expect(footer.getByRole('status')).toContainText(first);
    expect((await q(`select count(*)::int n from discount_codes where code = $1`, [first]))[0].n).toBe(1);
    await ctx.close();
  });

  test('the popup stays out of the way on checkout and order pages', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await stubThirdParties(page);
    await page.clock.install();
    await page.goto(`${B}/checkout`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.clock.fastForward(21_000);
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog', { name: '10% off your first order' })).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('SEO', () => {
  const pages = ['/', '/collections/kingdom', '/products/seek-first-tee', '/bundles/couples-christmas-box', '/gift-boxes', '/custom', '/bulk', '/faq', '/delivery', '/about'];

  test('every public page has a unique title, a description, a canonical URL and social tags', async ({ page }) => {
    const titles = new Set<string>();
    for (const p of pages) {
      const res = await page.goto(`${B}${p}`);
      expect(res?.status(), p).toBe(200);
      const title = await page.title();
      expect(title.length, `${p} title`).toBeGreaterThan(10);
      expect(titles.has(title), `${p} has a unique title (${title})`).toBe(false);
      titles.add(title);
      expect(await page.locator('meta[name="description"]').getAttribute('content'), `${p} description`).toMatch(/.{40,}/);
      expect(await page.locator('link[rel="canonical"]').getAttribute('href'), `${p} canonical`).toMatch(/^https?:\/\//);
      expect(await page.locator('meta[property="og:title"]').count(), `${p} og:title`).toBeGreaterThan(0);
      expect(await page.locator('meta[property="og:image"]').count(), `${p} og:image`).toBeGreaterThan(0);
      expect(await page.locator('h1').count(), `${p} has exactly one h1`).toBe(1);
    }
  });

  test('product pages carry Product + Offer JSON-LD in NGN and a breadcrumb trail', async ({ page }) => {
    await page.goto(`${B}/products/seek-first-tee`);
    const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    const flat = blocks.flatMap((b) => (Array.isArray(b['@graph']) ? b['@graph'] : [b]));
    const product = flat.find((b) => b['@type'] === 'Product');
    expect(product?.name).toBe('Seek First Oversized Tee');
    const offers = [].concat(product.offers);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) { expect(o.priceCurrency ?? o.offers?.[0]?.priceCurrency).toBe('NGN'); }
    expect(JSON.stringify(product.offers)).toMatch(/InStock|PreOrder|SoldOut|OutOfStock/);
    expect(flat.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  test('sitemap lists catalogue pages and keeps private ones out; robots.txt blocks the private areas', async ({ request }) => {
    const sitemap = await (await request.get(`${B}/sitemap.xml`)).text();
    expect(sitemap).toContain('/products/seek-first-tee');
    expect(sitemap).toContain('/bundles/couples-christmas-box');
    expect(sitemap).not.toMatch(/\/admin|\/checkout|\/account|\/order\//);
    const robots = await (await request.get(`${B}/robots.txt`)).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Disallow: \/checkout/);
    expect(robots).toMatch(/Sitemap: .*sitemap\.xml/);
  });

  test('private pages are noindex and unknown URLs return a real 404', async ({ page, request }) => {
    await page.goto(`${B}/checkout`);
    expect(await page.locator('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/);
    expect((await request.get(`${B}/products/does-not-exist`)).status()).toBe(404);
    expect((await request.get(`${B}/collections/does-not-exist`)).status()).toBe(404);
  });
});

test.describe('accessibility (WCAG 2.1 AA, axe)', () => {
  const publicPages = ['/', '/collections/kingdom', '/products/seek-first-tee', '/bundles/couples-christmas-box', '/gift-boxes', '/custom', '/bulk', '/bag', '/checkout', '/track', '/search?q=tee', '/faq', '/privacy', '/auth/sign-in'];
  const scan = async (page: Page) => (await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

  for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]] as const) {
    test(`public pages have no violations (${label})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage(); await stubThirdParties(page);
      // the banner itself is part of the page: check it while it is open on the first page, then dismiss it
      await page.goto(`${B}/`);
      expect(await scan(page), 'home with the cookie banner open').toEqual([]);
      await page.getByRole('button', { name: 'Essential only' }).click();
      const found: string[] = [];
      for (const p of publicPages) {
        await page.goto(`${B}${p}`); await page.waitForLoadState('networkidle');
        found.push(...(await scan(page)).map((v) => `${p} → ${v}`));
      }
      expect(found).toEqual([]);
      await ctx.close();
    });
  }

  test('the open bag drawer has no violations', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); await stubThirdParties(page);
    await page.goto(`${B}/products/seek-first-tee`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await page.getByRole('dialog', { name: 'Your bag' }).waitFor();
    expect(await scan(page), 'bag drawer').toEqual([]);
    await ctx.close();
  });

  test('admin pages have no violations', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
    await page.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
    const found: string[] = [];
    for (const p of ['/admin', '/admin/orders', '/admin/production', '/admin/proofs', '/admin/quotes', '/admin/reviews', '/admin/customers', '/admin/catalogue', '/admin/discounts', '/admin/settings', '/admin/reports', '/admin/help']) {
      await page.goto(`${B}${p}`); await page.waitForLoadState('networkidle');
      found.push(...(await scan(page)).map((v) => `${p} → ${v}`));
    }
    expect(found).toEqual([]);
    await ctx.close();
  });
});

test.describe('security headers and CSP', () => {
  test('headers: HSTS, nosniff, frame denial, and the right CSP per route type', async ({ request }) => {
    const pub = (await request.get(`${B}/`)).headers();
    expect(pub['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    expect(pub['x-content-type-options']).toBe('nosniff');
    expect(pub['x-frame-options']).toBe('DENY');
    expect(pub['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(pub['content-security-policy']).toMatch(/object-src 'none'/);

    const checkout = (await request.get(`${B}/checkout`)).headers()['content-security-policy'];
    expect(checkout, 'checkout gets a per-request nonce').toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(checkout).toMatch(/'strict-dynamic'/);
    expect(checkout.split(';').find((d) => d.trim().startsWith('script-src'))).not.toMatch(/unsafe-inline/);
    const a = (await request.get(`${B}/checkout`)).headers()['content-security-policy'].match(/nonce-([^']+)/)![1];
    const b = (await request.get(`${B}/checkout`)).headers()['content-security-policy'].match(/nonce-([^']+)/)![1];
    expect(a, 'a fresh nonce every request').not.toBe(b);
    for (const p of ['/auth/sign-in', '/track']) {
      const h = (await request.get(`${B}${p}`)).headers();
      expect(h['content-security-policy'], p).toBeTruthy();
    }
  });

  test('no CSP violations or page errors while browsing, consenting, checking out and using the admin', async ({ browser }) => {
    const problems: string[] = [];
    const watch = (page: Page) => {
      page.on('console', (m) => { if (/Content Security Policy|Refused to (load|execute|connect|apply)/i.test(m.text())) problems.push(`${page.url()} :: ${m.text().slice(0, 160)}`); });
      page.on('pageerror', (e) => problems.push(`pageerror ${e.message.slice(0, 160)}`));
    };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); watch(page); await stubThirdParties(page);
    await page.goto(`${B}/`);
    await page.getByRole('button', { name: 'Accept all' }).click();
    for (const p of ['/', '/products/seek-first-tee', '/gift-boxes', '/custom', '/bag', '/checkout', '/auth/sign-in', '/track']) { await page.goto(`${B}${p}`); await page.waitForLoadState('networkidle'); }
    await page.goto(`${B}/products/seek-first-tee`);
    await page.getByRole('button', { name: 'S', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await page.getByRole('dialog', { name: 'Your bag' }).getByRole('link', { name: /^Checkout/ }).click();
    await page.waitForURL(/checkout/);
    await page.locator('#email').fill('csp@example.com'); await page.locator('#phone').fill('0803 123 4567');
    await page.locator('#recipient').fill('Ada Obi'); await page.locator('#line1').fill('12 Allen Avenue'); await page.locator('#city').fill('Ikeja');
    await page.getByText('Promised by').waitFor();
    await page.getByRole('button', { name: /^Pay ₦/ }).click();
    await page.getByRole('dialog', { name: /Simulated Paystack/ }).waitFor();
    await page.getByRole('button', { name: 'Simulate successful payment' }).click();
    await page.waitForURL(/\/order\/PM-\d+/);
    const admin = await (await browser.newContext()).newPage(); watch(admin);
    await admin.goto(`${B}/api/dev/login?email=admin@example.com&role=admin&next=/admin`);
    for (const p of ['/admin', '/admin/orders', '/admin/settings', '/admin/catalogue']) { await admin.goto(`${B}${p}`); await admin.waitForLoadState('networkidle'); }
    await ctx.close();
    // Next.js dev mode logs a few unrelated HMR/websocket messages; only genuine policy violations matter here.
    expect(problems).toEqual([]);
  });
});
