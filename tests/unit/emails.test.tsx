import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import AbandonedCheckout from '@/emails/abandoned-checkout';
import GiftCardEmail from '@/emails/gift-card';
import OrderConfirmation from '@/emails/order-confirmation';
import OrderStatus from '@/emails/order-status';
import ProofApproved from '@/emails/proof-approved';
import ProofReady from '@/emails/proof-ready';
import ReviewRequest from '@/emails/review-request';
import SignInLink from '@/emails/sign-in-link';
import WelcomeOffer from '@/emails/welcome-offer';

const site = 'https://pemart.example';
const text = async (el: React.ReactElement) => (await render(el)).replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('email templates render with the right content', () => {
  it('proof ready: version, message, and a link that needs the private token', async () => {
    const html = await render(<ProofReady number="PM-10001" version={2} message="Bigger now" link={`${site}/order/PM-10001?t=abc#proofs`} siteUrl={site} />);
    expect(html).toContain('version 2'); expect(html).toContain('Bigger now'); expect(html).toContain('/order/PM-10001?t=abc#proofs');
    expect(await text(<ProofReady number="PM-10001" version={1} link="x" siteUrl={site} />)).toMatch(/5-day delivery clock starts the moment you approve/);
  });
  it('proof approved shows the promised date', async () => {
    expect(await text(<ProofApproved number="PM-10001" promisedBy="2026-11-20T10:00:00Z" link="x" siteUrl={site} />)).toMatch(/Arriving by .*20 November/);
  });
  it('order status: production, out for delivery, delivered', async () => {
    expect(await text(<OrderStatus number="PM-1" status="in_production" promisedBy="2026-11-20T10:00:00Z" link="x" siteUrl={site} />)).toMatch(/making it.*Expected by/);
    expect(await text(<OrderStatus number="PM-1" status="out_for_delivery" link="x" siteUrl={site} />)).toMatch(/On its way/);
    expect(await text(<OrderStatus number="PM-1" status="delivered" promisedBy="2026-11-20T10:00:00Z" link="x" siteUrl={site} />)).not.toMatch(/Expected by/);
  });
  it('review request offers ₦2,000 for a photo; abandoned mentions the 24-hour hold', async () => {
    expect(await text(<ReviewRequest number="PM-1" creditKobo={200000} link="x" siteUrl={site} />)).toContain('₦2,000');
    const a = await text(<AbandonedCheckout number="PM-1" totalKobo={2550000} link="x" siteUrl={site} />);
    expect(a).toContain('₦25,500'); expect(a).toMatch(/24 hours/);
  });
  it('order confirmation: custom orders explain the proof, ready orders show the date, items and gift messages appear', async () => {
    const o = { number: 'PM-10002', token: 't', hasCustom: false, proofHours: null, promisedBy: '2026-11-16T10:00:00Z', items: [{ name: 'Joy Box', quantity: 1, unitKobo: 4200000, contents: ['His tee: Seek First · Black · L'], giftMessage: 'Merry Christmas' }],
      subtotalKobo: 4200000, discountKobo: 0, deliveryFeeKobo: 350000, extrasKobo: 0, creditKobo: 0, giftCardKobo: 0, totalKobo: 4550000, address: { recipient: 'Ada', line1: '1 St', city: 'Ikeja', state: 'Lagos' } };
    const t1 = await text(<OrderConfirmation o={o} siteUrl={site} />);
    expect(t1).toMatch(/Arriving by .*16 November/); expect(t1).toContain('Seek First'); expect(t1).toContain('Merry Christmas'); expect(t1).toContain('₦45,500');
    const t2 = await text(<OrderConfirmation o={{ ...o, hasCustom: true, proofHours: 24, promisedBy: null }} siteUrl={site} />);
    expect(t2).toMatch(/within 24 hours/); expect(t2).toMatch(/starts the day you approve/); expect(t2).not.toMatch(/Arriving by/);
  });
  it('gift card and sign-in emails render', async () => {
    const g = await text(<GiftCardEmail code="PG-AAAA-BBBB-CCCC" amountKobo={2500000} message="Enjoy" from="Ada" siteUrl={site} />);
    expect(g).toContain('PG-AAAA-BBBB-CCCC'); expect(g).toContain('₦25,000'); expect(g).toContain('Enjoy');
    expect(await text(<SignInLink link="https://x" siteUrl={site} />)).toMatch(/Sign in to Wear The Word/);
  });
  it('welcome offer: shows the code, expiry and an apply-it link', async () => {
    const html = await render(<WelcomeOffer code="PEM-AB3K9Z" expires="10 January 2027" siteUrl={site} />);
    expect(html).toContain('PEM-AB3K9Z'); expect(html).toContain('/bag?code=PEM-AB3K9Z');
    expect(await text(<WelcomeOffer code="PEM-AB3K9Z" expires="10 January 2027" siteUrl={site} />)).toMatch(/10% off your first order.*once.*10 January 2027/);
  });
});
