/** Naira typed in a form ("22,000", "₦22000.50") -> kobo, without floating-point drift. Empty -> null. Invalid -> undefined. */
export function nairaToKobo(input: string): number | null | undefined {
  const v = input.replace(/[,₦\s]/g, '');
  if (v === '') return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return undefined;
  const neg = v.startsWith('-');
  const [n, f = ''] = v.replace('-', '').split('.');
  const kobo = Number(n) * 100 + Number(f.padEnd(2, '0'));
  return neg ? -kobo : kobo;
}
export const koboToNaira = (kobo: number | null | undefined): string => (kobo == null ? '' : (kobo / 100).toFixed(kobo % 100 === 0 ? 0 : 2));
