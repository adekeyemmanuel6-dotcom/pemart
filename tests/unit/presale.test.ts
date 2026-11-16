import { describe, expect, it } from 'vitest';
import { toTitleCase } from '@/lib/presale/title-case';
import { PresaleConfigSchema, isLightColour, presaleImages, PresaleSubmitSchema, cleanItems, describeItems, itemQty, presaleDefaults, presaleState, resolvePresale, totalQty } from '@/lib/presale/schema';

const valid = { name: 'Ada Obi', email: 'ada@example.com', phone: '0803 123 4567', state: 'Ondo', city: 'Akure', items: [{ garment: 'tee', sizes: { M: 2 } }] };

describe('pre-sale settings', () => {
  it('parse from nothing: off by default, all three garments, sensible words', () => {
    const c = presaleDefaults();
    expect(c.enabled).toBe(false); expect(c.garments).toEqual(['tee', 'sweatshirt', 'hoodie']);
    expect(c.garmentLabels).toEqual({ tee: 'T-shirt', sweatshirt: 'Sweatshirt', hoodie: 'Hoodie' });
    expect(c.successText.length).toBeGreaterThan(20);
    expect(resolvePresale(undefined)).toEqual(c);
  });
  it('junk falls back to defaults instead of throwing, and partial edits keep the rest', () => {
    expect(resolvePresale({ enabled: 'maybe', offers: 12 }).enabled).toBe(false);
    expect(resolvePresale({ enabled: true, headline: 'Big sale' })).toMatchObject({ enabled: true, headline: 'Big sale', showBar: true });
  });
  it('rejects bad dates and more than four offers', () => {
    expect(PresaleConfigSchema.safeParse({ startsOn: '20/07/2026' }).success).toBe(false);
    expect(PresaleConfigSchema.safeParse({ offers: Array.from({ length: 5 }, (_, i) => ({ text: `o${i}`, price: '' })) }).success).toBe(false);
    expect(PresaleConfigSchema.safeParse({ startsOn: '2026-07-20', endsOn: '2026-08-01' }).success).toBe(true);
  });
  it('is open only when on and inside the Lagos date window', () => {
    const on = resolvePresale({ enabled: true, startsOn: '2026-07-20', endsOn: '2026-08-01' });
    expect(presaleState(resolvePresale({}), new Date('2026-07-25T12:00:00Z'))).toBe('off');
    expect(presaleState(on, new Date('2026-07-19T12:00:00Z'))).toBe('soon');
    expect(presaleState(on, new Date('2026-07-20T00:30:00+01:00'))).toBe('open');
    expect(presaleState(on, new Date('2026-08-01T23:30:00+01:00'))).toBe('open');     // the end day is inclusive
    expect(presaleState(on, new Date('2026-08-02T00:30:00+01:00'))).toBe('ended');
    expect(presaleState(resolvePresale({ enabled: true }), new Date('2030-01-01T00:00:00Z'))).toBe('open');   // no dates: runs until switched off
  });
});

describe('pre-sale request validation', () => {
  it('accepts a good request', () => { expect(PresaleSubmitSchema.safeParse(valid).success).toBe(true); });
  it('explains what is wrong, field by field', () => {
    const r = PresaleSubmitSchema.safeParse({ ...valid, name: 'A', email: 'nope', phone: '12345', state: '', city: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => String(i.path[0])).sort()).toEqual(['city', 'email', 'name', 'phone', 'state']);
  });
  it('rejects unknown garments and sizes, negative or huge quantities', () => {
    for (const items of [[{ garment: 'socks', sizes: { M: 1 } }], [{ garment: 'tee', sizes: { XXXL: 1 } }], [{ garment: 'tee', sizes: { M: -1 } }], [{ garment: 'tee', sizes: { M: 51 } }]]) {
      expect(PresaleSubmitSchema.safeParse({ ...valid, items }).success, JSON.stringify(items)).toBe(false);
    }
  });
});

