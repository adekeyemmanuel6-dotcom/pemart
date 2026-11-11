import type { Metadata } from 'next';
import Link from 'next/link';
import { AddressManager } from '@/components/account/address-manager';
import { ProfileForm } from '@/components/account/profile-form';
import { WishlistRemove } from '@/components/account/wishlist-remove';
import { ProductCard } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import { getOverview } from '@/lib/account/service';
import { requireProfile } from '@/lib/auth';
import { toCard } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';
import { formatDeliveryDate } from '@/lib/delivery';
import { formatNaira } from '@/lib/money';
import { STATUS_LABEL } from '@/lib/orders/status';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };
export const dynamic = 'force-dynamic';

const dateOnly = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso));

export default async function AccountPage() {
  const profile = await requireProfile('/account');
  const [ov, cat] = await Promise.all([getOverview(profile.id), getCatalogue()]);
  const me = ov?.profile ?? profile;
  const orders = ov?.orders ?? [];
  const waiting = orders.filter((o) => o.proofs_waiting > 0);
  const wishlist = cat.products.filter((p) => ov?.wishlist.includes(p.id));
  const states = cat.zones.flatMap((z) => z.states).sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-script text-3xl text-mocha">welcome back</p><h1 className="display text-5xl sm:text-6xl">Hi{me.full_name ? `, ${me.full_name.split(' ')[0]}` : ''}</h1></div>
        <div className="rounded-lg bg-ink px-5 py-3 text-paper"><p className="text-xs uppercase tracking-widest text-sand">Store credit</p><p className="display text-4xl" aria-label={`Store credit ${formatNaira(me.store_credit_kobo)}`}>{formatNaira(me.store_credit_kobo)}</p></div>
      </header>

      {waiting.length > 0 && (
        <section aria-labelledby="attn" className="mt-8 rounded-lg border-2 border-ember bg-ember/10 p-5">
          <h2 id="attn" className="display text-3xl">A design proof is waiting for you</h2>
          <ul className="mt-2 space-y-2">{waiting.map((o) => (<li key={o.number}><Link href={`/order/${o.number}?t=${o.token}#proofs`} className="font-semibold underline underline-offset-4">Order {o.number}: review your proof</Link></li>))}</ul>
        </section>
      )}

      <section aria-labelledby="orders-h" className="mt-12">
        <h2 id="orders-h" className="display mb-4 text-4xl">Your orders</h2>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center"><p className="text-lg">No orders yet.</p><Button asChild className="mt-4"><Link href="/collections/all">Start shopping</Link></Button></div>
        ) : (
          <ul className="space-y-3">{orders.map((o) => (
            <li key={o.number} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{o.number} <span className="font-normal text-muted">· {dateOnly(o.created_at)}</span></p>
                <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold uppercase tracking-wide">{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{o.items.join(', ')}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm"><strong>{formatNaira(o.total_kobo)}</strong>{o.promised_by && !['delivered', 'cancelled', 'refunded'].includes(o.status) ? <span className="text-muted"> · arriving by {formatDeliveryDate(new Date(o.promised_by))}</span> : o.has_custom && ['awaiting_proof', 'proof_sent', 'revision_requested'].includes(o.status) ? <span className="text-muted"> · 5 days after you approve your design</span> : null}</p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="secondary"><Link href={`/order/${o.number}?t=${o.token}`}>View order</Link></Button>
                  {o.status === 'delivered' && o.reviewable && <Button asChild size="sm" variant="ghost"><Link href={`/order/${o.number}/review?t=${o.token}`}>Leave a review</Link></Button>}
                </div>
              </div>
            </li>))}</ul>
        )}
      </section>

      <section aria-labelledby="addr-h" className="mt-12"><h2 id="addr-h" className="display mb-4 text-4xl">Saved addresses</h2><AddressManager addresses={ov?.addresses ?? []} states={states} /></section>

      <section aria-labelledby="wish-h" className="mt-12">
        <h2 id="wish-h" className="display mb-4 text-4xl">Wishlist</h2>
        {wishlist.length === 0 ? <p className="text-muted">Nothing saved yet. Tap the heart on any product to keep it here.</p> : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{wishlist.map((p) => (<li key={p.id}><ProductCard p={toCard(cat, p)} /><WishlistRemove productId={p.id} name={p.name} /></li>))}</ul>
        )}
      </section>

      <section aria-labelledby="prof-h" className="mt-12"><h2 id="prof-h" className="display mb-4 text-4xl">Your details</h2><ProfileForm name={me.full_name ?? ''} phone={me.phone ?? ''} email={me.email ?? ''} /></section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-line pt-6">
        {profile.role !== 'customer' && <Button asChild><Link href="/admin">Open admin</Link></Button>}
        <form action="/auth/sign-out" method="post"><Button type="submit" variant="secondary">Sign out</Button></form>
      </div>
    </div>
  );
}
