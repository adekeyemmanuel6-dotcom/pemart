import Link from 'next/link';
import { adm, isMissingFunction, requireAdmin } from '@/lib/admin/db';
import type { StoreSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import { WebsiteEditor } from '@/components/admin/website-editor';
import { PageTitle } from '@/components/admin/ui';
import { WebsiteHistory, type Revision } from '@/components/admin/website-history';
import { getCatalogue } from '@/lib/catalogue/load';
import { automaticNavigation } from '@/lib/navigation';
export const metadata = { title: 'Website editor' };
export default async function WebsiteAdminPage() {
  const me = await requireAdmin('/admin/website');
  const { settings, products } = await adm<{ settings: StoreSettings; products: { id: string; name: string }[] }>(
    'admin_settings_get',
    me,
  );
  const content = resolveWebsite(settings);
  const hero = content.sections.find((s) => s.id === 'hero');
  const automaticMenu = automaticNavigation(content, await getCatalogue().catch(() => null), { image: hero?.image || null, alt: hero?.alt || null });
  // Version history arrives with migration 0017; without it the editor still works.
  let history: Revision[] | null = null;
  try { history = await adm<Revision[]>('admin_website_history', me, { limit: 30 }); } catch (e) { if (!isMissingFunction(e)) throw e; }
  return (
    <>
      <PageTitle
        title="Your website"
        sub="Edit the words, images and pages your customers see."
        actions={
          <Link href="/" target="_blank" className="min-h-11 rounded-btn border px-4 py-3 text-sm font-semibold">
            Open storefront ↗
          </Link>
        }
      />
      {settings.website_revision === undefined && (
        <div role="alert" className="mb-5 rounded-lg border border-ember bg-ember/15 p-4 text-sm">
          <p className="font-semibold">Publishing is not available yet</p>
          <p className="mt-1">
            The live database is missing update <code className="font-mono">0014_wear_the_word.sql</code>, so changes made here cannot be saved to the
            storefront. Apply that update in Supabase (see <code className="font-mono">MIGRATION-REVIEW.md</code>), then publish again.
          </p>
        </div>
      )}
      <WebsiteEditor initial={content} revision={settings.website_revision ?? 0} products={products} automaticMenu={automaticMenu} />
      {history && <div className="mt-8"><WebsiteHistory history={history} revision={settings.website_revision ?? 0} /></div>}
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        {[
          [
            '/admin/catalogue',
            'Products & collections',
            'Prices, stock, product photographs, descriptions, designs and bundles.',
          ],
          [
            '/admin/settings',
            'Store settings',
            'Logo, contact details, announcement, delivery services and checkout fees.',
          ],
          ['/admin/discounts', 'Promotions', 'Discount codes, campaign dates and ambassadors.'],
        ].map(([href, title, copy]) => (
          <Link key={href} href={href!} className="rounded-lg border border-line p-5">
            <h2 className="font-semibold">{title} →</h2>
            <p className="mt-2 text-sm text-muted">{copy}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
