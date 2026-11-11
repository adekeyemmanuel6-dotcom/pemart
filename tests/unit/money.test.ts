import { describe, expect, it } from 'vitest';
import { clampKobo, formatNaira, nairaToKobo, percentOf, sumKobo } from '@/lib/money';

describe('formatNaira', () => {
  it('formats whole Naira with thousands separators', () => {
    expect(formatNaira(2200000)).toBe('₦22,000');
    expect(formatNaira(10500000)).toBe('₦105,000');
    expect(formatNaira(0)).toBe('₦0');
  });
  it('shows kobo only when present', () => {
    expect(formatNaira(2200050)).toBe('₦22,000.50');
    expect(formatNaira(5)).toBe('₦0.05');
  });
  it('handles negatives (e.g. a discount line)', () => {
    expect(formatNaira(-250000)).toBe('-₦2,500');
  });
  it('rejects floats', () => {
    expect(() => formatNaira(10.5)).toThrow();
  });
});

describe('kobo arithmetic', () => {
  it('converts Naira to kobo without float drift', () => {
    expect(nairaToKobo(22000)).toBe(2200000);
    expect(nairaToKobo(19.99)).toBe(1999);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
  });
  it('rounds percentages half-up to a whole kobo', () => {
    expect(percentOf(2200000, 10)).toBe(220000);
    expect(percentOf(3333, 10)).toBe(333);
    expect(percentOf(3335, 10)).toBe(334);
  });
  it('sums and clamps', () => {
    expect(sumKobo([2200000, 600000, 350000])).toBe(3150000);
    expect(clampKobo(500000, 0, 300000)).toBe(300000);
    expect(() => sumKobo([1, 1.5])).toThrow();
  });
});
