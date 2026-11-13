import type { SectionTemplate, WebsiteSection } from './schema';

export const TEMPLATE_INFO: Record<SectionTemplate, { label: string; detail: string }> = {
  text: { label: 'Text', detail: 'Small heading, heading, a paragraph and a link.' },
  image_text: { label: 'Image and text', detail: 'A photo beside your words, on the left or right.' },
  banner: { label: 'Image banner', detail: 'A full-width photo with centred heading and button.' },
  cta: { label: 'Call to action', detail: 'A bold strip with one message and a button.' },
  products: { label: 'Product grid', detail: 'Products from a collection, or the newest ones.' },
  faq: { label: 'Questions and answers', detail: 'Expandable questions, for delivery, sizing or gifting.' },
  quote: { label: 'Quote or testimonial', detail: 'A large quote with who said it.' },
};

const rand = () => Math.random().toString(36).slice(2, 8);

/** A new section from a template, filled with example words to replace. Hidden until you switch it on. */
export function newSection(template: SectionTemplate): WebsiteSection {
  const base: WebsiteSection = {
    id: `custom-${rand()}`, enabled: false, template, kicker: '', title: '', body: '', linkText: '', href: '/collections/all',
    secondaryText: '', secondaryHref: '/about', image: '', alt: '',
  };
  switch (template) {
    case 'text': return { ...base, kicker: 'Our promise', title: 'Made to carry the Word', body: 'Tell visitors something that matters to you.', linkText: 'Learn more', href: '/about' };
    case 'image_text': return { ...base, imageSide: 'left', kicker: 'Behind the design', title: 'Every piece starts with a verse', body: 'Share the story behind a collection or a product.', linkText: 'Shop the collection' };
    case 'banner': return { ...base, kicker: 'Limited season', title: 'The Christmas collection', linkText: 'Shop now', style: { headingFont: 'default', bodyFont: 'default', headingCase: 'default', headingSize: 'default', background: 'black', align: 'center', spacing: 'default' } };
    case 'cta': return { ...base, title: 'Gifts that say what matters', body: 'Free gift wrap on every gift box this month.', linkText: 'Shop gift boxes', href: '/gift-boxes', style: { headingFont: 'default', bodyFont: 'default', headingCase: 'default', headingSize: 'm', background: 'gold', align: 'center', spacing: 'compact' } };
    case 'products': return { ...base, kicker: 'Just in', title: 'New this week', collection: '', limit: 4, linkText: 'Shop all' };
    case 'faq': return { ...base, kicker: 'Good to know', title: 'Questions, answered', items: [
      { title: 'How long does delivery take?', body: 'Ready designs ship within 2 working days. Delivery times depend on your city.' },
      { title: 'Can I return an item?', body: 'Ready designs can be exchanged within 7 days if unworn.' },
    ] };
    case 'quote': return { ...base, title: '“I wear it every Sunday and people always ask about the verse.”', body: 'Adaeze, Lagos', style: { headingFont: 'serif', bodyFont: 'default', headingCase: 'none', headingSize: 'm', background: 'ivory', align: 'center', spacing: 'default' } };
  }
}
