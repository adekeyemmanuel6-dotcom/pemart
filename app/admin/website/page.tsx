import Link from 'next/link';
import { adm, requireAdmin } from '@/lib/admin/db';
import type { StoreSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import { WebsiteEditor } from '@/components/admin/website-editor';
import { PageTitle } from '@/components/admin/ui';
export const metadata = { title: 'Website editor' };
export default async function WebsiteAdminPage() {
  const me = await requireAdmin('/admin/website');
  const { settings, products } = await adm<{ settings: StoreSettings; products: { id: string; name: string }[] }>(
    'admin_settings_get',
    me,
  );
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
      <WebsiteEditor initial={resolveWebsite(settings)} revision={settings.website_revision ?? 0} products={products} />
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
