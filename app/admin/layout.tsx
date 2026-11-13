import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { navFor } from '@/lib/admin/nav';
import { requireStaff } from '@/lib/auth';
import { getAccess } from '@/lib/admin/db';
import { presetLabel } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Wear The Word Admin' }, robots: { index: false, follow: false } };

/** Every /admin page passes through this server-side role and two-factor check (staff or admin). Admin-only pages call
 *  requireAdmin() as well, every server action re-checks, and the database functions check the role a third time. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff('/admin');
  const access = (await getAccess(profile))!;
  return (
    <div className="admin-theme min-h-screen bg-paper text-ink">
      <AdminShell groups={navFor(access)} email={profile.email} role={profile.role} roleLabel={presetLabel(access)}>
        {children}
      </AdminShell>
    </div>
  );
}
