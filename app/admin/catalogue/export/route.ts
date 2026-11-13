import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import { CSV_COLUMNS, CSV_TEMPLATE, toCsv } from '@/lib/catalogue/csv';

type Row = Record<string, string | number | boolean | null>;
const naira = (k: unknown) => (typeof k === 'number' ? String(k / 100) : '');

/** Products and variants as CSV, in the same format the importer reads. ?template=1 gives an example file. */
export async function GET(request: Request) {
  const me = await requirePerm('catalogue', '/admin/catalogue');
  const headers = { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' };
  if (new URL(request.url).searchParams.get('template')) {
    return new Response(CSV_TEMPLATE, { headers: { ...headers, 'Content-Disposition': 'attachment; filename="products-template.csv"' } });
  }
  let rows: Row[];
  try { rows = await adm<Row[]>('admin_products_export', me); }
  catch (e) {
    if (isMissingFunction(e)) return new Response('Export needs supabase/migrations/0021_product_status_import.sql to be applied.', { status: 503 });
    throw e;
  }
  const out = rows.map((r) => [r.slug, r.name, r.type, r.status, naira(r.price_kobo), naira(r.compare_at_kobo), r.collection_slug, r.design_slug, r.description, r.care,
    r.made_to_order ? 'yes' : 'no', r.weight_grams, r.seo_title, r.seo_description, r.sku, r.colour, r.size, r.option, naira(r.variant_price_kobo), r.stock_qty] as (string | number | boolean | null)[]);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv([[...CSV_COLUMNS], ...out]), { headers: { ...headers, 'Content-Disposition': `attachment; filename="products-${date}.csv"` } });
}
