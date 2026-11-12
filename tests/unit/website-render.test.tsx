import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WebsitePageView } from '@/components/website-page';
import { DEFAULT_WEBSITE } from '@/lib/website/schema';
import { SiteHeader } from '@/components/layout/site-header';
import { DEFAULT_SETTINGS } from '@/lib/settings';

describe('published content rendering', () => {
  it('renders editorial text safely without executing HTML', () => {
    const page = {
      ...DEFAULT_WEBSITE.pages[0]!,
      enabled: true,
      title: 'New story',
      body: '## Our mission\n\n<script>alert(1)</script>\n\n- First item\n- Second item',
    };
    const html = renderToStaticMarkup(<WebsitePageView page={page} />);
    expect(html).toContain('New story');
    expect(html).toContain('<h2>Our mission</h2>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('<li>Second item</li>');
  });
  it('renders edited brand and menu links in the storefront header', async () => {
    const content = structuredClone(DEFAULT_WEBSITE);
    content.brand.name = 'Edited brand';
    content.navigation.main = [{ name: 'Our mission', href: '/pages/mission' }];
    const html = renderToStaticMarkup(await SiteHeader({ settings: { ...DEFAULT_SETTINGS, website_content: content } }));
    expect(html).toContain('Edited brand');
    expect(html).toContain('href="/pages/mission"');
    expect(html).not.toContain('Custom Orders');
  });
});
