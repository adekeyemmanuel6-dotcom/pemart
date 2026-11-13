import { z } from 'zod';
import pageDefaults from './page-defaults.json';
import { BRAND_COLLECTIONS } from '@/lib/brand';
import { MAIN_NAV, HELP_LINKS, SITE } from '@/lib/site';

export const safeHref = z
  .string()
  .max(1000)
  .refine((s) => {
    if (Array.from(s).some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 92)) return false;
    if (s.startsWith('/') && !s.startsWith('//')) return true;
    try {
      const u = new URL(s);
      return u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Use a site path beginning with / or a secure https:// URL.');
const text = z.string().trim().max(500);
export const imageHref = safeHref.refine((s) => {
  if (s.startsWith('/')) return true;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  return u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/public/');
}, 'Upload an image or use a public Supabase Storage image URL.');
const image = z.union([z.literal(''), imageHref]);
const link = z.object({ name: text.min(1).max(40), href: safeHref });
export const SECTION_IDS = [
  'hero',
  'manifesto',
  'collections',
  'featured',
  'philosophy',
  'themes',
  'gifts',
  'story',
  'together',
  'community',
  'bulk',
  'newsletter',
] as const;
// ---- Per-section look. Every field has a "default" that keeps the built-in design, so older content is unchanged.
export const sectionStyleSchema = z.object({
  headingFont: z.enum(['default', 'display', 'sans', 'serif']).default('default'),
  bodyFont: z.enum(['default', 'sans', 'serif']).default('default'),
  headingCase: z.enum(['default', 'upper', 'none']).default('default'),
  headingSize: z.enum(['default', 's', 'm', 'l', 'xl']).default('default'),
  background: z.enum(['default', 'white', 'ivory', 'black', 'gold']).default('default'),
  align: z.enum(['default', 'left', 'center']).default('default'),
  spacing: z.enum(['default', 'compact', 'roomy']).default('default'),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export const DEFAULT_SECTION_STYLE: SectionStyle = sectionStyleSchema.parse({});

// ---- Homepage hero layouts. Images per device: desktop (≥1280px), laptop (768–1279px), phone (<768px).
const heroImages = z.object({ desktop: image, laptop: image, phone: image, alt: text.max(200) });
const heroSlide = heroImages.extend({
  kicker: text.max(60).default(''),
  title: text.max(120).default(''),
  ctaText: text.max(40).default(''),
  ctaHref: safeHref.default('/collections/all'),
});
export const heroSettingsSchema = z
  .object({
    layout: z.enum(['split', 'slider', 'banner']).default('split'),
    slides: z.array(heroSlide).max(3).default([]),
    banner: heroImages.extend({ overlay: z.number().int().min(0).max(80).default(45) }).default({ desktop: '', laptop: '', phone: '', alt: '', overlay: 45 }),
    autoplay: z.boolean().default(true),
    interval: z.number().int().min(3).max(15).default(6),
  })
  .superRefine((h, ctx) => {
    if (h.layout === 'slider' && h.slides.length === 0)
      ctx.addIssue({ code: 'custom', path: ['slides'], message: 'Add at least one banner to the slider, or choose another hero style.' });
    h.slides.forEach((sl, i) => {
      if (h.layout === 'slider' && !sl.desktop) ctx.addIssue({ code: 'custom', path: ['slides', i, 'desktop'], message: `Banner ${i + 1} needs a desktop image.` });
      if ((sl.desktop || sl.laptop || sl.phone) && !sl.alt.trim())
        ctx.addIssue({ code: 'custom', path: ['slides', i, 'alt'], message: `Describe banner ${i + 1} for screen readers.` });
    });
    const b = h.banner;
    if ((b.desktop || b.laptop || b.phone) && !b.alt.trim())
      ctx.addIssue({ code: 'custom', path: ['banner', 'alt'], message: 'Describe the banner image for screen readers.' });
  });
export type HeroSettings = z.infer<typeof heroSettingsSchema>;
export type HeroSlide = HeroSettings['slides'][number];
export const DEFAULT_HERO: HeroSettings = heroSettingsSchema.parse({});

// ---- Sections added from templates (Website editor → Homepage → Add a section).
export const SECTION_TEMPLATES = ['text', 'image_text', 'banner', 'cta', 'products', 'faq', 'quote'] as const;
export type SectionTemplate = (typeof SECTION_TEMPLATES)[number];
export const CUSTOM_ID = /^custom-[a-z0-9]{3,16}$/;
export const MAX_CUSTOM_SECTIONS = 12;
const sectionId = z.union([z.enum(SECTION_IDS), z.string().regex(CUSTOM_ID)]);
export const isCustomSection = (id: string) => CUSTOM_ID.test(id);

const section = z.object({
  id: sectionId,
  enabled: z.boolean(),
  title: text,
  kicker: text,
  body: z.string().max(4000),
  linkText: text,
  href: safeHref,
  secondaryText: text,
  secondaryHref: safeHref,
  image: image,
  alt: text,
  style: sectionStyleSchema.optional(),
  hero: heroSettingsSchema.optional(),
  // Only for sections added from a template.
  template: z.enum(SECTION_TEMPLATES).optional(),
  imageSide: z.enum(['left', 'right']).optional(),
  items: z.array(z.object({ title: text.min(1).max(200), body: z.string().trim().max(2000) })).max(12).optional(),
  collection: z.string().trim().max(80).regex(/^[a-z0-9-]*$/).optional(),
  limit: z.number().int().min(2).max(12).optional(),
});
const page = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60),
  enabled: z.boolean(),
  title: text.min(1),
  kicker: text,
  intro: z.string().max(2000),
  body: z.string().max(30000),
  image: image,
  alt: text,
  seoDescription: z.string().max(300),
});
// ---- Mega menu (header navigation). Fixed depth: panel → column → link, so no circular nesting is possible.
const visibility = z.enum(['all', 'desktop', 'mobile']);
const menuLink = z.object({ name: text.min(1).max(40), href: safeHref, show: visibility });
const menuColumn = z.object({ heading: text.min(1).max(30), links: z.array(menuLink).min(1).max(10) });
const menuPanel = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes').max(30),
  label: text.min(1).max(24),
  href: safeHref,
  show: visibility,
  columns: z.array(menuColumn).min(1).max(4),
  feature: z.object({
    enabled: z.boolean(),
    eyebrow: text.max(40),
    title: text.max(60),
    cta: text.max(40),
    href: safeHref,
    image: image,
    alt: text.max(200),
  }),
});
export const megaMenuSchema = z
  .object({ mode: z.enum(['automatic', 'custom']), panels: z.array(menuPanel).max(6) })
  .superRefine((m, ctx) => {
    if (m.mode === 'custom' && m.panels.length === 0)
      ctx.addIssue({ code: 'custom', path: ['panels'], message: 'Add at least one menu item, or switch back to Automatic.' });
    const ids = m.panels.map((p) => p.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['panels'], message: 'Each menu item needs a different ID.' });
    m.panels.forEach((p, i) => {
      if (p.feature.enabled && p.feature.image && !p.feature.alt.trim())
        ctx.addIssue({ code: 'custom', path: ['panels', i, 'feature', 'alt'], message: 'Describe the menu image for screen readers.' });
      if (p.feature.enabled && !p.feature.title.trim())
        ctx.addIssue({ code: 'custom', path: ['panels', i, 'feature', 'title'], message: 'Give the featured card a title.' });
    });
  });
