import type { DeliveryZone } from './catalogue/types';

export const FREE_DELIVERY_KOBO = 20_000_000;
export const SHIPPING_PENDING = 'Delivery fee will be confirmed by our team before order confirmation.';
export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
] as const;
export const normalizeDestination = (s: string) =>
  /^(abuja|fct|fct\s*\(abuja\)|federal capital territory)$/i.test(s.trim()) ? 'fct' : s.trim().toLowerCase();

export function matchingRates(zones: DeliveryZone[], state: string, city: string) {
  if (!city.trim() || !NIGERIAN_STATES.some((s) => normalizeDestination(s) === normalizeDestination(state))) return [];
  const matching = zones.filter(
    (z) =>
      z.is_active !== false &&
      z.rate_verified === true &&
      z.states.some((s) => normalizeDestination(s) === normalizeDestination(state)) &&
      (!z.cities?.length || z.cities.some((c) => normalizeDestination(c) === normalizeDestination(city))) &&
      Number.isSafeInteger(z.fee_kobo) &&
      z.fee_kobo >= 0,
  );
  return matching.sort(
    (a, b) =>
      Number(!!b.cities?.length) - Number(!!a.cities?.length) ||
      a.sort_order - b.sort_order ||
      a.id.localeCompare(b.id),
  );
}

/** Weight must come from catalogue records, never a browser-supplied parcel weight. */
export function shippingQuote(
  zones: DeliveryZone[],
  state: string,
  city: string,
  merchandiseKobo: number,
  threshold = FREE_DELIVERY_KOBO,
  rateId?: string,
  weightGrams: number | null = null,
) {
  const options = matchingRates(zones, state, city);
  const zone = rateId ? options.find((z) => z.id === rateId) : options[0];
  if (!zone) return { zone: null, feeKobo: 0, pending: true, free: false, options };
  const free = zone.free_shipping_eligible !== false && merchandiseKobo >= threshold;
  // A weight-limited service cannot be priced without verified product weights.
  if (zone.weight_allowance_grams != null && weightGrams == null)
    return { zone, feeKobo: 0, pending: true, free, options };
  let fee = zone.fee_kobo;
  if (zone.weight_allowance_grams != null && weightGrams != null && weightGrams > zone.weight_allowance_grams) {
    if (zone.additional_kg_kobo == null) return { zone, feeKobo: 0, pending: true, free, options };
    fee += Math.ceil((weightGrams - zone.weight_allowance_grams) / 1000) * zone.additional_kg_kobo;
  }
  return { zone, feeKobo: free ? 0 : fee, pending: false, free, options };
}
