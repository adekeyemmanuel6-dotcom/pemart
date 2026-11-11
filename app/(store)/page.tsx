import Link from 'next/link';
import { Button } from '@/components/ui/button';

const trust = ['Arrives in 5 days', 'Pay securely with Paystack', 'Original designs', 'WhatsApp support'];

// Phase 1 landing: the brand shell. The full homepage (collections, best-sellers, UGC) is Phase 2.
export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div className="reveal">
          <p className="font-script text-3xl text-mocha">for you</p>
          <h1 className="display text-[clamp(3.5rem,11vw,8rem)]">Wear what<br />you believe.</h1>
          <p className="mt-5 max-w-md text-lg text-muted">Faith-inspired tees, hoodies and gifts, printed to order and at your door in 5 days.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild><Link href="/gift-boxes">Shop Gift Boxes</Link></Button>
            <Button asChild variant="secondary"><Link href="/custom">Design Your Own</Link></Button>
          </div>
        </div>
        <div className="reveal rounded-lg bg-ink p-4 sm:p-8" style={{ animationDelay: '80ms' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/designs/seek-first-card.svg" alt="Seek First design preview" className="mx-auto aspect-[4/5] w-full max-w-sm" />
        </div>
      </section>
      <section aria-label="Why Pemart" className="border-y border-line bg-sand/50">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 text-center text-sm font-semibold sm:px-6 md:grid-cols-4 md:text-base">
          {trust.map((t) => (<li key={t}>{t}</li>))}
        </ul>
      </section>
    </>
  );
}
