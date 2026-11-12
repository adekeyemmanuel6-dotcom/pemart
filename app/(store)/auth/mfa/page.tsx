import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProfile, safeNext } from '@/lib/auth';
import { sessionAssurance } from '@/lib/mfa';
import { MfaForm } from './mfa-form';

export const metadata: Metadata = { title: 'Two-factor sign-in', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Staff and admins land here until this session has passed two-factor authentication. */
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/admin');
  const profile = await requireProfile(`/auth/mfa?next=${encodeURIComponent(next)}`);
  if (profile.role === 'customer') redirect('/account');
  const assurance = await sessionAssurance();
  if (assurance === 'aal2') redirect(next);

  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Admin security</p>
      <h1 className="display mt-2 text-5xl">{assurance === 'needs-enrol' ? 'Set up two-factor' : 'Enter your code'}</h1>
      <p className="mt-3 mb-8 text-muted">
        {assurance === 'needs-enrol'
          ? 'Admin access needs a second step. Scan the code with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.'
          : 'Open your authenticator app and enter the 6-digit code for Wear The Word admin.'}
      </p>
      <MfaForm mode={assurance === 'needs-enrol' ? 'enrol' : 'verify'} next={next} email={profile.email} />
      <form action="/auth/sign-out" method="post" className="mt-10 border-t border-line pt-6 text-sm">
        <span className="text-muted">Signed in as {profile.email}. </span>
        <button className="font-semibold underline underline-offset-4">Sign out</button>
      </form>
    </section>
  );
}
