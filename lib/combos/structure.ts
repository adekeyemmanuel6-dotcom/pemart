import { listedCollections } from './pairs';
import { startingPrice } from './pricing';
import type { ComboSettings } from './schema';
import type { ComboCatalogue } from './types';

/** One tile of the site's collection structure: BEHOLD, ABIDE, THE DOER'S, and the Couples Collection. */
export type SiteCollection = { key: string; name: string; tagline: string | null; image: string | null; href: string; fromKobo: number | null; couples: boolean };

/**
 * The collections the whole site is organised around, taken from the PUBLISHED combos:
 * each single-person collection in the owner's order, then one "Couples Collection" when any couples edition is published.
 * Empty until something is published, so nothing is invented.
 */
export function siteCollections(cat: ComboCatalogue, settings: ComboSettings): SiteCollection[] {
  const off = new Set(cat.unavailable);
  const editionsOfCouples = cat.collections.filter((c) => c.pair_of && cat.collections.some((x) => x.slug === c.pair_of));
  const singles = listedCollections(cat.collections).map((c): SiteCollection => ({ key: c.slug, name: c.name, tagline: c.tagline, image: c.image_url, href: `/combos/${c.slug}`, fromKobo: startingPrice(c, off), couples: false }));
  if (editionsOfCouples.length === 0) return singles;
  const prices = editionsOfCouples.map((c) => startingPrice(c, off)).filter((p): p is number => p !== null);
  return [...singles, {
    key: 'couples', name: settings.collections.couplesName, tagline: settings.collections.couplesTagline,
    image: settings.collections.couplesImageUrl || editionsOfCouples.find((c) => c.image_url)?.image_url || null,
    href: '/couples', fromKobo: prices.length ? Math.min(...prices) : null, couples: true,
  }];
}
