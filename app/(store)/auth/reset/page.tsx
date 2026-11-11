import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage() {
  const signedIn = !!(await getProfile());
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">New password</h1>
      {signedIn ? (<><p className="mt-2 mb-8 text-muted">Choose a new password for your account.</p><ResetForm /></>) : (
        <p className="mt-4 text-muted">This reset link has expired or was already used. <Link href="/auth/forgot" className="font-semibold underline">Request a new one</Link>.</p>
      )}
    </section>
  );
}
