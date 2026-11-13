import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEBSITE, imageHref, resolveWebsite, safeHref, websiteSchema } from '@/lib/website/schema';
const auth = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  adm: vi.fn(),
  isMissingFunction: (e: unknown) => /function .* does not exist|could not find the function/i.test(String((e as { message?: string })?.message ?? e)),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/admin/db', () => auth);
vi.mock('next/cache', () => cache);
import { publishWebsite } from '@/lib/admin/actions-website';
const fresh = () => structuredClone(DEFAULT_WEBSITE);

describe('website content contract', () => {
  it('preserves the existing campaign before the first publication', () => {
    const content = resolveWebsite({
      hero_headline: 'Existing campaign',
      hero_copy: 'Keep this copy',
      hero_image_url: '/campaign.jpg',
      hero_image_alt: 'Existing image',
    });
    expect(content.sections[0]!).toMatchObject({
      title: 'Existing campaign',
      body: 'Keep this copy',
      image: '/campaign.jpg',
    });
    expect(websiteSchema.safeParse(content).success).toBe(true);
    expect(content.pages.every((p) => !p.enabled)).toBe(true);
    expect(content.pages.find((p) => p.slug === 'about')?.body).toContain('Wear The Word');
  });
  it('reads a published edit without falling back to old hero settings', () => {
    const content = fresh();
    content.sections[0]!.title = 'New campaign';
    content.brand.name = 'Edited brand';
    expect(resolveWebsite({ website_content: content, hero_headline: 'Old campaign' }).sections[0]!.title).toBe(
      'New campaign',
    );
  });
  it.each([
    'javascript:alert(1)',
    '//evil.test',
    '/\\evil.test',
    'data:text/html,hello',
    'https://user:pass@example.com',
    '/\n/evil.test',
    'http://example.com',
  ])('rejects unsafe links: %s', (url) => expect(safeHref.safeParse(url).success).toBe(false));
  it.each(['/about', '/collections/all?type=tee', 'https://example.com/story'])(
    'accepts valid destinations: %s',
    (url) => expect(safeHref.safeParse(url).success).toBe(true),
  );
  it('rejects duplicate sections, missing hero, duplicate pages and blank published pages', () => {
    let c = fresh();
    c.sections[1]! = c.sections[0]!;
    expect(websiteSchema.safeParse(c).success).toBe(false);
    c = fresh();
    c.sections[0]!.enabled = false;
    expect(websiteSchema.safeParse(c).success).toBe(false);
    c = fresh();
    c.pages.push(c.pages[0]!);
    expect(websiteSchema.safeParse(c).success).toBe(false);
    c = fresh();
    c.pages[0]!.enabled = true;
    c.pages[0]!.body = '';
    expect(websiteSchema.safeParse(c).success).toBe(false);
  });
  it('requires image descriptions and photograph permission', () => {
    expect(imageHref.safeParse('not-a-url').success).toBe(false);
    expect(imageHref.safeParse('https://example.com/photo.jpg').success).toBe(false);
    expect(imageHref.safeParse('https://project.supabase.co/storage/v1/object/public/catalogue/photo.jpg').success).toBe(true);
    const c = fresh();
    c.sections[0]!.image = '/photo.jpg';
    c.sections[0]!.alt = '';
    expect(websiteSchema.safeParse(c).success).toBe(false);
    c.sections[0]!.alt = 'A person wearing the design';
    expect(websiteSchema.safeParse(c).success).toBe(true);
    expect(
      websiteSchema.safeParse({
        ...c,
        community: [{ image: '/customer.jpg', alt: 'Customer photograph', caption: '', permission: false }],
      }).success,
    ).toBe(false);
  });
  it('allows hiding and reordering sections, empty menus and explicit featured products', () => {
    const c = fresh();
    c.sections[2]!.enabled = false;
    c.sections.reverse();
    c.navigation.main = [];
    c.featuredProductIds = ['12345678-1234-4234-8234-123456789abc'];
    expect(websiteSchema.parse(c)).toEqual(c);
  });
});

describe('website publishing action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requirePerm.mockResolvedValue({ id: 'verified-actor', role: 'admin' });
    auth.adm.mockResolvedValue({ revision: 3 });
  });
  it('uses the verified actor, preserves other settings and invalidates the storefront after saving', async () => {
    const content = fresh();
    const result = await publishWebsite(content, 2);
    expect(auth.adm).toHaveBeenCalledWith(
      'admin_website_save',
      { id: 'verified-actor', role: 'admin' },
      { content, revision: 2 },
    );
    expect(result).toMatchObject({ ok: true, revision: 3 });
    expect(cache.revalidateTag).toHaveBeenCalledWith('settings');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
  it('does not write when content is invalid', async () => {
    const content = fresh();
    content.navigation.main[0]!.href = 'javascript:alert(1)';
    expect((await publishWebsite(content, 2)).ok).toBe(false);
    expect(auth.adm).not.toHaveBeenCalled();
  });
  it('never reaches the database for a rejected admin session', async () => {
    auth.requirePerm.mockRejectedValue(new Error('forbidden'));
    await expect(publishWebsite(fresh(), 0)).rejects.toThrow('forbidden');
    expect(auth.adm).not.toHaveBeenCalled();
  });
  it('reports stale revisions without invalidating or overwriting', async () => {
    auth.adm.mockRejectedValue(new Error('website_conflict'));
    const result = await publishWebsite(fresh(), 1);
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain('newer version');
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });
  it('explains that publishing needs database update 0014 when the function is missing', async () => {
    auth.adm.mockRejectedValue(new Error('Could not find the function public.admin_website_save(p) in the schema cache'));
    const result = await publishWebsite(fresh(), 0);
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain('0014');
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });
  it('does not expose internal database errors to the editor', async () => {
    auth.adm.mockRejectedValue(new Error('database credential details'));
    const result = await publishWebsite(fresh(), 2);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('credential details');
  });
});
