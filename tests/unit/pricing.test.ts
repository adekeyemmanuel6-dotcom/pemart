import { describe, expect, it } from 'vitest';
import { cat, bundleSelection, discountCtx, line, NOW, price, SETTINGS, tee, variantOf } from '../helpers/checkout';

describe('basic pricing', () => {
  it('prices a ready tee to Lagos: ₦22,000 + ₦3,500 delivery', () => {
    const q = price({ lines: [line(tee().id)] });
    expect(q.ok).toBe(true);
    expect(q.subtotalKobo).toBe(2200000);
    expect(q.deliveryFeeKobo).toBe(350000);
    expect(q.totalKobo).toBe(2550000);
    expect(q.promise.readyBy?.slice(0, 10)).toBe('2026-11-16'); // 5 days out
  });
  it('quantities multiply; South-West and other states cost more', () => {
    expect(price({ lines: [line(tee().id, 3)] }).subtotalKobo).toBe(6600000);
    expect(price({ lines: [line(tee().id)], state: 'Ogun' }).deliveryFeeKobo).toBe(550000);
    expect(price({ lines: [line(tee().id)], state: 'Kano' }).deliveryFeeKobo).toBe(750000);
  });
  it('uses the variant price override (A3 frame costs more)', () => {
    const a3 = variantOf('SEEK-FIRST-FRAME-A3-WOOD');
    expect(price({ lines: [line(a3.id)] }).subtotalKobo).toBe(2500000);
  });
  it('free nationwide delivery at ₦200,000, and the progress bar distance', () => {
    const near = price({ lines: [line(tee().id, 3)] }); // ₦66,000
    expect(near.deliveryFeeKobo).toBe(350000);
    expect(near.freeDeliveryAwayKobo).toBe(13400000);     // ₦134,000 away
    const free = price({ lines: [line(tee().id, 10)] }); // ₦220,000
    expect(free.deliveryFeeKobo).toBe(0);
    expect(free.freeDeliveryAwayKobo).toBeNull();
    expect(price({ lines: [line(tee().id, 10)], state: 'Ogun' }).deliveryFeeKobo).toBe(0);
  });
  it('free delivery is judged after the discount', () => {
    const q = price({ lines: [line(tee().id, 11)], code: 'PEMART10' }, discountCtx()); // 88,000 - 8,800 = 79,200
    expect(q.deliveryFeeKobo).toBe(0);
    const q2 = price({ lines: [line(tee().id, 4)], code: 'BIG' }, discountCtx({ type: 'fixed', value: 1500000 })); // 73,000
    expect(q2.deliveryFeeKobo).toBe(350000);
  });
});

describe('the browser cannot set prices', () => {
  it('ignores any price fields smuggled into a line', () => {
    const tampered = { ...line(tee().id), priceKobo: 1, unitKobo: 1, price: 1, total: 1 };
    const q = price({ lines: [tampered] });
    expect(q.subtotalKobo).toBe(2200000);
    expect(q.totalKobo).toBe(2550000);
  });
  it('rejects unknown variants instead of pricing them', () => {
    const q = price({ lines: [line('00000000-0000-0000-0000-000000000000')] });
    expect(q.ok).toBe(false);
    expect(q.totalKobo).toBe(0 + q.deliveryFeeKobo);
    expect(q.issues.join()).toMatch(/no longer available/);
  });
  it('rejects absurd quantities', () => {
    expect(price({ lines: [line(tee().id, 500)] }).ok).toBe(false);
    expect(price({ lines: [line(tee().id, -2)] }).ok).toBe(false);
    expect(price({ lines: [line(tee().id, 1.5)] }).ok).toBe(false);
  });
  it('an empty bag cannot be ordered', () => { expect(price({ lines: [] }).ok).toBe(false); });
  it('the special offer price only works for the configured product, with another item in the bag', () => {
    const brace = variantOf('FAITH-BRACELET-CROSS');
    const ok = price({ lines: [line(tee().id), line(brace.id, 1, { upsell: true })] });
    expect(ok.ok).toBe(true);
    expect(ok.subtotalKobo).toBe(2200000 + 450000);
    const alone = price({ lines: [line(brace.id, 1, { upsell: true })] });
    expect(alone.lines[0]!.unitKobo).toBe(600000);                 // falls back to the normal price
    expect(alone.ok).toBe(false);
    const wrongProduct = price({ lines: [line(tee().id), line(variantOf('FAITH-BRACELET-CROSS').id, 1, { upsell: true }), line(variantOf('FASHION-GLASSES-SQUAREBLACK').id, 1, { upsell: true })] });
    expect(wrongProduct.ok).toBe(false);
    const qty = price({ lines: [line(tee().id), line(brace.id, 5, { upsell: true })] });
    expect(qty.lines[1]!.quantity).toBe(1);                        // offer is one per order
  });
});

