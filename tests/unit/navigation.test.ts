import { describe, expect, it } from 'vitest';
import fixture from '@/lib/catalogue/fixture.json';
import type { Catalogue } from '@/lib/catalogue/types';
import { automaticNavigation, buildNavigation, forDevice } from '@/lib/navigation';
import { DEFAULT_WEBSITE, megaMenuSchema, websiteSchema, type MegaMenu } from '@/lib/website/schema';
import { panelsFromAutomatic } from '@/components/admin/mega-menu-editor';

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

const feature = { enabled: false, eyebrow: '', title: '', cta: '', href: '/', image: '', alt: '' };
const custom: MegaMenu = {
  mode: 'custom',
  panels: [
    { id: 'men', label: 'Men', href: '/collections/all', show: 'all', feature, columns: [{ heading: 'Clothing', links: [{ name: 'Tees', href: '/collections/all?type=tee', show: 'all' }, { name: 'Desktop only', href: '/x', show: 'desktop' }] }] },
    { id: 'app', label: 'Phone extra', href: '/track', show: 'mobile', feature, columns: [{ heading: 'Help', links: [{ name: 'Track', href: '/track', show: 'all' }] }] },
  ],
};

describe('mega menu builder', () => {
  it('a published custom menu replaces the automatic one on the storefront', () => {
    const panels = buildNavigation({ ...DEFAULT_WEBSITE, megaMenu: custom }, cat, hero);
    expect(panels.map((p) => p.label)).toEqual(['Men', 'Phone extra']);
  });

  it('automatic mode (or no menu saved) keeps the catalogue-built menu', () => {
    expect(buildNavigation({ ...DEFAULT_WEBSITE, megaMenu: { mode: 'automatic', panels: custom.panels } }, cat, hero).map((p) => p.id)).toEqual(['shop', 'collections', 'gifts', 'about']);
  });

  it('respects desktop/phone visibility for menu items and links', () => {
    const panels = buildNavigation({ ...DEFAULT_WEBSITE, megaMenu: custom }, cat, hero);
    const desktop = forDevice(panels, 'desktop'), mobile = forDevice(panels, 'mobile');
    expect(desktop.map((p) => p.id)).toEqual(['men']);
    expect(desktop[0]!.columns[0]!.links.map((l) => l.name)).toEqual(['Tees', 'Desktop only']);
    expect(mobile.map((p) => p.id)).toEqual(['men', 'app']);
    expect(mobile[0]!.columns[0]!.links.map((l) => l.name)).toEqual(['Tees']);
  });

  it('rejects unsafe links, empty custom menus, duplicate ids and images without descriptions', () => {
    const bad = (m: unknown) => megaMenuSchema.safeParse(m).success;
    expect(bad(custom)).toBe(true);
    expect(bad({ mode: 'custom', panels: [] })).toBe(false);
    const withLink = (href: string) => ({ ...custom, panels: [{ ...custom.panels[0]!, columns: [{ heading: 'x', links: [{ name: 'x', href, show: 'all' }] }] }] });
    for (const href of ['javascript:alert(1)', '//evil.example', 'http://insecure.example', 'https://user:pw@x.example', '/a b']) expect(bad(withLink(href)), href).toBe(false);
    expect(bad(withLink('https://wa.me/234800'))).toBe(true);
    expect(bad({ ...custom, panels: [custom.panels[0], custom.panels[0]] })).toBe(false);
    expect(bad({ ...custom, panels: [{ ...custom.panels[0]!, feature: { ...feature, enabled: true, title: 'T', image: '/a.jpg', alt: '' } }] })).toBe(false);
    expect(bad({ ...custom, panels: [{ ...custom.panels[0]!, columns: [] }] })).toBe(false);
  });

  it('content published before the builder existed still validates', () => {
    const old = structuredClone(DEFAULT_WEBSITE) as Record<string, unknown>;
    delete old.megaMenu;
    expect(websiteSchema.safeParse(old).success).toBe(true);
  });

  it('starting from the automatic menu produces a valid custom menu', () => {
    const auto = automaticNavigation(DEFAULT_WEBSITE, cat, hero);
    const seeded = { mode: 'custom' as const, panels: panelsFromAutomatic(auto) };
    expect(megaMenuSchema.safeParse(seeded).success).toBe(true);
    expect(buildNavigation({ ...DEFAULT_WEBSITE, megaMenu: seeded }, cat, hero).map((p) => p.label)).toEqual(auto.map((p) => p.label));
  });
});
