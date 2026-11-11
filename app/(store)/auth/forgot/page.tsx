import type { Metadata } from 'next';
import { ForgotForm } from './forgot-form';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function ForgotPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">Reset password</h1>
      <p className="mt-2 mb-8 text-muted">Enter your email and we will send you a link to choose a new password.</p>
      <ForgotForm />
    </section>
  );
}