describe('pre-sale items', () => {
  it('cleans, counts and describes', () => {
    const items = cleanItems([{ garment: 'hoodie', sizes: { S: 0, M: 2, XXL: 1 } }, { garment: 'tee', sizes: { L: 0 } }, { garment: 'sweatshirt', sizes: { XL: 3 } }]);
    expect(items).toEqual([{ garment: 'hoodie', sizes: { M: 2, XXL: 1 } }, { garment: 'sweatshirt', sizes: { XL: 3 } }]);
    expect(itemQty(items[0]!)).toBe(3); expect(totalQty(items)).toBe(6);
    expect(describeItems(items)).toEqual(['Hoodie: M × 2, XXL × 1', 'Sweatshirt: XL × 3']);
  });
});

describe('who gets the team notifications', () => {
  it('splits ADMIN_NOTIFY_EMAIL on commas, semicolons and spaces, drops junk and duplicates', async () => {
    const { parseRecipients } = await import('@/lib/notifications/recipients');
    expect(parseRecipients('peace@wearthewordbypemart.com, adekeyemmanuel6@gmail.com')).toEqual(['peace@wearthewordbypemart.com', 'adekeyemmanuel6@gmail.com']);
    expect(parseRecipients(' A@x.com;b@y.org  A@X.com not-an-email <c@z.com>')).toEqual(['a@x.com', 'b@y.org']);
    expect(parseRecipients('')).toEqual([]); expect(parseRecipients(undefined)).toEqual([]);
  });
});

describe('title case', () => {
  it('capitalises headings, keeps small words small in the middle, and leaves brands and prices alone', () => {
    expect(toTitleCase('limited drop')).toBe('Limited Drop');
    expect(toTitleCase('pre-sale')).toBe('Pre-Sale');
    expect(toTitleCase('big sale')).toBe('Big Sale');
    expect(toTitleCase('what would you like?')).toBe('What Would You Like?');
    expect(toTitleCase('the best of the year')).toBe('The Best of the Year');
    expect(toTitleCase('any two tees')).toBe('Any Two Tees');
    expect(toTitleCase('message us on WhatsApp')).toBe('Message Us on WhatsApp');
    expect(toTitleCase('ONLY 50 pieces for ₦30,000')).toBe('ONLY 50 Pieces for ₦30,000');
    expect(toTitleCase('  spaced   out  ')).toBe('  Spaced   Out  ');
    expect(toTitleCase('')).toBe('');
  });
});

describe('poster pictures and background', () => {
  it('uses the carousel list, falls back to the old single picture, and fills missing descriptions with the headline', () => {
    const c = resolvePresale({ headline: 'Big sale', images: [{ url: '/a.png', alt: '' }, { url: 'https://x.test/b.png', alt: 'B' }] });
    expect(presaleImages(c)).toEqual([{ url: '/a.png', alt: 'Big sale' }, { url: 'https://x.test/b.png', alt: 'B' }]);
    expect(presaleImages(resolvePresale({ imageUrl: '/old.png', imageAlt: 'Old' }))).toEqual([{ url: '/old.png', alt: 'Old' }]);
    expect(presaleImages(resolvePresale({}))).toEqual([]);
  });
  it('allows at most 10 pictures and only safe links', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `/p${i}.png`, alt: '' }));
    expect(PresaleConfigSchema.safeParse({ images: many(10) }).success).toBe(true);
    expect(PresaleConfigSchema.safeParse({ images: many(11) }).success).toBe(false);
    expect(PresaleConfigSchema.safeParse({ images: [{ url: 'javascript:alert(1)', alt: '' }] }).success).toBe(false);
  });
  it('validates colours and picks readable text', () => {
    expect(PresaleConfigSchema.safeParse({ bgColor: 'red' }).success).toBe(false);
    expect(PresaleConfigSchema.safeParse({ bgColor: '#C5A15D', bgColor2: '#292929' }).success).toBe(true);
    expect(PresaleConfigSchema.safeParse({ bgColor2: '#zzz' }).success).toBe(false);
    expect(isLightColour('#111111')).toBe(false); expect(isLightColour('#292929')).toBe(false);
    expect(isLightColour('#FFFFFF')).toBe(true); expect(isLightColour('#C5A15D')).toBe(true);   // gold takes dark text
    expect(presaleDefaults().bgColor).toBe('#111111');
  });
});