export type MegaMenu = z.infer<typeof megaMenuSchema>;
export type MegaMenuPanel = MegaMenu['panels'][number];

export const EXISTING_PAGES = [
  'about',
  'faq',
  'contact',
  'delivery',
  'returns',
  'terms',
  'privacy',
  'size-guide',
] as const;
export const websiteSchema = z
  .object({
    brand: z.object({
      palette: z.enum(['classic', 'earth', 'forest']),
      headingStyle: z.enum(['condensed', 'sans', 'serif']),
      name: text.min(1),
      byline: text,
      footer: z.string().max(2000),
      copyright: text,
      seoTitle: text.min(1),
      seoDescription: z.string().max(300),
      ogImage: image,
      // Empty = the built-in Wear The Word logo (black on light backgrounds, white on dark).
      logoOnLight: image.default(''),
      logoOnDark: image.default(''),
      maintenanceMessage: z.string().min(1).max(1000),
    }),
    navigation: z.object({
      main: z.array(link).max(8),
      shop: z.array(link).max(20),
      help: z.array(link).max(20),
      legal: z.array(link).max(8),
    }),
    sections: z
      .array(section)
      .max(SECTION_IDS.length + MAX_CUSTOM_SECTIONS, `Up to ${MAX_CUSTOM_SECTIONS} added sections.`)
      .refine((a) => SECTION_IDS.every((id) => a.filter((s) => s.id === id).length === 1), 'Each built-in homepage section must appear once.')
      .refine((a) => new Set(a.map((s) => s.id)).size === a.length, 'Each section needs a different ID.')
      .refine((a) => a.every((s) => !isCustomSection(s.id) || s.template), 'Added sections need a template.')
      .refine((a) => a.some((s) => s.id === 'hero' && s.enabled), 'Keep the homepage hero enabled.'),
    collections: z
      .array(
        z.object({
          slug: z.enum(['identity', 'declaration', 'scripture', 'together', 'word-gifts']),
          name: text.min(1),
          blurb: text,
          image: image,
          enabled: z.boolean(),
        }),
      )
      .length(5)
      .refine((a) => new Set(a.map((c) => c.slug)).size === 5),
    featuredProductIds: z.array(z.uuid()).max(12),
    // Optional so content published before the menu builder still validates; absent = automatic menu.
    megaMenu: megaMenuSchema.optional(),
    community: z
      .array(z.object({ image: imageHref, alt: text.min(1), caption: text, permission: z.literal(true) }))
      .max(12),
    pages: z
      .array(page)
      .max(30)
      .refine((a) => new Set(a.map((p) => p.slug)).size === a.length, 'Page addresses must be unique.'),
  })
  .superRefine((content, ctx) => {
    if (JSON.stringify(content).length > 180000)
      ctx.addIssue({
        code: 'custom',
        message: 'Website content is too large. Shorten page content or remove unused photographs.',
      });
    content.sections.forEach((s, i) => {
      if (s.image && !s.alt.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['sections', i, 'alt'],
          message: 'Describe the image for screen readers.',
        });
    });
    content.pages.forEach((p, i) => {
      if (p.image && !p.alt.trim())
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'alt'], message: 'Describe the image for screen readers.' });
      if (p.enabled && !p.body.trim())
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'body'], message: 'Add page content before enabling it.' });
    });
  });
