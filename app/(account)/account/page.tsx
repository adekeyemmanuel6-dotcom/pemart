import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { formatNaira } from '@/lib/money';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

// Phase 1: sign-in works and shows who you are. Orders, proofs, addresses and wishlist arrive in Phase 5.
export default async function AccountPage() {
  const profile = await requireProfile('/account');
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="display text-5xl">Hi{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
      <dl className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Email</dt><dd className="font-semibold">{profile.email}</dd></div>
        <div><dt className="text-sm text-muted">Store credit</dt><dd className="font-semibold">{formatNaira(profile.store_credit_kobo)}</dd></div>
      </dl>
      <p className="mt-6 text-muted">Your orders, design proofs, saved addresses and wishlist will appear here (Phase 5).</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {profile.role !== 'customer' && <Button asChild><Link href="/admin">Open admin</Link></Button>}
        <form action="/auth/sign-out" method="post"><Button type="submit" variant="secondary">Sign out</Button></form>
      </div>
    </section>
  );
}
