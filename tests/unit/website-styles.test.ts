import { describe, expect, it } from 'vitest';
import { DEFAULT_WEBSITE, heroSettingsSchema, websiteSchema } from '@/lib/website/schema';
import { sectionLook } from '@/components/home/section-look';

const hero = DEFAULT_WEBSITE.sections.find((s) => s.id === 'hero')!;
const img = '/brand/wear-the-word-logo-black.png';
const slide = { desktop: img, laptop: '', phone: '', alt: 'Banner', kicker: '', title: '', ctaText: '', ctaHref: '/collections/all' };

describe('hero styles', () => {
  it('content published before hero styles existed still validates and keeps the split hero', () => {
    const old = structuredClone(DEFAULT_WEBSITE);
    old.sections = old.sections.map(({ hero: _h, style: _s, ...rest }) => rest as typeof rest);
    const parsed = websiteSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sections[0]!.hero).toBeUndefined();
  });

  it('fills defaults for a partly saved hero', () => {
    expect(heroSettingsSchema.parse({ layout: 'banner' })).toMatchObject({ layout: 'banner', slides: [], autoplay: true, interval: 6, banner: { overlay: 45 } });
  });

  it('slider needs 1–3 banners, each with a desktop image and a description', () => {
    const ok = (h: unknown) => heroSettingsSchema.safeParse(h).success;
    expect(ok({ layout: 'slider', slides: [] })).toBe(false);
    expect(ok({ layout: 'slider', slides: [slide] })).toBe(true);
    expect(ok({ layout: 'slider', slides: [slide, slide, slide, slide] })).toBe(false);
    expect(ok({ layout: 'slider', slides: [{ ...slide, desktop: '' }] })).toBe(false);
    expect(ok({ layout: 'slider', slides: [{ ...slide, alt: ' ' }] })).toBe(false);
    // Unfinished banners do not block publishing while another hero style is selected.
    expect(ok({ layout: 'split', slides: [{ ...slide, desktop: '', alt: '' }] })).toBe(true);
  });

  it('rejects unsafe banner links and images from other sites', () => {
    const ok = (s: object) => heroSettingsSchema.safeParse({ layout: 'slider', slides: [{ ...slide, ...s }] }).success;
    expect(ok({ ctaHref: 'javascript:alert(1)' })).toBe(false);
    expect(ok({ desktop: 'https://evil.example/x.jpg' })).toBe(false);
    expect(ok({ phone: 'https://abc.supabase.co/storage/v1/object/public/catalogue/p.jpg' })).toBe(true);
  });

  it('banner image needs a description', () => {
    expect(heroSettingsSchema.safeParse({ layout: 'banner', banner: { desktop: img, laptop: '', phone: '', alt: '', overlay: 40 } }).success).toBe(false);
  });
});

describe('section looks', () => {
  const sec = (id: string, style?: object) => ({ ...hero, id, style }) as typeof hero;

  it('default style keeps the built-in design', () => {
    expect(sectionLook(sec('featured')).className).toBe('ws ws-align-left');
    expect(sectionLook(sec('featured')).style).toEqual({});
    expect(sectionLook(sec('philosophy')).dark).toBe(true);
  });

  it('newsletter is centred by default', () => {
    expect(sectionLook(sec('newsletter')).align).toBe('center');
    expect(sectionLook(sec('newsletter', { align: 'left' })).align).toBe('left');
  });

  it('applies fonts, case, size, background and spacing', () => {
    const look = sectionLook(sec('story', { headingFont: 'serif', bodyFont: 'serif', headingCase: 'none', headingSize: 'xl', background: 'gold', align: 'center', spacing: 'roomy' }));
    expect(look.className.split(' ')).toEqual(expect.arrayContaining(['ws-bg-gold', 'ws-align-center', 'ws-space-roomy', 'ws-case-none', 'ws-size-xl']));
    expect(look.style).toMatchObject({ fontFamily: expect.stringContaining('Georgia'), '--font-display': expect.stringContaining('Georgia') });
    expect(sectionLook(sec('philosophy', { background: 'white' })).dark).toBe(false);
  });

  it('rejects unknown style values', () => {
    const bad = structuredClone(DEFAULT_WEBSITE);
    (bad.sections[1] as { style?: unknown }).style = { background: 'url(javascript:alert(1))' };
    expect(websiteSchema.safeParse(bad).success).toBe(false);
  });
});
