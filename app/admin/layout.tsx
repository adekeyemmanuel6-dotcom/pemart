import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { ADMIN_NAV } from '@/lib/admin/nav';
import { requireStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Pemart Admin' }, robots: { index: false, follow: false } };

/** Every /admin page passes through this server-side role check (staff or admin). Admin-only pages call requireAdmin() as well,
 *  every server action re-checks, and the database functions check the role a third time. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff('/admin');
  const items = ADMIN_NAV.filter((i) => i.roles.includes(profile.role));
  return (
    <div className="admin-theme min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6 print:hidden">
        <Link href="/admin" className="display text-2xl">Pemart <span className="text-sm text-muted">admin</span></Link>
        <div className="flex items-center gap-3 text-sm text-muted"><span className="hidden sm:inline">{profile.email} · {profile.role}</span><Link href="/" className="font-semibold text-ink underline underline-offset-4">View store</Link>
          <form action="/auth/sign-out" method="post"><button className="min-h-11 font-semibold text-ink underline underline-offset-4">Sign out</button></form></div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="pt-3 print:hidden"><AdminNav items={items} /></div>{children}</div>
    </div>
  );
}
