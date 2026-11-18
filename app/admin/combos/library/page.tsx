import type { Metadata } from 'next';
import Link from 'next/link';
import { ComboLibrary } from '@/components/admin/combo-library';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import type { LibraryItem } from '@/lib/combos/build';

export const metadata: Metadata = { title: 'Combo item library' };

export default async function LibraryPage() {
  const me = await requirePerm('catalogue', '/admin/combos/library');
  let items: LibraryItem[];
  try { items = await adm<LibraryItem[]>('admin_components_list', me); }
  catch (e) { if (isMissingFunction(e)) return <NeedsMigration migration="0024_combos.sql" what="The combo item library" />; throw e; }
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href="/admin/combos" className="underline underline-offset-4">← Combo Management</Link></p>
        <h1 className="display text-4xl sm:text-5xl">Item library</h1>
        <p className="mt-1 text-sm text-muted">Every garment, frame and extra a combo can use. Changing availability here applies to published combos immediately. {me.role === 'admin' ? 'Your costs are private to owners.' : ''}</p></div>
      <ComboLibrary items={items} isOwner={me.role === 'admin'} />
    </>
  );
}
