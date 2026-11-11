import type { Metadata } from 'next';
import { BulkForm } from '@/components/bulk/bulk-form';
import { BULK_TIERS } from '@/lib/bulk';
import { getSettings } from '@/lib/settings';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Bulk Orders',
  description: 'Group pricing for churches, events and businesses: 10% off 10 to 24 pieces, 15% off 25 to 99, and custom quotes for 100+.',
  alternates: { canonical: '/bulk' },
};

export default async function BulkPage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <p className="font-script text-3xl text-mocha">for the whole team</p>
        <h1 className="display text-5xl sm:text-7xl">Bulk orders</h1>
        <p className="mt-3 text-lg text-muted">Church programmes, conferences, youth camps, family reunions, company events. Tell us what you need and we will send a quote with your group price.</p>
      </header>
      <section aria-labelledby="tiers-h" className="mb-12">
        <h2 id="tiers-h" className="sr-only">Group pricing</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {BULK_TIERS.map((t) => (
            <li key={t.label} className="rounded-lg border-2 border-ink bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted">{t.label}</p>
              <p className="display mt-1 text-5xl">{t.discountPct ? `${t.discountPct}% off` : 'By quote'}</p>
              <p className="mt-2 text-sm text-muted">{t.discountPct ? 'Applied to the price of your pieces.' : 'Large orders get a price built around your design and timeline.'}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="quote-h"><h2 id="quote-h" className="display mb-5 text-3xl sm:text-4xl">Request a quote</h2><BulkForm whatsapp={settings.whatsapp_number} /></section>
        <aside className="h-fit rounded-lg bg-sand/60 p-6" aria-label="What to expect">
          <h2 className="display text-2xl">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink"><li>We review your request and reply on WhatsApp or email with a quote.</li><li>You approve the design proof before anything is printed.</li><li>Your order is delivered within 5 days of proof approval.</li></ol>
          <p className="mt-4 text-sm text-ink">Under 10 pieces? Just order from the shop. Bulk pricing starts at 10.</p>
        </aside>
      </div>
    </div>
  );
}
