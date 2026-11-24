import type { WebsiteSection } from './schema';

type Key = 'kicker' | 'title' | 'body' | 'linkText' | 'href';
export type SectionInfo = {
  /** Plain name shown in the editor instead of the internal id. */
  name: string;
  /** One line telling the editor what this section shows and which parts matter. */
  help: string;
  /** The fields the storefront actually uses for this section (and the label to use for a few of them). */
  fields: Key[];
  labels?: Partial<Record<Key, string>>;
  /** Whether the section can show a picture. A picture that is already set is always shown so it can still be changed. */
  image: boolean;
};

const std: Key[] = ['kicker', 'title', 'body', 'linkText', 'href'];

/** What each built-in homepage section really displays, so the editor only offers the fields that do something. */
export const SECTION_INFO: Record<string, SectionInfo> = {
  hero: { name: 'Hero banner', help: 'The big banner at the top of the homepage.', fields: std, image: true },
  manifesto: { name: 'Manifesto strip', help: 'A strip of short phrases. Write one phrase per line.', fields: ['title'], labels: { title: 'Phrases (one per line)' }, image: false },
  collections: { name: 'Collections', help: 'Shows your collections as cards. The cards come from Collections, not from this text.', fields: ['kicker', 'title', 'linkText', 'href'], image: false },
  featured: { name: 'Featured products', help: 'Shows products from your catalogue (choose them below, or leave empty to use the shop ranking). The text only shows while no product is on sale.', fields: ['kicker', 'title', 'body', 'linkText', 'href'], labels: { body: 'Text shown only while there are no products on sale' }, image: false },
  philosophy: { name: 'Our philosophy', help: 'A statement section: small heading, heading, text and an optional button.', fields: std, image: true },
  themes: { name: 'Shop by theme', help: 'Shows the list of themes. The themes themselves are fixed; you edit the words around them.', fields: std, image: false },
  gifts: { name: 'Gifts', help: 'Shows your gift boxes. The boxes come from the catalogue. The text only shows while no gift box is on sale.', fields: ['kicker', 'title', 'body', 'linkText', 'href'], labels: { body: 'Text shown only while there are no gift boxes on sale' }, image: false },
  story: { name: 'Story', help: 'Shows the story of one of your words, taken from its design. Edit the words around it here.', fields: std, image: true },
  together: { name: 'Together', help: 'A section about couples and community.', fields: std, image: true },
  community: { name: 'Community', help: 'Your community photos (add them in the Community photos tab) with a heading above.', fields: ['kicker', 'title', 'body'], image: false },
  bulk: { name: 'Bulk and church orders', help: 'A call to action for group orders.', fields: std, image: true },
  newsletter: { name: 'Newsletter sign-up', help: 'The email sign-up form with a heading above it.', fields: ['kicker', 'title', 'body'], image: false },
};

export const sectionInfo = (s: Pick<WebsiteSection, 'id' | 'template'>): SectionInfo | null => (s.template ? null : SECTION_INFO[s.id] ?? null);
/** A field is shown when the section uses it, or when it already has content (so nothing saved earlier becomes uneditable). A button destination only counts when there is a button label. */
export const showsField = (s: WebsiteSection, key: Key): boolean => {
  const i = sectionInfo(s);
  if (!i || i.fields.includes(key)) return true;
  if (key === 'href') return Boolean(s.linkText?.trim());
  return Boolean((s[key] as string | undefined)?.trim());
};
export const showsImage = (s: WebsiteSection): boolean => { const i = sectionInfo(s); return !i || i.image || Boolean(s.image); };
