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
