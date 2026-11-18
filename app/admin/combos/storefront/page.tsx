import type { Metadata } from 'next';
import Link from 'next/link';
import { ComboSettingsForm } from '@/components/admin/combo-settings-form';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { requirePerm } from '@/lib/admin/db';
import { getRpc } from '@/lib/db';
import { resolveComboSettings } from '@/lib/combos/schema';

export const metadata: Metadata = { title: 'Combo website text' };
export const dynamic = 'force-dynamic';

export default async function StorefrontCopy() {
  await requirePerm('content', '/admin/combos/storefront');
  const rpc = await getRpc();
  const r = rpc ? await rpc<Record<string, unknown>>('combo_settings_get', {}) : null;
  if (r?.error && /could not find|does not exist|schema cache/i.test(r.error.message)) return <NeedsMigration migration="0024_combos.sql" what="Combo website text" />;
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href="/admin/combos" className="underline underline-offset-4">← Combo Management</Link></p>
        <h1 className="display text-4xl sm:text-5xl">Combo website text</h1>
        <p className="mt-1 text-sm text-muted">The words and pictures around the calculator and the brand story. Prices and contents are set in each combo.</p></div>
      <ComboSettingsForm initial={resolveComboSettings(r && !r.error ? r.data : {})} />
    </>
  );
}
