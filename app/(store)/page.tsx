import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BundleCard } from '@/components/product/bundle-card';
import { GarmentMockup } from '@/components/product/garment-mockup';
import { ProductCard } from '@/components/product/product-card';
import { NewsletterForm } from '@/components/layout/newsletter-form';
import { Button } from '@/components/ui/button';
import { bundleSeparateTotal, isBundleAvailable, sortCards, toCard } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';
import { formatNaira } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { UGC_PHOTOS } from '@/lib/ugc';
import { SITE } from '@/lib/site';

export const revalidate = 300;
export const metadata: Metadata = { title: { absolute: `${SITE.name} | ${SITE.tagline}` }, description: SITE.description, alternates: { canonical: '/' } };

const TRUST = ['Arrives in 5 days', 'Pay securely with Paystack', 'Original designs', 'WhatsApp support'];
const TILE_DESIGN: Record<string, string> = { kingdom: 'seek-first', word: 'the-word', 'naija-mood': 'god-dey', 'two-of-us': 'two-are-better', 'christmas-drop': 'unto-us' };
const STEPS = [
  { n: '1', t: 'Pick your lane', d: 'Personalise an existing design, type your own words, or send us your full idea.' },
  { n: '2', t: 'Approve your proof', d: 'We send a proof within 12 to 48 hours. Love it, or ask for one free revision.' },
  { n: '3', t: 'We print and deliver', d: 'Once you approve, your order arrives in 5 days.' },
];

