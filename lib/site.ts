export const SITE = {
  name: 'Wear The Word by Pemart Global',
  tagline: 'Wear what you stand on.',
  description: 'Christian lifestyle, apparel and gifting from Akure, Nigeria. Meaningful clothing, matching pieces and thoughtful gifts. The Word. Worn. Lived. Shared.',
};

// Static in Phase 1; Phase 2 reads collections from the database.
export { BRAND_COLLECTIONS as COLLECTION_LINKS } from '@/lib/brand';

export const PRODUCT_TYPE_LINKS = [
  { href: '/collections/all?type=tee', name: 'Oversized tees' },
  { href: '/collections/all?type=hoodie', name: 'Hoodies' },
  { href: '/collections/all?type=frame', name: 'Wall frames' },
  { href: '/collections/accessories', name: 'Accessories' },
  { href: '/gift-cards', name: 'Gift cards' },
] as const;

export const MAIN_NAV = [
  { href: '/', name: 'Home' },
  { href: '/collections', name: 'Collections' },
  { href: '/gift-boxes', name: 'Gift Boxes' },
  { href: '/about', name: 'Our Story' },
  { href: '/custom', name: 'Custom Orders' },
] as const;

export const HELP_LINKS = [
  { href: '/delivery', name: 'Delivery' },
  { href: '/returns', name: 'Returns and Exchanges' },
  { href: '/size-guide', name: 'Size Guide' },
  { href: '/faq', name: 'FAQ' },
  { href: '/track', name: 'Track Order' },
  { href: '/contact', name: 'Contact' },
] as const;

/** Build a wa.me click-to-chat link with a pre-filled message. */
export function whatsappLink(number: string | null | undefined, message: string) {
  const digits = (number ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
