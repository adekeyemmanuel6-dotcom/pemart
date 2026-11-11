import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, safeNext } from '@/lib/auth';
import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'Team sign in', robots: { index: false, follow: false } };

/** Password sign-in for the team (not linked anywhere on the storefront). Customers use /auth/sign-in. */
export default async function StaffSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/admin');
  if (await getProfile()) redirect(next);
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">Team sign in</h1>
      <p className="mt-2 mb-8 text-muted">For Pemart staff and admins. Customers sign in with an email link or Google.</p>
      <PasswordForm next={next} />
    </section>
  );
}
