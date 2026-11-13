import type { Catalogue } from '@/lib/catalogue/types';
import { isBundleAvailable } from '@/lib/catalogue/helpers';
import type { MegaMenu, WebsiteContent } from '@/lib/website/schema';

export type Show = 'all' | 'desktop' | 'mobile';
export type NavLink = { name: string; href: string; show?: Show };
export type NavColumn = { heading: string; links: NavLink[] };
export type NavFeature = { eyebrow: string; title: string; href: string; cta: string; image: string | null; imageAlt: string };
export type NavPanel = { id: string; label: string; href: string; show?: Show; columns: NavColumn[]; feature?: NavFeature };

/** Panels and links for one device; columns left empty by hidden links are dropped. */
export function forDevice(panels: NavPanel[], device: 'desktop' | 'mobile'): NavPanel[] {
  const visible = (s?: Show) => !s || s === 'all' || s === device;
  return panels
    .filter((p) => visible(p.show))
    .map((p) => ({ ...p, columns: p.columns.map((c) => ({ ...c, links: c.links.filter((l) => visible(l.show)) })).filter((c) => c.links.length) }));
}

/** A menu published from the admin's mega menu builder. */
export function fromMegaMenu(menu: MegaMenu): NavPanel[] {
  return menu.panels.map((p) => ({
    id: p.id,
    label: p.label,
    href: p.href,
    show: p.show,
    columns: p.columns,
    feature: p.feature.enabled
      ? { eyebrow: p.feature.eyebrow, title: p.feature.title, href: p.feature.href, cta: p.feature.cta, image: p.feature.image || null, imageAlt: p.feature.alt }
      : undefined,
  }));
}

const TYPE_LINKS: { type: string; href: string; name: string; group: 'clothing' | 'lifestyle' }[] = [
  { type: 'tee', href: '/collections/all?type=tee', name: 'Oversized Tees', group: 'clothing' },
  { type: 'hoodie', href: '/collections/all?type=hoodie', name: 'Hoodies', group: 'clothing' },
  { type: 'frame', href: '/collections/all?type=frame', name: 'Scripture Frames', group: 'lifestyle' },
];
const ACCESSORY_TYPES = new Set(['perfume', 'jewellery', 'bracelet', 'glasses', 'fun']);

/**
 * Builds the header's mega-menu panels from real data only: a product type, bundle or collection
 * appears only when it exists in the catalogue or the published website content. Nothing is invented,
 * so no link lands on an empty page.
 */
export function buildNavigation(content: WebsiteContent, cat: Catalogue | null, hero: { image: string | null; alt: string | null }): NavPanel[] {
  if (content.megaMenu?.mode === 'custom' && content.megaMenu.panels.length) return fromMegaMenu(content.megaMenu);
  return automaticNavigation(content, cat, hero);
}

/** The menu built from live catalogue data (the default, and the starting point offered in the builder). */
export function automaticNavigation(content: WebsiteContent, cat: Catalogue | null, hero: { image: string | null; alt: string | null }): NavPanel[] {
  const products = cat?.products.filter((p) => p.is_active) ?? [];
  const has = (type: string) => products.some((p) => p.type === type);
  const bundles = (cat?.bundles ?? []).filter((b) => isBundleAvailable(b));
  const giftBoxes = bundles.filter((b) => b.kind === 'gift_box');
  const couples = bundles.filter((b) => b.kind === 'couple');

  const clothing = TYPE_LINKS.filter((t) => t.group === 'clothing' && has(t.type)).map(({ href, name }) => ({ href, name }));
  const lifestyle: NavLink[] = [
    ...(giftBoxes.length ? [{ href: '/gift-boxes', name: 'Gift Boxes' }] : []),
    ...TYPE_LINKS.filter((t) => t.group === 'lifestyle' && has(t.type)).map(({ href, name }) => ({ href, name })),
    ...(products.some((p) => ACCESSORY_TYPES.has(p.type)) ? [{ href: '/collections/accessories', name: 'Accessories' }] : []),
    ...(couples.length ? [{ href: '/couples', name: 'Couple Packages' }] : []),
    ...(has('gift_card') ? [{ href: '/gift-cards', name: 'Gift Cards' }] : []),
  ];

  const feature: NavFeature = {
    eyebrow: 'Wear The Word',
    title: 'The Word. Worn daily.',
    href: '/collections/all',
    cta: 'Explore the collection',
    image: hero.image,
    imageAlt: hero.alt ?? '',
  };

  const panels: NavPanel[] = [
    {
      id: 'shop',
      label: 'Shop',
      href: '/collections/all',
      columns: [
        { heading: 'Featured', links: [{ href: '/collections/all?sort=newest', name: 'New Arrivals' }, { href: '/collections/all', name: 'Shop All' }] },
        ...(clothing.length ? [{ heading: 'Clothing', links: clothing }] : []),
        ...(lifestyle.length ? [{ heading: 'Lifestyle & Gifts', links: lifestyle }] : []),
      ],
      feature,
    },
  ];

  if (content.navigation.shop.length) {
    panels.push({
      id: 'collections',
      label: 'Collections',
      href: '/collections',
      columns: [{ heading: 'Shop the Word', links: [...content.navigation.shop, { href: '/collections', name: 'All Collections' }] }],
      feature: { ...feature, eyebrow: 'Five collections', title: 'Wear what you stand on.', href: '/collections', cta: 'View all collections' },
    });
  }

  if (giftBoxes.length || couples.length) {
    panels.push({
      id: 'gifts',
      label: 'Gift Boxes',
      href: '/gift-boxes',
      columns: [
        {
          heading: 'Gifting',
          links: [
            ...(giftBoxes.length ? [{ href: '/gift-boxes', name: 'Shop All Gift Boxes' }] : []),
            ...(couples.length ? [{ href: '/couples', name: 'Couple Gift Boxes' }] : []),
            { href: '/custom', name: 'Custom Gift Orders' },
            ...(has('gift_card') ? [{ href: '/gift-cards', name: 'Gift Cards' }] : []),
          ],
        },
        ...(giftBoxes.length ? [{ heading: 'Our Boxes', links: giftBoxes.slice(0, 6).map((b) => ({ href: `/bundles/${b.slug}`, name: b.name })) }] : []),
      ],
    });
  }

  panels.push({
    id: 'about',
    label: 'About',
    href: '/about',
    columns: [
      {
        // The editor's "Main menu" links live here, so admins keep control of them.
        heading: 'Wear The Word',
        links: [
          ...content.navigation.main.filter((l) => l.href !== '/' && !panels.some((p) => p.href === l.href)),
          ...(content.navigation.main.some((l) => l.href === '/bulk') ? [] : [{ href: '/bulk', name: 'Bulk & Church Orders' }]),
        ],
      },
      { heading: 'Help', links: content.navigation.help.slice(0, 6) },
    ],
  });

  return panels;
}
