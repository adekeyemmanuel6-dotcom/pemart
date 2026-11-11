import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, safeNext } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

const errors: Record<string, string> = {
  callback: 'That sign-in link expired or was already used. Please request a new one.',
  oauth: 'Google sign-in did not complete. Please try again.',
  rate: 'Too many attempts. Please wait a few minutes.',
  'not-configured': 'Sign-in is not connected yet.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getProfile()) redirect(next);
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">Sign in</h1>
      <p className="mt-2 mb-8 text-muted">No password needed. We will email you a link, or you can use Google.</p>
      {sp.error && <p role="alert" className="mb-4 rounded-btn border border-ember/40 bg-ember/10 p-3 text-sm">{errors[sp.error] ?? 'Something went wrong.'}</p>}
      {!isSupabaseConfigured && <p className="mb-4 rounded-btn border border-line bg-sand/60 p-3 text-sm">Supabase is not connected yet. Add your project keys to <code>.env.local</code> to turn sign-in on.</p>}
      <SignInForm next={next} disabled={!isSupabaseConfigured} />
    </section>
  );
}
