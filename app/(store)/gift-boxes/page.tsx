import type { Metadata } from 'next';
import Link from 'next/link';
import { BundleCard } from '@/components/product/bundle-card';
import { ProductCard } from '@/components/product/product-card';
import { GiftBoxHub } from '@/components/bundle/gift-box-hub';
import { Button } from '@/components/ui/button';
import { bundleSeparateTotal, isBundleAvailable, productSoldOut, sortCards, toCard } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Gift Boxes',
  description: 'Christmas gift boxes from Pemart: the Joy Box, Couple’s Christmas Box, Kingdom Box and Family Box. Order before the cutoff for delivery by Christmas.',
  alternates: { canonical: '/gift-boxes' },
};

const typeName: Record<string, string> = { tee: 'Tee', hoodie: 'Hoodie', frame: 'Frame', perfume: 'Perfume', jewellery: 'Necklace', bracelet: 'Bracelet', glasses: 'Glasses', fun: 'Orb ball' };

export default async function GiftBoxesPage() {
  const cat = await getCatalogue();
  const boxes = cat.bundles.filter((b) => b.kind === 'gift_box');
  const live = boxes.filter((b) => isBundleAvailable(b));
  const readyStock = sortCards(
    cat.products.filter((p) => !p.is_made_to_order && p.type !== 'gift_card' && !productSoldOut(p)).map((p) => toCard(cat, p)), 'featured').slice(0, 4);
  const zones = cat.zones.map((z) => ({ name: z.name, states: z.states, cutoff: z.christmas_cutoff_date }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <p className="font-script text-3xl text-mocha">wrapped and ready</p>
        <h1 className="display text-5xl sm:text-7xl">Gift Boxes</h1>
        <p className="mt-3 text-lg text-muted">Tees, hoodies, perfume, bracelets and fun extras, packed together with a card in your words. Choose the designs, colours and sizes. We do the rest.</p>
      </header>

      {live.length === 0 ? (
        <div className="rounded-lg border-2 border-ink p-8 text-center" role="status">
          <p className="display text-4xl">Gift box season has ended</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Our Christmas boxes were available until 24 December. See you next year! In the meantime, ready-stock gifts and digital gift cards are always on.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/collections/accessories">Shop accessories</Link></Button><Button asChild variant="secondary"><Link href="/gift-cards">Buy a gift card</Link></Button></div>
        </div>
      ) : (
        <GiftBoxHub
          zones={zones}
          suggestions={<ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{readyStock.map((p) => (<li key={p.slug}><ProductCard p={p} /></li>))}</ul>}
          boxes={
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Gift boxes">
              {live.map((b) => (<li key={b.slug}><BundleCard bundle={b} separateKobo={bundleSeparateTotal(cat, b)} contents={b.bundle_slots.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ''}${typeName[s.product_type] ?? s.label}`).join(' · ')} /></li>))}
            </ul>
          }
        />
      )}
    </div>
  );
}