describe('discount and ambassador codes', () => {
  it('takes 10% off the goods (not delivery)', () => {
    const q = price({ lines: [line(tee().id)], code: 'pemart10' }, discountCtx());
    expect(q.discount?.amountKobo).toBe(220000);
    expect(q.totalKobo).toBe(2200000 - 220000 + 350000);
  });
  it('fixed discounts never exceed the goods', () => {
    const q = price({ lines: [line(tee().id)], code: 'X' }, discountCtx({ type: 'fixed', value: 99900000 }));
    expect(q.discount?.amountKobo).toBe(2200000);
    expect(q.totalKobo).toBe(350000);
  });
  it.each([
    ['unknown', {}, 'not valid', false],
    ['not yet active', { starts_at: '2026-12-01T00:00:00Z' }, 'not active', true],
    ['expired', { ends_at: '2026-11-01T00:00:00Z' }, 'expired', true],
    ['fully used', { usage_limit: 5, times_used: 5 }, 'fully used', true],
    ['per-customer limit', { per_customer_limit: 1, customer_uses: 1 }, 'already used', true],
    ['min spend', { min_spend_kobo: 5000000 }, '₦50,000', true],
  ])('rejects a code that is %s', (_n, over, msg, hasCode) => {
    const q = price({ lines: [line(tee().id)], code: 'CODE' }, hasCode ? discountCtx(over as never) : {});
    expect(q.ok).toBe(false);
    expect(q.discount).toBeNull();
    expect(q.codeError).toContain(msg);
  });
  it('honours collection and product restrictions', () => {
    const kingdom = cat.collections.find((c) => c.slug === 'kingdom')!.id;
    const naija = cat.collections.find((c) => c.slug === 'naija-mood')!.id;
    const lines = [line(tee().id), line(variantOf('GOD-DEY-TEE-BLACK-M').id)];
    expect(price({ lines, code: 'K' }, discountCtx({ collection_ids: [kingdom] })).discount?.amountKobo).toBe(220000);   // only the Kingdom tee
    expect(price({ lines, code: 'N' }, discountCtx({ collection_ids: [naija] })).discount?.amountKobo).toBe(220000);
    expect(price({ lines: [line(tee().id)], code: 'N' }, discountCtx({ collection_ids: [naija] })).codeError).toMatch(/does not apply/);
  });
  it('does not discount gift cards', () => {
    const gc = variantOf('GIFTCARD-25000');
    const q = price({ lines: [line(gc.id)], code: 'PEMART10' }, discountCtx());
    expect(q.discount).toBeNull();
    expect(q.codeError).toMatch(/does not apply/);
  });
  it('ambassador codes give 10% and flag the commission', () => {
    const q = price({ lines: [line(tee().id)], code: 'GRACE10' }, discountCtx({ code: 'GRACE10', ambassador_id: 'a1', ambassador_rate: 0.1 }));
    expect(q.discount).toEqual({ code: 'GRACE10', amountKobo: 220000, ambassador: true });
    expect(q.ambassadorCode).toBe('GRACE10');
    expect(price({ lines: [line(tee().id)], code: 'PEMART10' }, discountCtx()).ambassadorCode).toBeNull();
  });
});

describe('bundles', () => {
  it('charges the bundle price, not the parts', () => {
    const q = price({ lines: [{ id: 'b1', kind: 'bundle', refId: 'signature', quantity: 1, selection: bundleSelection('signature') }] });
    expect(q.ok).toBe(true);
    expect(q.subtotalKobo).toBe(3750000);
    expect(q.hasBundle).toBe(true);
    expect(q.lines[0]!.contents.length).toBe(3);
  });
  it('blocks an incomplete selection and an expired gift box', () => {
    const sel = bundleSelection('signature'); sel.choices[0]!.size = undefined;
    expect(price({ lines: [{ id: 'b', kind: 'bundle', refId: 'signature', quantity: 1, selection: sel }] }).ok).toBe(false);
    const late = price({ lines: [{ id: 'b', kind: 'bundle', refId: 'joy-box', quantity: 1, selection: bundleSelection('joy-box') }] }, {}, new Date('2026-12-26T10:00:00+01:00'));
    expect(late.ok).toBe(false);
  });
  it('charges gift wrap per wrapped bundle', () => {
    const q = price({ lines: [{ id: 'b', kind: 'bundle', refId: 'starter', quantity: 2, selection: bundleSelection('starter', { giftWrap: true }) }] });
    expect(q.giftWrapKobo).toBe(400000);
  });
  it('reserves only stocked parts (not made-to-order garments), scaled by quantity', () => {
    const q = price({ lines: [{ id: 'b', kind: 'bundle', refId: 'starter', quantity: 2, selection: bundleSelection('starter') }] });
    expect(q.reservations.length).toBe(1);               // just the bracelet
    expect(q.reservations[0]!.qty).toBe(2);
  });
  it('a bundle with printed names cannot use express', () => {
    const q = price({ lines: [{ id: 'b', kind: 'bundle', refId: 'two-of-us-deluxe', quantity: 1, selection: bundleSelection('two-of-us-deluxe') }], extras: { express: true } });
    expect(q.ok).toBe(false);
  });
});