export type WebsiteContent = z.infer<typeof websiteSchema>;
export type WebsiteSection = WebsiteContent['sections'][number];
export type WebsitePage = WebsiteContent['pages'][number];
export type WebsiteLink = z.infer<typeof link>;
const s = (
  id: WebsiteSection['id'],
  title: string,
  kicker = '',
  body = '',
  linkText = '',
  href = '/collections/all',
): WebsiteSection => ({
  id,
  title,
  kicker,
  body,
  linkText,
  href,
  enabled: true,
  secondaryText: '',
  secondaryHref: '/about',
  image: '',
  alt: '',
});
export const DEFAULT_WEBSITE: WebsiteContent = {
  brand: {
    palette: 'classic',
    headingStyle: 'condensed',
    name: 'Wear The Word',
    byline: 'BY PEMART GLOBAL',
    footer: 'Wear what you stand on. Christian lifestyle, apparel & gifting. From Akure, Nigeria.',
    copyright: 'Pemart Global. All rights reserved.',
    seoTitle: `${SITE.name} | ${SITE.tagline}`,
    seoDescription: SITE.description,
    ogImage: '',
    logoOnLight: '',
    logoOnDark: '',
    maintenanceMessage: 'We’re making a few updates and will be back shortly. Thank you for your patience.',
  },
  navigation: {
    main: MAIN_NAV.map((n) => ({ ...n })),
    shop: BRAND_COLLECTIONS.map((c) => ({
      name: c.name,
      href: c.slug === 'word-gifts' ? '/gift-boxes' : `/collections/${c.slug}`,
    })),
    help: HELP_LINKS.map((n) => ({ ...n })),
    legal: [
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms', href: '/terms' },
    ],
  },
  sections: [
    {
      ...s(
        'hero',
        'WEAR WHAT YOU STAND ON.',
        'Christian lifestyle. Everyday conviction.',
        'Your faith is more than what you believe. It’s what you live, represent and carry every day.',
        'Shop the collection',
      ),
      secondaryText: 'Discover our story',
    },
    s('manifesto', 'Believe it.\nLive it.\nWear it.\nShare it.'),
    s('collections', 'Find your expression.', '01 / A message for every season', '', 'All collections', '/collections'),
    s(
      'featured',
      'Pieces with purpose.',
      '02 / The everyday rotation',
      'Our collection is being prepared. Explore our story while we get it ready.',
      'Shop all',
    ),
    s(
      'philosophy',
      'The Word was never meant to be kept on a page.',
      'More than what you wear.',
      'Every season has a Word. A promise to hold on to. A truth to remember. A declaration to live by.\n\nAt Wear The Word, we turn those timeless truths into everyday expressions of faith.',
      'Why we wear the Word',
      '/about',
    ),
    s(
      'themes',
      'Find your Word.',
      '03 / What are you standing on?',
      'Start with a message that speaks to your season.',
    ),
    s(
      'gifts',
      'A gift. A Word. A reminder.',
      '04 / Give something that means something',
      'Thoughtful gifts for couples, families, moments of encouragement and the people who help you grow.',
      'Explore gift collections',
      '/gift-boxes',
    ),
    s(
      'story',
      'Every piece has a meaning.',
      'Designed to remind you.',
      'Discover the message, the inspiration and the intention behind our designs.',
      'Discover this design',
    ),
    s(
      'together',
      'Faith is better when shared.',
      'One faith. Many stories.',
      'His & hers. Parents & children. A family standing on the same Word. Choose individual sizes in our matching bundles.',
      'Shop matching collections',
      '/couples',
    ),
    s(
      'community',
      'Your faith. Your everyday.',
      'Worn. Lived. Shared.',
      'We would love to see how you wear your Word. Share your story with our team. Customer photographs appear here with permission.',
    ),
    s(
      'bulk',
      'Your church. Your community. One message.',
      'Made for your people',
      'Meaningful apparel for churches, ministries, conferences, schools and groups. Tell us your idea and quantity for a tailored quote.',
      'Request a bulk quote',
      '/bulk',
    ),
    s(
      'newsletter',
      'Stay rooted in the Word.',
      'A little inspiration for your everyday walk',
      'New collections, meaningful messages and exclusive releases.',
    ),
  ],
  collections: BRAND_COLLECTIONS.map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb, image: '', enabled: true })),
  featuredProductIds: [],
  community: [],
  pages: EXISTING_PAGES.map((slug) => ({
    slug,
    enabled: false,
    ...pageDefaults[slug],
    image: '',
    alt: '',
    seoDescription: '',
  })),
};

export function resolveWebsite(settings: {
  website_content?: unknown;
  hero_headline?: string;
  hero_copy?: string;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
}): WebsiteContent {
  const parsed = websiteSchema.safeParse(settings.website_content);
  if (parsed.success) return parsed.data;
  const result = structuredClone(DEFAULT_WEBSITE);
  const hero = result.sections[0]!;
  hero.title = settings.hero_headline || hero.title;
  hero.body = settings.hero_copy || hero.body;
  hero.image = settings.hero_image_url || '';
  hero.alt = settings.hero_image_alt || '';
  return result;
}
