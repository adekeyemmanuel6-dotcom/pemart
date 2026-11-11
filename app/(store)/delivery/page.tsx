import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';
import { getCatalogue } from '@/lib/catalogue/load';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Delivery', description: 'Pemart delivers across Nigeria within 5 days of payment. Fees, free Lagos delivery and Christmas cutoff dates.', alternates: { canonical: '/delivery' } };
export const revalidate = 300;

const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(`${iso}T12:00:00+01:00`)) : 'n/a');

export default async function DeliveryPage() {
  const { zones } = await getCatalogue();
  return (
    <ContentPage title="Delivery" kicker="arrives in 5 days" intro="We deliver across Nigeria. Your order arrives within 5 days of the day we start making it.">
      <h2>When the 5 days start</h2>
      <ul>
        <li><strong>Ready designs:</strong> the clock starts the day your payment is confirmed.</li>
        <li><strong>Custom and personalised orders:</strong> the clock starts the day you approve your design proof, not the day you pay. We promise your first proof within 12 hours (Personalise), 24 hours (Text design) or 48 hours (Full custom).</li>
      </ul>
      <p>The promised date is shown at checkout, in your confirmation email and on your order page.</p>
      <h2>Fees by area</h2>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[480px] text-left">
          <caption className="sr-only">Delivery fees by zone</caption>
          <thead className="bg-sand/60"><tr><th scope="col" className="px-4 py-3 text-sm">Area</th><th scope="col" className="px-4 py-3 text-sm">Fee</th><th scope="col" className="px-4 py-3 text-sm">Free delivery</th><th scope="col" className="px-4 py-3 text-sm">Christmas order cutoff</th></tr></thead>
          <tbody>{zones.map((z) => (<tr key={z.id} className="border-t border-line"><th scope="row" className="px-4 py-3 font-semibold">{z.name}</th><td className="px-4 py-3">{formatNaira(z.fee_kobo)}</td><td className="px-4 py-3">{z.free_over_kobo ? `Orders over ${formatNaira(z.free_over_kobo)}` : 'n/a'}</td><td className="px-4 py-3">{fmt(z.christmas_cutoff_date)}</td></tr>))}</tbody>
        </table>
      </div>
      <h2>Christmas</h2>
      <p>Gift boxes and Christmas orders are available until 24 December. To be sure your order arrives in time, place it before the cutoff for your area above. The gift box pages show a countdown, and checkout warns you if your promised date would fall after 24 December.</p>
      <h2>Mixed orders</h2>
      <p>If your bag has both a custom item and ready items, we ship everything together once your proof is approved. Prefer your ready items sooner? You can ask us to ship them first for an extra delivery fee.</p>
      <h2>Tracking</h2>
      <p>Follow your order any time on the <Link href="/track">Track Order</Link> page with your order number and the phone or email you used. We also send WhatsApp and email updates when your order is in production, out for delivery and delivered.</p>
    </ContentPage>
  );
}