describe('add-ons', () => {
  it('gift wrap, surprise note (Lagos only) and express', () => {
    const q = price({ lines: [line(tee().id)], extras: { giftWrap: true, surpriseNote: true, express: true } });
    expect(q.giftWrapKobo).toBe(200000); expect(q.surpriseNoteKobo).toBe(300000); expect(q.expressKobo).toBe(500000);
    expect(q.totalKobo).toBe(2200000 + 350000 + 200000 + 300000 + 500000);
    expect(q.promise.readyBy?.slice(0, 10)).toBe('2026-11-16');  // express production does not invent a faster carrier estimate
    expect(price({ lines: [line(tee().id)], state: 'Ogun', extras: { surpriseNote: true } }).ok).toBe(false);
  });
  it('express can be switched off in settings', () => {
    expect(price({ lines: [line(tee().id)], extras: { express: true } }, {}, NOW, { ...SETTINGS, expressEnabled: false }).ok).toBe(false);
  });
});

describe('gift cards and store credit', () => {
  const gcCtx = (bal: number) => ({ gift_card: { id: 'g1', code: 'PG-AAAA', balance_kobo: bal, expires_at: null } });
  it('partly pays with a gift card', () => {
    const q = price({ lines: [line(tee().id)], giftCode: 'PG-AAAA' }, gcCtx(1000000));
    expect(q.giftCardAppliedKobo).toBe(1000000);
    expect(q.totalKobo).toBe(2550000 - 1000000);
    expect(q.giftCardId).toBe('g1');
  });
  it('a big gift card covers everything, leaving ₦0 to pay', () => {
    const q = price({ lines: [line(tee().id)], giftCode: 'PG-AAAA' }, gcCtx(9999999));
    expect(q.giftCardAppliedKobo).toBe(2550000);
    expect(q.totalKobo).toBe(0);
  });
  it('rejects invalid, empty and expired cards, and cards used to buy cards', () => {
    expect(price({ lines: [line(tee().id)], giftCode: 'X' }).giftCodeError).toMatch(/not valid/);
    expect(price({ lines: [line(tee().id)], giftCode: 'X' }, gcCtx(0)).giftCodeError).toMatch(/no balance/);
    expect(price({ lines: [line(tee().id)], giftCode: 'X' }, { gift_card: { id: 'g', code: 'X', balance_kobo: 5, expires_at: '2026-01-01T00:00:00Z' } }).giftCodeError).toMatch(/expired/);
    expect(price({ lines: [line(variantOf('GIFTCARD-10000').id)], giftCode: 'X' }, gcCtx(500)).giftCodeError).toMatch(/cannot be used/);
  });
  it('store credit applies after the gift card and only when chosen', () => {
    const ctx = { ...gcCtx(1000000), credit_kobo: 500000 };
    const off = price({ lines: [line(tee().id)], giftCode: 'X' }, ctx);
    expect(off.creditAppliedKobo).toBe(0);
    const on = price({ lines: [line(tee().id)], giftCode: 'X', useCredit: true }, ctx);
    expect(on.creditAppliedKobo).toBe(500000);
    expect(on.totalKobo).toBe(2550000 - 1000000 - 500000);
    expect(price({ lines: [line(tee().id)], useCredit: true }, { credit_kobo: 99999999 }).totalKobo).toBe(0);
  });
  it('buying a gift card has no delivery fee and needs no address', () => {
    const q = price({ lines: [line(variantOf('GIFTCARD-25000').id, 1, { giftCard: { recipientEmail: 'ada@example.com' } })], state: undefined });
    expect(q.digitalOnly).toBe(true);
    expect(q.deliveryFeeKobo).toBe(0);
    expect(q.totalKobo).toBe(2500000);
    expect(q.dbItems[0]!.kind).toBe('gift_card');
    expect(price({ lines: [line(variantOf('GIFTCARD-25000').id, 1, { giftCard: { recipientEmail: 'nope' } })] }).ok).toBe(false);
  });
});

