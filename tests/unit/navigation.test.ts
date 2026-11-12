import { describe, expect, it } from 'vitest';
import fixture from '@/lib/catalogue/fixture.json';
import type { Catalogue } from '@/lib/catalogue/types';
import { buildNavigation } from '@/lib/navigation';
import { DEFAULT_WEBSITE } from '@/lib/website/schema';

const cat = fixture as unknown as Catalogue;
const hero = { image: null, alt: null };
const hrefs = (panels: ReturnType<typeof buildNavigation>) => panels.flatMap((p) => p.columns.flatMap((c) => c.links.map((l) => l.href)));

describe('buildNavigation', () => {
  it('builds Shop, Collections, Gift Boxes and About panels from the catalogue', () => {
    const panels = buildNavigation(DEFAULT_WEBSITE, cat, hero);
    expect(panels.map((p) => p.id)).toEqual(['shop', 'collections', 'gifts', 'about']);
    expect(panels.every((p) => p.columns.every((c) => c.links.length > 0))).toBe(true);
  });

  it('only links product types that exist', () => {
    const noHoodies = { ...cat, products: cat.products.filter((p) => p.type !== 'hoodie') };
    expect(hrefs(buildNavigation(DEFAULT_WEBSITE, noHoodies, hero))).not.toContain('/collections/all?type=hoodie');
    expect(hrefs(buildNavigation(DEFAULT_WEBSITE, cat, hero))).toContain('/collections/all?type=hoodie');
  });

  it('hides gift-box links when no box is currently available', () => {
    const past = { ...cat, bundles: cat.bundles.map((b) => ({ ...b, available_until: '2000-01-01T00:00:00Z' })) };
    const panels = buildNavigation(DEFAULT_WEBSITE, past, hero);
    expect(panels.some((p) => p.id === 'gifts')).toBe(false);
    // The editor-managed "Word Gift" collection card may still point at /gift-boxes, which shows an
    // honest "season has ended" state; the Shop panel must not advertise boxes that cannot be bought.
    expect(hrefs(panels.filter((p) => p.id === 'shop'))).not.toContain('/gift-boxes');
  });

  it('still renders a usable menu if the catalogue is unavailable', () => {
    const panels = buildNavigation(DEFAULT_WEBSITE, null, hero);
    expect(panels.map((p) => p.id)).toEqual(['shop', 'collections', 'about']);
    expect(hrefs(panels)).toContain('/collections/all');
  });

  it('every link is an internal path', () => {
    expect(hrefs(buildNavigation(DEFAULT_WEBSITE, cat, hero)).every((h) => h.startsWith('/'))).toBe(true);
  });
});
