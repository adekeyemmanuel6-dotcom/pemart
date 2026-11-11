export const SITE = {
  name: 'Pemart',
  tagline: 'Wear what you believe.',
  description: 'Faith-inspired and message-led merch and gifts, made in Nigeria. Oversized tees, hoodies, frames, couple packs and Christmas gift boxes.',
};

// Static in Phase 1; Phase 2 reads collections from the database.
export const COLLECTION_LINKS = [
  { slug: 'kingdom', name: 'Kingdom', blurb: 'Scripture worn loud' },
  { slug: 'word', name: 'Word', blurb: 'Type-led verses' },
  { slug: 'naija-mood', name: 'Naija Mood', blurb: 'Faith, our way' },
  { slug: 'two-of-us', name: 'Two of Us', blurb: 'Matching for two' },
  { slug: 'christmas-drop', name: 'Christmas Drop', blurb: 'Limited season' },
  { slug: 'accessories', name: 'Accessories', blurb: 'Finish the look' },
] as const;

export const PRODUCT_TYPE_LINKS = [
  { href: '/collections/all?type=tee', name: 'Oversized tees' },
  { href: '/collections/all?type=hoodie', name: 'Hoodies' },
  { href: '/collections/all?type=frame', name: 'Wall frames' },
  { href: '/collections/accessories', name: 'Accessories' },
  { href: '/gift-cards', name: 'Gift cards' },
] as const;

export const MAIN_NAV = [
  { href: '/gift-boxes', name: 'Gift Boxes', highlight: true },
  { href: '/couples', name: 'Couples' },
  { href: '/custom', name: 'Design Your Own' },
  { href: '/bulk', name: 'Bulk Orders' },
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
