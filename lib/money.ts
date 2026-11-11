/**
 * Money helpers. ALL money in Pemart is integer kobo (1 NGN = 100 kobo).
 * Never store or compute with floats; convert only at the display edge.
 */
export type Kobo = number;

const assertKobo = (value: number, label = 'amount') => {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer number of kobo, got ${value}`);
};

/** Convert a whole-or-fractional Naira amount to kobo, rounded to the nearest kobo. */
export const nairaToKobo = (naira: number): Kobo => {
  if (!Number.isFinite(naira)) throw new Error('naira must be a finite number');
  return Math.round(naira * 100);
};

/** Format kobo for display: 2200000 -> "₦22,000", 2200050 -> "₦22,000.50". */
export const formatNaira = (kobo: Kobo): string => {
  assertKobo(kobo);
  const negative = kobo < 0;
  const abs = Math.abs(kobo);
  const naira = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = `₦${whole}${rem ? `.${rem.toString().padStart(2, '0')}` : ''}`;
  return negative ? `-${text}` : text;
};

/** Percentage of an amount, rounded half-up to the nearest kobo. percent may be fractional (e.g. 7.5). */
export const percentOf = (kobo: Kobo, percent: number): Kobo => {
  assertKobo(kobo);
  return Math.round((kobo * percent) / 100);
};

/** Sum a list of kobo amounts with integer checks. */
export const sumKobo = (amounts: Kobo[]): Kobo => amounts.reduce((a, b) => { assertKobo(b); return a + b; }, 0);

/** Never let a discount exceed what it applies to. */
export const clampKobo = (value: Kobo, min: Kobo, max: Kobo): Kobo => Math.min(Math.max(value, min), max);