export default async function HomePage() {
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const cards = cat.products.map((p) => toCard(cat, p));
  const bestSellers = sortCards(cards, 'featured').slice(0, 8);
  const giftBoxes = cat.bundles.filter((b) => b.kind === 'gift_box' && isBundleAvailable(b));
  const couple = cat.bundles.find((b) => b.slug === 'two-of-us-starter');
  const typeName: Record<string, string> = { tee: 'Tee', hoodie: 'Hoodie', frame: 'Frame', perfume: 'Perfume', jewellery: 'Necklace', bracelet: 'Bracelet', glasses: 'Glasses', fun: 'Orb ball' };
  const contents = (b: (typeof cat.bundles)[number]) => b.bundle_slots.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ''}${typeName[s.product_type] ?? s.label}`).join(' · ');

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
        <div className="reveal">
          <p className="font-script text-3xl text-mocha">for you</p>
          <h1 className="display text-[clamp(3.5rem,11vw,8rem)]">Wear what<br />you believe.</h1>
          <p className="mt-5 max-w-md text-lg text-muted">Faith-inspired tees, hoodies and gifts. Printed to order and at your door in 5 days. Order for Christmas by 17 December in Lagos.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild><Link href="/gift-boxes">Shop Gift Boxes</Link></Button>
            <Button asChild variant="secondary"><Link href="/custom">Design Your Own</Link></Button>
          </div>
        </div>
        <div className="reveal relative mx-auto w-full max-w-md" style={{ animationDelay: '80ms' }}>
          <Link href="/products/seek-first-tee" aria-label="Seek First oversized tee">
            <GarmentMockup type="tee" colour="Black" view="back" designSlug="seek-first" className="rounded-lg" />
          </Link>
          <p className="mt-2 text-center text-sm text-muted">Seek First oversized tee, back print</p>
        </div>
      </section>

      <section aria-label="Why Pemart" className="border-y border-line bg-sand/50">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 text-center text-sm font-semibold sm:px-6 md:grid-cols-4 md:text-base">{TRUST.map((t) => (<li key={t}>{t}</li>))}</ul>
      </section>

      {/* Collections */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="coll-h">
        <h2 id="coll-h" className="display mb-6 text-4xl sm:text-5xl">Shop by collection</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {cat.collections.map((c) => (
            <li key={c.slug}>
              <Link href={`/collections/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-ink">
                {TILE_DESIGN[c.slug] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/designs/${TILE_DESIGN[c.slug]}-card.svg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-105" />
                ) : (<Image src="/placeholders/bracelet.svg" alt="" fill sizes="20vw" className="object-cover" />)}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3 pt-10 text-paper"><span className="display text-2xl">{c.name}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Best sellers */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-labelledby="best-h">
        <div className="mb-6 flex items-end justify-between"><h2 id="best-h" className="display text-4xl sm:text-5xl">Best-sellers</h2><Link href="/collections/all" className="font-semibold underline underline-offset-4">Shop all</Link></div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{bestSellers.map((p, i) => (<li key={p.slug}><ProductCard p={p} priority={i < 4} /></li>))}</ul>
      </section>

      {/* Gift boxes */}
      {giftBoxes.length > 0 && (
        <section className="bg-sand/50 py-16" aria-labelledby="gift-h">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex items-end justify-between gap-4"><div><p className="font-script text-2xl text-mocha">wrapped and ready</p><h2 id="gift-h" className="display text-4xl sm:text-5xl">Gift Boxes</h2></div><Link href="/gift-boxes" className="font-semibold underline underline-offset-4">See all boxes</Link></div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{giftBoxes.map((b) => (<li key={b.slug}><BundleCard bundle={b} separateKobo={bundleSeparateTotal(cat, b)} contents={contents(b)} /></li>))}</ul>
          </div>
        </section>
      )}

      {/* Couples */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-2" aria-labelledby="couples-h">
        <div className="grid grid-cols-2 gap-3">
          <GarmentMockup type="tee" colour="Sand" view="back" designSlug="two-are-better" className="rounded-lg" />
          <GarmentMockup type="tee" colour="Black" view="back" designSlug="two-are-better" className="rounded-lg" />
        </div>
        <div>
          <p className="font-script text-2xl text-mocha">two are better</p>
          <h2 id="couples-h" className="display text-5xl sm:text-6xl">Two of Us</h2>
          <p className="mt-3 max-w-md text-lg text-muted">Matching tees, hoodies and gift sets for the two of you. Choose his and hers sizes separately and we will pack the pair together.</p>
          {couple && <p className="mt-3 font-semibold">Two of Us Starter from {formatNaira(couple.price_kobo)}</p>}
          <Button asChild className="mt-6"><Link href="/couples">Shop couple packs</Link></Button>
        </div>
      </section>

      {/* How custom works */}
      <section className="bg-ink py-16 text-paper" aria-labelledby="custom-h">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="font-script text-2xl text-sand">make it yours</p>
          <h2 id="custom-h" className="display text-4xl sm:text-5xl">How custom works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (<li key={s.n} className="rounded-lg border border-paper/20 p-6"><span className="display text-5xl text-sand">{s.n}</span><p className="display mt-2 text-2xl">{s.t}</p><p className="mt-2 text-paper/80">{s.d}</p></li>))}
          </ol>
          <Button asChild className="mt-8 bg-paper text-ink hover:bg-sand"><Link href="/custom">Start designing</Link></Button>
        </div>
      </section>

      {/* Customer photo wall (shows only real photos) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="ugc-h">
        <h2 id="ugc-h" className="display text-4xl sm:text-5xl">Worn by you</h2>
        {UGC_PHOTOS.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{UGC_PHOTOS.map((u) => (<li key={u.src} className="relative aspect-square overflow-hidden rounded-lg"><Image src={u.src} alt={u.alt} fill sizes="25vw" className="object-cover" /><span className="absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-1 text-xs text-paper">{u.handle}</span></li>))}</ul>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-line p-8 text-center">
            <p className="text-lg">Wear it, then tag us. We feature our favourite photos here.</p>
            {settings.instagram_url && <Button asChild variant="secondary" className="mt-4"><a href={settings.instagram_url} target="_blank" rel="noopener noreferrer">Tag us on Instagram</a></Button>}
          </div>
        )}
      </section>

      {/* Bulk */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-labelledby="bulk-h">
        <div className="grid items-center gap-6 rounded-lg bg-mocha p-8 text-white md:grid-cols-[1fr_auto] md:p-12">
          <div><h2 id="bulk-h" className="display text-4xl sm:text-5xl">Ordering for a church, event or team?</h2><p className="mt-2 max-w-xl text-white/90">10 to 24 pieces get 10% off and 25 to 99 get 15% off. 100 or more? We will quote you.</p></div>
          <Button asChild className="bg-paper text-ink hover:bg-sand"><Link href="/bulk">Get a bulk quote</Link></Button>
        </div>
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-3xl px-4 pb-4 text-center sm:px-6" aria-labelledby="news-h">
        <h2 id="news-h" className="display text-4xl sm:text-5xl">Get 10% off your first order</h2>
        <p className="mt-2 mb-6 text-muted">New designs, Christmas cutoffs and the occasional offer. No spam.</p>
        <div className="flex justify-center"><NewsletterForm tone="light" /></div>
      </section>
    </>
  );
}
