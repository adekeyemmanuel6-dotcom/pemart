import { describe, expect, it } from 'vitest';
import { DEFAULT_WEBSITE, heroSettingsSchema, websiteSchema } from '@/lib/website/schema';
import { describeIssue } from '@/lib/website/issues';

const img = '/brand/wear-the-word-logo-black.png';
const slide = (o = {}) => ({ desktop: img, laptop: '', phone: '', alt: '', kicker: '', title: '', ctaText: '', ctaHref: '/collections/all', ...o });
const withHero = (hero: unknown) => {
  const c = structuredClone(DEFAULT_WEBSITE) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  c.sections[0].hero = hero;
  return c;
};

describe('publishing the hero', () => {
  it('banners without an image description now publish (the heading is used instead)', () => {
    const c = withHero({ layout: 'slider', slides: [slide({ title: 'New season' }), slide()], autoplay: true, interval: 6 });
    expect(websiteSchema.safeParse(c).success).toBe(true);
  });
  it('the small heading allows up to 120 characters', () => {
    expect(heroSettingsSchema.safeParse({ layout: 'slider', slides: [slide({ kicker: 'x'.repeat(100) })] }).success).toBe(true);
    expect(heroSettingsSchema.safeParse({ layout: 'slider', slides: [slide({ kicker: 'x'.repeat(121) })] }).success).toBe(false);
  });
  it('errors say where to look, in plain words', () => {
    const c = withHero({ layout: 'slider', slides: [slide({ kicker: 'x'.repeat(130) }), slide({ desktop: '' })], autoplay: true, interval: 6 });
    const r = websiteSchema.safeParse(c);
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((e) => describeIssue(e.path, e.message, c));
    expect(msgs).toContain('Homepage › hero › Banner 1 › Small heading is too long (maximum 120 characters)');
    expect(msgs).toContain('Homepage › hero › Banner 2: Banner 2 needs a desktop image.');
  });
});
