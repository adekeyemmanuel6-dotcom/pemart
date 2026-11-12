import type { Catalogue } from '@/lib/catalogue/types';
import { isBundleAvailable } from '@/lib/catalogue/helpers';
import type { WebsiteContent, WebsiteLink } from '@/lib/website/schema';

export type NavColumn = { heading: string; links: WebsiteLink[] };
export type NavFeature = { eyebrow: string; title: string; href: string; cta: string; image: string | null; imageAlt: string };
export type NavPanel = { id: string; label: string; href: string; columns: NavColumn[]; feature?: NavFeature };

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
  const products = cat?.products.filter((p) => p.is_active) ?? [];
  const has = (type: string) => products.some((p) => p.type === type);
  const bundles = (cat?.bundles ?? []).filter((b) => isBundleAvailable(b));
  const giftBoxes = bundles.filter((b) => b.kind === 'gift_box');
  const couples = bundles.filter((b) => b.kind === 'couple');

  const clothing = TYPE_LINKS.filter((t) => t.group === 'clothing' && has(t.type)).map(({ href, name }) => ({ href, name }));
  const lifestyle: WebsiteLink[] = [
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
