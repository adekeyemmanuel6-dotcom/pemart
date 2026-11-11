import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, safeNext } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getProfile()) redirect(next);
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">Create an account</h1>
      <p className="mt-2 mb-8 text-muted">Track orders, save addresses and keep a wishlist. You can still check out as a guest.</p>
      <SignUpForm next={next} disabled={!isSupabaseConfigured} />
    </section>
  );
}
