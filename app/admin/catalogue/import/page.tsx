import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductImport } from '@/components/admin/product-import';
import { PageTitle } from '@/components/admin/ui';
import { requirePerm } from '@/lib/admin/db';

export const metadata: Metadata = { title: 'Import products' };

export default async function ImportPage() {
  await requirePerm('catalogue', '/admin/catalogue/import');
  return (
    <>
      <PageTitle title="Import products" sub="Add or update many products and variants from a spreadsheet (CSV). New products are created as drafts unless the status column says otherwise."
        actions={<Link href="/admin/catalogue" className="text-sm underline">Back to products</Link>} />
      <ProductImport />
    </>
  );
}
