import { requireStaff } from '@/lib/auth';

export default async function AdminHome() {
  const profile = await requireStaff('/admin');
  return (
    <>
      <h1 className="display text-4xl">Overview</h1>
      <p className="mt-3 text-muted">Signed in as <strong className="text-ink">{profile.role}</strong>. The dashboard, orders, proofs and catalogue screens are built in Phase 6.</p>
      <p className="mt-6 text-sm text-muted">Admin-only areas (settings, discounts, reports) will additionally call <code>requireAdmin()</code> and be protected again by RLS.</p>
    </>
  );
}
