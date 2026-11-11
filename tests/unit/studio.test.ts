import { describe, expect, it } from 'vitest';
import { cutoffStatus, cutoffInstant } from '@/lib/countdown';
import { normaliseNigerianPhone } from '@/lib/validators/phone';
import { customRequestSchema } from '@/lib/custom/schema';
import { TIERS } from '@/lib/custom/tiers';

describe('nigerian phone numbers', () => {
  it.each([['08031234567', '+2348031234567'], ['+234 803 123 4567', '+2348031234567'], ['2348031234567', '+2348031234567'], ['0701-234-5678', '+2347012345678'], ['9012345678', '+2349012345678']])('%s -> %s', (i, o) => expect(normaliseNigerianPhone(i)).toBe(o));
  it.each(['', '12345', '0803123456', '08031234567890', '0603123456 7', '+1 415 555 0100', 'abc'])('rejects %s', (i) => expect(normaliseNigerianPhone(i)).toBeNull());
});

describe('christmas cutoff countdown', () => {
  it('is open before the end of the cutoff day (Lagos time)', () => {
    const s = cutoffStatus('2026-12-17', new Date('2026-12-17T22:30:00+01:00'));
    expect(s.state).toBe('open');
    if (s.state === 'open') { expect(s.days).toBe(0); expect(s.hours).toBe(1); expect(s.minutes).toBe(29); }
  });
  it('has passed one second after midnight', () => {
    expect(cutoffStatus('2026-12-17', new Date('2026-12-18T00:00:00+01:00')).state).toBe('passed');
  });
  it('counts whole days', () => {
    const s = cutoffStatus('2026-12-17', new Date('2026-11-11T12:00:00+01:00'));
    expect(s.state === 'open' && s.days).toBe(36);
    expect(cutoffInstant('2026-12-15').toISOString()).toBe('2026-12-15T22:59:59.000Z');
  });
});

describe('custom studio rules', () => {
  const base = { productType: 'tee', colour: 'Black', size: 'M', printPositions: 'back' } as const;
  it('prices tiers on the server constants', () => {
    expect([TIERS.personalise.feeKobo, TIERS.text_design.feeKobo, TIERS.full_custom.feeKobo]).toEqual([300000, 500000, 1500000]);
    expect([TIERS.personalise.proofHours, TIERS.text_design.proofHours, TIERS.full_custom.proofHours]).toEqual([12, 24, 48]);
  });
  it('personalise needs a design and a change', () => {
    expect(customRequestSchema.safeParse({ ...base, tier: 'personalise' }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'personalise', designSlug: 'seek-first' }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'personalise', designSlug: 'seek-first', name: 'Ada' }).success).toBe(true);
  });
  it('text design needs words and a style', () => {
    expect(customRequestSchema.safeParse({ ...base, tier: 'text_design', textLines: ['', ''] }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'text_design', textLines: ['GRACE'], typeStyle: 'heavy' }).success).toBe(true);
  });
  it('full custom needs an idea, and rights confirmation when uploading', () => {
    expect(customRequestSchema.safeParse({ ...base, tier: 'full_custom', notes: 'short' }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'full_custom', notes: 'A lion with a crown over Lagos', uploadPaths: ['guest/a/b.png'] }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'full_custom', notes: 'A lion with a crown over Lagos', uploadPaths: ['guest/a/b.png'], rightsConfirmed: true }).success).toBe(true);
  });
  it('rejects unknown colours, sizes and long lines', () => {
    expect(customRequestSchema.safeParse({ ...base, colour: 'Pink', tier: 'text_design', textLines: ['A'], typeStyle: 'heavy' }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...base, tier: 'text_design', textLines: ['x'.repeat(41)], typeStyle: 'heavy' }).success).toBe(false);
  });
});

import { fitLines } from '@/lib/custom/draft';
describe('studio text fitting', () => {
  it('shrinks long lines and never exceeds the max size', () => {
    const [short] = fitLines(['GRACE'], 'heavy', 'back');
    const [long] = fitLines(['GRACE UPON GRACE UPON GRACE'], 'heavy', 'back');
    expect(short!.size).toBeLessThanOrEqual(36);
    expect(long!.size).toBeLessThan(short!.size);
  });
  it('keeps total height inside the print area', () => {
    const lines = fitLines(['ONE', 'TWO', 'THREE', 'FOUR'], 'heavy', 'back');
    expect(lines.reduce((a, l) => a + l.size * 1.06, 0)).toBeLessThanOrEqual(112.01);
  });
  it('uses only the first line on the chest and applies casing by style', () => {
    expect(fitLines(['one', 'two'], 'heavy', 'front').map((l) => l.text)).toEqual(['ONE']);
    expect(fitLines(['Mixed Case'], 'script', 'back')[0]!.text).toBe('Mixed Case');
  });
  it('ignores empty lines', () => { expect(fitLines(['', '  ', 'HI'], 'heavy', 'back').length).toBe(1); });
});
