/**
 * Title Case for headings the owner types (and our own): every word starts with a capital, except short joining words
 * in the middle ("a", "of", "the"...). Hyphenated parts are capitalised too (Pre-Sale). Words already in capitals
 * (WhatsApp, NG, T-shirt's T) and words with digits or currency are left alone.
 */
const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'nor', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'as']);

const cap = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w);

export function toTitleCase(input: string): string {
  const words = input.split(/(\s+)/); // keep the spaces
  const idx = words.map((w, i) => (/\S/.test(w) ? i : -1)).filter((i) => i >= 0);
  const first = idx[0], last = idx[idx.length - 1];
  return words.map((w, i) => {
    if (!/\S/.test(w)) return w;
    if (/[0-9₦$€£]/.test(w) || (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w))) return w;
    const parts = w.split('-').map((p, k) => {
      const lower = p.toLowerCase();
      if (k === 0 && i !== first && i !== last && SMALL.has(lower.replace(/[^a-z]/g, ''))) return lower;
      if (/[A-Z]/.test(p.slice(1))) return cap(p);   // brand words with inner capitals (WhatsApp, iPhone): keep them
      return cap(lower);
    });
    return parts.join('-');
  }).join('');
}
