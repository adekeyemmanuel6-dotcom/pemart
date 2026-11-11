/**
 * Nigerian mobile numbers. Accepts 08031234567, 8031234567, +2348031234567,
 * 2348031234567 (spaces, dashes and brackets are ignored) and returns E.164
 * (+234...). Returns null when the number is not a valid Nigerian mobile.
 */
export function normaliseNigerianPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('234')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  // Mobile prefixes after the leading 0: 70x, 71x, 80x, 81x, 90x, 91x (10 digits total)
  return /^(70|71|80|81|90|91)\d{8}$/.test(d) ? `+234${d}` : null;
}

export const isNigerianPhone = (input: string) => normaliseNigerianPhone(input) !== null;
