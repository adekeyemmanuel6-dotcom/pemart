import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Pemart Admin' }, robots: { index: false, follow: false } };

/** Every /admin page passes through this server-side role check (staff or admin). RLS enforces it again in the database. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff('/admin');
  return (
    <div className="admin-theme min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
        <Link href="/admin" className="display text-2xl">Pemart <span className="text-sm text-muted">admin</span></Link>
        <p className="text-sm text-muted">{profile.email} · {profile.role}</p>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
