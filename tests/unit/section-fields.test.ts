import { describe, expect, it } from 'vitest';
import { SECTION_INFO, sectionInfo, showsField, showsImage } from '@/lib/website/section-fields';
import { SECTION_IDS, type WebsiteSection } from '@/lib/website/schema';

const sec = (id: string, over: Partial<WebsiteSection> = {}) => ({ id, enabled: true, kicker: '', title: '', body: '', linkText: '', href: '', image: '', alt: '', ...over }) as WebsiteSection;

describe('what the homepage editor offers per section', () => {
  it('every built-in section has a plain name and help text', () => {
    for (const id of SECTION_IDS) { expect(SECTION_INFO[id], id).toBeTruthy(); expect(SECTION_INFO[id]!.name.length).toBeGreaterThan(2); expect(SECTION_INFO[id]!.help.length).toBeGreaterThan(10); }
  });
  it('the manifesto strip is just its phrases: no eyebrow, text, button or picture', () => {
    const m = sec('manifesto');
    expect(showsField(m, 'title')).toBe(true);
    for (const k of ['kicker', 'body', 'linkText', 'href'] as const) expect(showsField(m, k)).toBe(false);
    expect(showsImage(m)).toBe(false);
  });
  it('collections and the newsletter do not offer text or button fields the storefront never shows', () => {
    expect(showsField(sec('collections'), 'body')).toBe(false);
    expect(showsField(sec('newsletter'), 'linkText')).toBe(false);
    expect(showsField(sec('community'), 'href')).toBe(false);
  });
  it('a field that already holds content stays editable, so nothing saved earlier becomes stuck', () => {
    expect(showsField(sec('manifesto', { body: 'old text' }), 'body')).toBe(true);
    expect(showsImage(sec('featured', { image: '/x.jpg' }))).toBe(true);
    expect(showsImage(sec('featured'))).toBe(false);
  });
  it('a leftover button destination without a button label is not shown, but with a label it is', () => {
    expect(showsField(sec('manifesto', { href: '/collections/all' }), 'href')).toBe(false);
    expect(showsField(sec('manifesto', { href: '/collections/all', linkText: 'Shop' }), 'href')).toBe(true);
  });
  it('sections that do use everything keep everything; added sections and unknown ids are untouched', () => {
    for (const k of ['kicker', 'title', 'body', 'linkText', 'href'] as const) expect(showsField(sec('philosophy'), k)).toBe(true);
    expect(showsImage(sec('philosophy'))).toBe(true);
    expect(sectionInfo({ id: 'custom-1', template: 'text' } as never)).toBeNull();
    expect(showsField(sec('custom-1', { template: 'text' } as never), 'body')).toBe(true);
  });
});
