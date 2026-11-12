import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { formatNaira } from '@/lib/money';
export const metadata: Metadata = {
  title: 'Nationwide Delivery',
  description:
    'Delivery across all 36 Nigerian states and the FCT from Akure. Confirm your shipping fee and service before payment.',
  alternates: { canonical: '/delivery' },
};
export default async function DeliveryPage() {
  const s = await getSettings();
  return (
    <article className="wtw-section">
      <p className="wtw-eyebrow">From our home to yours</p>
      <h1 className="display mt-6 text-6xl">Nationwide delivery</h1>
      <div className="prose-pemart mt-8">
        <p>We dispatch from {s.dispatch_origin} and serve all 36 Nigerian states and the Federal Capital Territory.</p>
        <h2>Free delivery from {formatNaira(s.free_shipping_threshold_kobo)}</h2>
        <p>
          Eligible merchandise is counted after product discounts, before delivery and extras. Gift cards and design
          revision fees do not count. Eligible delivery services show the benefit in your bag and at checkout.
        </p>
        <h2>Know your delivery fee before you pay</h2>
        <p>
          Select your state and enter your city or town at checkout. Available services, confirmed fees and verified
          estimates appear before payment. Rates can depend on destination, carrier and parcel weight.
        </p>
        <p>
          If a verified rate is unavailable: Delivery fee will be confirmed by our team before order confirmation.
          Payment is paused until a service can be confirmed. We do not silently change delivery charges after payment.
        </p>
        <h2>Custom and personalised orders</h2>
        <p>
          Production begins after you approve your proof. Your team will confirm production and delivery timing; a
          general delivery estimate does not bypass proof approval.
        </p>
        <p>
          <Link href="/contact">Contact our team</Link> for a destination or parcel enquiry. Already ordered?{' '}
          <Link href="/track">Track your order</Link>.
        </p>
      </div>
    </article>
  );
}
