import { describe, expect, it } from 'vitest';
import { NIGERIAN_STATES, shippingQuote } from '@/lib/shipping';
import { priceCart } from '@/lib/checkout/pricing';
import type { DeliveryZone } from '@/lib/catalogue/types';
import { cat, SETTINGS, tee, line, discountCtx, variantOf } from '../helpers/checkout';

// Synthetic rates are test data only, never production configuration.
const rate: DeliveryZone = {
  id: 'rate',
  name: 'Test service',
  states: ['Ondo'],
  cities: [],
  fee_kobo: 500000,
  free_over_kobo: null,
  lead_days: 4,
  min_days: 2,
  max_days: 4,
  christmas_cutoff_date: null,
  sort_order: 0,
  rate_verified: true,
  is_active: true,
  free_shipping_eligible: true,
};
describe('nationwide shipping', () => {
  it('lists all 36 states and the FCT once', () => {
    expect(new Set(NIGERIAN_STATES).size).toBe(37);
  });
  it.each([
    [19999999, 500000],
    [20000000, 0],
    [22000000, 0],
  ])('charges correctly at the exact threshold: %i kobo', (subtotal, fee) => {
    expect(shippingQuote([rate], 'Ondo', 'Akure', subtotal).feeKobo).toBe(fee);
  });
  it('does not use an unrelated or unverified rate', () => {
    expect(shippingQuote([rate], 'Lagos', 'Ikeja', 25000000).pending).toBe(true);
    expect(shippingQuote([{ ...rate, rate_verified: false }], 'Ondo', 'Akure', 100).pending).toBe(true);
    expect(shippingQuote([{ ...rate, is_active: false }], 'Ondo', 'Akure', 100).pending).toBe(true);
    expect(shippingQuote([rate], 'Ondo', '', 100).pending).toBe(true);
  });
  it('matches cities case-insensitively and prefers city-specific service', () => {
    const city = { ...rate, id: 'city', cities: ['Akure'] };
    expect(shippingQuote([rate, city], ' ondo ', ' AKURE ', 100).zone?.id).toBe('city');
    expect(shippingQuote([city], 'Ondo', 'Owo', 100).pending).toBe(true);
  });
  it('validates provider selection for the destination', () => {
    expect(shippingQuote([rate], 'Ondo', 'Akure', 100, 20000000, 'wrong').pending).toBe(true);
  });
  it.each(['FCT', 'Abuja', 'FCT (Abuja)', 'Federal Capital Territory', ' fct (ABUJA) '])('accepts FCT alias %s on either side', (alias) => {
    expect(shippingQuote([{ ...rate, states: ['FCT'] }], alias, 'Garki', 100).pending).toBe(false);
    expect(shippingQuote([{ ...rate, states: [alias] }], 'FCT', 'Garki', 100).pending).toBe(false);
    expect(shippingQuote([{ ...rate, states: [alias], rate_verified: false }], 'FCT', 'Garki', 100).pending).toBe(true);
  });
  it('supports service exclusions and verified weight charges', () => {
    expect(shippingQuote([{ ...rate, free_shipping_eligible: false }], 'Ondo', 'Akure', 22000000).feeKobo).toBe(500000);
    const weighted = { ...rate, weight_allowance_grams: 1000, additional_kg_kobo: 200000 };
    expect(shippingQuote([weighted], 'Ondo', 'Akure', 100).pending).toBe(true);
    expect(shippingQuote([weighted], 'Ondo', 'Akure', 100, 20000000, undefined, 2100).feeKobo).toBe(900000);
    expect(
      shippingQuote([{ ...weighted, additional_kg_kobo: null }], 'Ondo', 'Akure', 100, 20000000, undefined, 2100)
        .pending,
    ).toBe(true);
  });
  it('excludes gift cards and extras from the eligible merchandise amount', () => {
    const q = priceCart(
      { ...cat, zones: [rate] },
      SETTINGS,
      {},
      {
        state: 'Ondo',
        city: 'Akure',
        lines: [line(tee().id, 8), line(variantOf('GIFTCARD-25000').id, 2)],
        extras: { giftWrap: true },
      },
    );
    expect(q.eligibleMerchandiseKobo).toBe(17600000);
    expect(q.deliveryFeeKobo).toBe(500000);
    expect(q.freeDeliveryAwayKobo).toBe(2400000);
  });
  it('applies discounts before evaluating free shipping', () => {
    const q = priceCart({ ...cat, zones: [rate] }, SETTINGS, discountCtx(), {
      state: 'Ondo',
      city: 'Akure',
      code: 'PEMART10',
      lines: [line(tee().id, 10)],
    });
    expect(q.eligibleMerchandiseKobo).toBe(19800000);
    expect(q.deliveryFeeKobo).toBe(500000);
  });
  it('blocks checkout without a confirmed rate and supplies no made-up estimate', () => {
    const q = priceCart({ ...cat, zones: [] }, SETTINGS, {}, { state: 'Ondo', city: 'Akure', lines: [line(tee().id)] });
    expect(q.ok).toBe(false);
    expect(q.shippingPending).toBe(true);
    expect(q.promise.readyBy).toBeNull();
  });
});
