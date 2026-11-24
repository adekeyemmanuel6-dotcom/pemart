'use server';
import { z } from 'zod';
import { parseProductCsv, type ImportProduct } from '@/lib/catalogue/csv';
import { AdminError, adm, isMissingFunction, refreshStorefront, requirePerm } from './db';
import { run, str } from './actions-core';
import type { AdminResult } from './types';

const NEEDS_0021 = 'Product status and CSV import need the database update supabase/migrations/0021_product_status_import.sql.';
export type ImportSummary = {
  ok: boolean; message: string; dryRun?: boolean; rows?: number;
  counts?: { products_created: number; products_updated: number; variants_created: number; variants_updated: number; stock_changes: number };
  errors?: { row: number | string; message: string }[];
};

type DbSummary = NonNullable<ImportSummary['counts']> & { errors: { row: string; message: string }[] };

/** Check a CSV (dry run) or import it. The database does everything in one transaction: all rows or none. */
export async function importProductsCsv(csv: string, dryRun: boolean): Promise<ImportSummary> {
  const me = await requirePerm('catalogue', '/admin/catalogue/import');
  if (csv.length > 2_000_000) return { ok: false, message: 'The file is too large (2 MB maximum).' };
  const parsed = parseProductCsv(csv);
  if (parsed.errors.length) return { ok: false, message: 'Fix these rows, then check again.', errors: parsed.errors, rows: parsed.rows };
  if (!parsed.products.length) return { ok: false, message: 'No products found in the file.' };
  try {
    const r = await adm<DbSummary>('admin_products_import', me, { rows: parsed.products satisfies ImportProduct[], dry_run: dryRun });
    if (r.errors.length) return { ok: false, message: 'Some rows refer to things that do not exist.', errors: r.errors, rows: parsed.rows, counts: r };
    if (!dryRun) refreshStorefront();
    return {
      ok: true, dryRun, rows: parsed.rows, counts: r,
      message: dryRun ? 'Looks good. Nothing has been changed yet.' : `Imported. ${r.products_created} new and ${r.products_updated} updated products.`,
    };
  } catch (e) {
    if (isMissingFunction(e)) return { ok: false, message: NEEDS_0021 };
    const m = e instanceof AdminError ? e.code : '';
    if (m.startsWith('import_errors')) return { ok: false, message: 'Nothing was imported because some rows have problems. Run the check again.' };
    return { ok: false, message: m && m.length < 160 ? `Nothing was imported: ${m}` : 'Nothing was imported. Please check the file.' };
  }
}

/** Set Draft / Active / Archived for several products at once. */
export async function bulkProductStatusAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  const status = z.enum(['draft', 'active', 'archived']).safeParse(str(fd, 'status'));
  const ids = fd.getAll('ids').map(String).filter((x) => z.uuid().safeParse(x).success).slice(0, 500);
  if (!status.success || ids.length === 0) return { ok: false, message: 'Tick at least one product and choose a status.' };
  return run(['/admin/catalogue'], async () => {
    try {
      const r = await adm<{ updated: number }>('admin_products_set_status', me, { ids, status: status.data });
      refreshStorefront();
      return { ok: true, message: `${r.updated} product${r.updated === 1 ? '' : 's'} set to ${status.data}.` };
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0021 };
      throw e;
    }
  });
}

const idsOf = (fd: FormData) => fd.getAll('ids').map(String).filter((x) => z.uuid().safeParse(x).success).slice(0, 500);
const NEEDS_0031 = 'This needs a database update first: apply supabase/migrations/0031_catalogue_bulk.sql in Supabase, then try again.';

/** Give the same price to several products at once. */
export async function bulkProductPriceAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  const ids = idsOf(fd);
  const raw = str(fd, 'price').replace(/[,₦\s]/g, '');
  if (ids.length === 0) return { ok: false, message: 'Tick at least one product first.' };
  if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) return { ok: false, message: 'Enter a price above zero, like 18000.' };
  const priceKobo = Math.round(Number(raw) * 100);
  return run(['/admin/catalogue'], async () => {
    try {
      const r = await adm<{ updated: number }>('admin_products_set_price', me, { ids, price_kobo: priceKobo });
      refreshStorefront();
      return { ok: true, message: `Price set on ${r.updated} product${r.updated === 1 ? '' : 's'}.` };
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0031 };
      throw e;
    }
  });
}

/** Permanently delete archived products that were never ordered. */
export async function bulkProductDeleteAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  const ids = idsOf(fd);
  if (ids.length === 0) return { ok: false, message: 'Tick at least one archived product first.' };
  if (str(fd, 'confirm') !== 'yes') return { ok: false, message: 'Tick the box to confirm the permanent delete.' };
  return run(['/admin/catalogue'], async () => {
    try {
      const r = await adm<{ deleted: number; not_archived: number; kept_because_ordered: number }>('admin_products_delete', me, { ids });
      refreshStorefront();
      const notes = [r.not_archived ? `${r.not_archived} not archived, so kept` : '', r.kept_because_ordered ? `${r.kept_because_ordered} kept because they are on past orders` : ''].filter(Boolean);
      return { ok: true, message: `${r.deleted} product${r.deleted === 1 ? '' : 's'} deleted${notes.length ? ` (${notes.join('; ')})` : ''}.` };
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0031 };
      throw e;
    }
  });
}
