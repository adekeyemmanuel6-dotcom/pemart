import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { getProfile } from '@/lib/auth';
import { getCatalogue } from '@/lib/catalogue/load';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cat, profile, settings] = await Promise.all([getCatalogue(), getProfile(), getSettings()]);
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display mb-6 text-5xl sm:text-6xl">Checkout</h1>
      <CheckoutForm zones={cat.zones.map((z) => ({ name: z.name, states: z.states }))} defaultEmail={profile?.email ?? ''} signedIn={!!profile} addOns={{ giftWrapKobo: settings.gift_wrap_kobo, surpriseNoteKobo: settings.surprise_note_kobo, expressKobo: settings.express_kobo, expressEnabled: settings.express_enabled }} />
    </section>
  );
}
