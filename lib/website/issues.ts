import type { WebsiteContent } from './schema';
import { TEMPLATE_INFO } from './templates';

const FIELD: Record<string, string> = {
  kicker: 'Small heading', title: 'Heading', body: 'Text', linkText: 'Button text', href: 'Button destination',
  secondaryText: 'Second button text', secondaryHref: 'Second button destination', image: 'Image', alt: 'Image description',
  ctaText: 'Button text', ctaHref: 'Destination', desktop: 'Desktop image', laptop: 'Laptop image', phone: 'Phone image',
  overlay: 'Darkening', interval: 'Seconds per banner', label: 'Menu label', heading: 'Column heading', name: 'Name',
  slug: 'Web address', intro: 'Introduction', seoDescription: 'Search description', seoTitle: 'Search title',
  ogImage: 'Social sharing image', footer: 'Footer description', copyright: 'Copyright', byline: 'Byline',
  logoOnLight: 'Logo on light backgrounds', logoOnDark: 'Logo on dark backgrounds', caption: 'Caption', blurb: 'Description',
};
const TAB: Record<string, string> = { brand: 'Brand & SEO', sections: 'Homepage', megaMenu: 'Mega menu', navigation: 'Navigation', collections: 'Collections', community: 'Community photos', pages: 'Pages' };

/** Turn zod's wording into plain English. */
function plain(message: string): string {
  const tooBig = message.match(/Too big: expected (?:string|array) to have <=\s*(\d+)/i);
  if (tooBig) return message.includes('array') ? `has too many items (maximum ${tooBig[1]})` : `is too long (maximum ${tooBig[1]} characters)`;
  const tooSmall = message.match(/Too small: expected string to have >=\s*(\d+)/i);
  if (tooSmall) return tooSmall[1] === '1' ? 'cannot be empty' : `is too short (at least ${tooSmall[1]} characters)`;
  if (/Invalid (input|option)/i.test(message)) return 'has a value that is not allowed';
  return message;
}

/**
 * "sections.0.hero.slides.0.kicker: Too big…" → "Homepage › hero › Banner 1 › Small heading is too long (maximum 120 characters)".
 * Uses the content being published to name sections the way the editor shows them.
 */
export function describeIssue(path: PropertyKey[], message: string, content: unknown): string {
  const c = content as Partial<WebsiteContent> | null;
  const parts: string[] = [];
  let i = 0;
  const top = String(path[0] ?? '');
  if (TAB[top]) { parts.push(TAB[top]); i = 1; }
  if (top === 'sections' && typeof path[1] === 'number') {
    const sec = c?.sections?.[path[1]];
    parts.push(sec?.template ? `${TEMPLATE_INFO[sec.template]?.label ?? 'Added'} section` : String(sec?.id ?? `section ${path[1] + 1}`));
    i = 2;
  } else if (top === 'pages' && typeof path[1] === 'number') {
    parts.push(c?.pages?.[path[1]]?.title || `page ${path[1] + 1}`); i = 2;
  } else if (top === 'megaMenu' && path[1] === 'panels' && typeof path[2] === 'number') {
    parts.push(c?.megaMenu?.panels?.[path[2]]?.label || `menu item ${path[2] + 1}`); i = 3;
  }
  let field = '';
  for (; i < path.length; i++) {
    const p = path[i]!, next = path[i + 1];
    if (p === 'hero' || p === 'style' || p === 'feature') continue;
    if (p === 'slides' && typeof next === 'number') { parts.push(`Banner ${next + 1}`); i++; continue; }
    if (p === 'banner') { parts.push('Banner'); continue; }
    if (p === 'items' && typeof next === 'number') { parts.push(`Question ${next + 1}`); i++; continue; }
    if (p === 'columns' && typeof next === 'number') { parts.push(`Column ${next + 1}`); i++; continue; }
    if (p === 'links' && typeof next === 'number') { parts.push(`Link ${next + 1}`); i++; continue; }
    if (typeof p === 'number') { parts.push(`item ${p + 1}`); continue; }
    field = FIELD[String(p)] ?? String(p);
  }
  const where = parts.join(' › ');
  const what = plain(message);
  // Custom messages are already full sentences ("Banner 1 needs a desktop image.").
  if (/[.!?]$/.test(what)) return where ? `${where}: ${what}` : what;
  return `${where}${where && field ? ' › ' : ''}${field}${field || where ? ' ' : ''}${what}`.trim();
}