describe('custom designs', () => {
  const req = (over = {}) => ({ id: 'c1', tier: 'text_design' as const, product_type: 'hoodie' as const, colour: 'Black', status: 'draft', in_use: false, text_fields: { size: 'M' }, design_id: null, ...over });
  it('charges garment + the server-side tier fee, and needs final-sale consent', () => {
    const lines = [{ id: 'l', kind: 'custom' as const, refId: 'c1', quantity: 1 }];
    const q = price({ lines, acceptFinalSale: false }, { customRequests: [req()] });
    expect(q.subtotalKobo).toBe(4200000 + 500000);
    expect(q.needsFinalSaleConsent).toBe(true);
    expect(q.ok).toBe(false);
    expect(price({ lines, acceptFinalSale: true }, { customRequests: [req()] }).ok).toBe(true);
  });
  it('the 5-day clock is estimated from proof time, and express is refused', () => {
    const lines = [{ id: 'l', kind: 'custom' as const, refId: 'c1', quantity: 1 }];
    const q = price({ lines, extras: { express: true } }, { customRequests: [req()] });
    expect(q.promise.customBy?.slice(0, 10)).toBe('2026-11-17'); // +24h proof, then +5 days
    expect(q.promise.proofHours).toBe(24);
    expect(q.ok).toBe(false);
  });
  it('refuses requests that are missing, already ordered, or in another order', () => {
    const lines = [{ id: 'l', kind: 'custom' as const, refId: 'c1', quantity: 1 }];
    expect(price({ lines }, {}).ok).toBe(false);
    expect(price({ lines }, { customRequests: [req({ status: 'awaiting_proof' })] }).ok).toBe(false);
    expect(price({ lines }, { customRequests: [req({ in_use: true })] }).ok).toBe(false);
  });
  it('mixed orders: ship-ready-first costs a second delivery; otherwise not allowed', () => {
    const lines = [line(tee().id), { id: 'l', kind: 'custom' as const, refId: 'c1', quantity: 1 }];
    const q = price({ lines, extras: { shipReadyFirst: true } }, { customRequests: [req()] });
    expect(q.shipReadyFirstKobo).toBe(350000);
    expect(price({ lines: [line(tee().id)], extras: { shipReadyFirst: true } }).ok).toBe(false);
  });
});

describe('christmas lateness', () => {
  it('warns when delivery would land after 24 December', () => {
    const q = price({ lines: [line(tee().id)] }, {}, new Date('2026-12-22T10:00:00+01:00'));
    expect(q.warnings.join()).toMatch(/after 24 December/);
    expect(price({ lines: [line(tee().id)] }, {}, new Date('2026-12-10T10:00:00+01:00')).warnings).toEqual([]);
  });
  it('custom orders are estimated with the proof time, so they warn earlier', () => {
    const lines = [{ id: 'l', kind: 'custom' as const, refId: 'c1', quantity: 1 }];
    const ctx = { customRequests: [{ id: 'c1', tier: 'full_custom' as const, product_type: 'tee' as const, colour: 'Black', status: 'draft', in_use: false, text_fields: { size: 'M' }, design_id: null }] };
    expect(price({ lines }, ctx, new Date('2026-12-18T10:00:00+01:00')).warnings.join()).toMatch(/after 24 December/);
  });
  it('warns when the zone gift box cutoff has passed', () => {
    const q = price({ lines: [{ id: 'b', kind: 'bundle', refId: 'joy-box', quantity: 1, selection: bundleSelection('joy-box') }] }, {}, new Date('2026-12-18T10:00:00+01:00'));
    expect(q.warnings.join()).toMatch(/cutoff has passed/);
  });
});

describe('invariants', () => {
  it('the total is never negative and equals the parts', () => {
    const q = price({ lines: [line(tee().id, 2)], extras: { giftWrap: true }, code: 'C', useCredit: true, giftCode: 'G' },
      { ...discountCtx({ type: 'fixed', value: 99999999 }), gift_card: { id: 'g', code: 'G', balance_kobo: 99999999, expires_at: null }, credit_kobo: 99999999 });
    expect(q.totalKobo).toBe(0);
    const p = price({ lines: [line(tee().id, 2)], extras: { giftWrap: true, express: true }, code: 'PEMART10' }, discountCtx());
    expect(p.totalKobo).toBe(p.subtotalKobo - (p.discount?.amountKobo ?? 0) + p.deliveryFeeKobo + p.giftWrapKobo + p.expressKobo);
    expect(Number.isInteger(p.totalKobo)).toBe(true);
  });
});
