import { z } from 'zod';

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** A cell that spreadsheet apps would run as a formula is prefixed so exported files are safe to open. */
const safeCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = safeCell(v === null || v === undefined ? '' : String(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n') + '\r\n';
}

export const CSV_COLUMNS = ['slug', 'name', 'type', 'status', 'price', 'compare_at', 'collection_slug', 'design_slug', 'description', 'care', 'made_to_order', 'weight_grams', 'seo_title', 'seo_description', 'sku', 'colour', 'size', 'option', 'variant_price', 'stock'] as const;
export const PRODUCT_TYPES = ['tee', 'hoodie', 'frame', 'perfume', 'jewellery', 'bracelet', 'glasses', 'fun'] as const;

const naira = (label: string) => z.string().trim().transform((v, ctx) => {
  if (v === '') return null;
  const n = Number(v.replace(/[₦,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) { ctx.addIssue({ code: 'custom', message: `${label} must be an amount in Naira, e.g. 22000` }); return z.NEVER; }
  return Math.round(n * 100);
});
const optInt = (label: string, max: number) => z.string().trim().transform((v, ctx) => {
  if (v === '') return null;
  if (!/^\d+$/.test(v) || Number(v) > max) { ctx.addIssue({ code: 'custom', message: `${label} must be a whole number` }); return z.NEVER; }
  return Number(v);
});
const yesNo = z.string().trim().toLowerCase().transform((v, ctx) => {
  if (v === '') return null;
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0'].includes(v)) return false;
  ctx.addIssue({ code: 'custom', message: 'made_to_order must be yes or no' }); return z.NEVER;
});
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const rowSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRe, 'slug: lowercase letters, numbers and dashes').max(80),
  name: z.string().trim().min(2, 'name is required').max(100),
  type: z.string().trim().toLowerCase().pipe(z.enum(PRODUCT_TYPES, { message: `type must be one of ${PRODUCT_TYPES.join(', ')}` })),
  status: z.string().trim().toLowerCase().pipe(z.enum(['', 'draft', 'active', 'archived'], { message: 'status must be draft, active or archived' })),
  price: naira('price'),
  compare_at: naira('compare_at'),
  collection_slug: z.string().trim().max(80),
  design_slug: z.string().trim().max(80),
  description: z.string().trim().max(4000),
  care: z.string().trim().max(2000),
  made_to_order: yesNo,
  weight_grams: optInt('weight_grams', 100_000),
  seo_title: z.string().trim().max(120),
  seo_description: z.string().trim().max(300),
  sku: z.string().trim().toUpperCase().max(64).refine((v) => v === '' || /^[A-Z0-9][A-Z0-9-_]*$/.test(v), 'sku: letters, numbers and dashes'),
  colour: z.string().trim().max(40),
  size: z.string().trim().max(10),
  option: z.string().trim().max(80),
  variant_price: naira('variant_price'),
  stock: optInt('stock', 1_000_000),
});

export type ImportVariant = { line: number; sku: string; colour: string; size: string; option: string; price_kobo?: number | null; stock_qty?: number | null };
export type ImportProduct = {
  line: number; slug: string; name: string; type: string; status?: string; price_kobo: number; compare_at_kobo: number | null;
  collection_slug: string; design_slug: string; description: string; care: string; made_to_order?: boolean; weight_grams: number | null;
  seo_title: string; seo_description: string; variants: ImportVariant[];
};
export type ParseResult = { products: ImportProduct[]; errors: { row: number; message: string }[]; rows: number };

/**
 * Turn a CSV (one row per variant; product columns repeated or left blank on the following rows) into products.
 * Columns are matched by header name, so they can be in any order and extra columns are ignored.
 */
export function parseProductCsv(text: string): ParseResult {
  const grid = parseCsv(text);
  const errors: ParseResult['errors'] = [];
  if (grid.length < 2) return { products: [], errors: [{ row: 1, message: 'The file needs a header row and at least one product row.' }], rows: 0 };
  if (grid.length > 1001) return { products: [], errors: [{ row: 1, message: 'Up to 1,000 rows per import. Split the file and import it in parts.' }], rows: grid.length - 1 };
  const header = grid[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  for (const need of ['slug', 'name', 'type', 'price']) if (!header.includes(need)) errors.push({ row: 1, message: `Missing column "${need}".` });
  if (errors.length) return { products: [], errors, rows: grid.length - 1 };

  const bySlug = new Map<string, ImportProduct>();
  const seenSku = new Set<string>();
  grid.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const raw = Object.fromEntries(CSV_COLUMNS.map((c) => [c, cells[header.indexOf(c)] ?? '']));
    // Following rows of the same product may leave product columns blank: fill them from the first row.
    const prev = bySlug.get(String(raw.slug).trim().toLowerCase());
    if (prev) { if (!raw.name) raw.name = prev.name; if (!raw.type) raw.type = prev.type; if (!raw.price) raw.price = String(prev.price_kobo / 100); }
    const r = rowSchema.safeParse(raw);
    if (!r.success) { errors.push({ row: line, message: r.error.issues.map((i) => i.message).join('; ') }); return; }
    const d = r.data;
    if (d.price === null) { errors.push({ row: line, message: 'price is required' }); return; }
    let p = bySlug.get(d.slug);
    if (!p) {
      p = { line, slug: d.slug, name: d.name, type: d.type, ...(d.status ? { status: d.status } : {}), price_kobo: d.price, compare_at_kobo: d.compare_at,
        collection_slug: d.collection_slug, design_slug: d.design_slug, description: d.description, care: d.care,
        ...(d.made_to_order !== null ? { made_to_order: d.made_to_order } : {}), weight_grams: d.weight_grams, seo_title: d.seo_title, seo_description: d.seo_description, variants: [] };
      bySlug.set(d.slug, p);
    }
    if (d.sku) {
      if (seenSku.has(d.sku)) { errors.push({ row: line, message: `SKU ${d.sku} appears twice in the file` }); return; }
      seenSku.add(d.sku);
      p.variants.push({ line, sku: d.sku, colour: d.colour, size: d.size, option: d.option,
        ...(raw.variant_price !== '' ? { price_kobo: d.variant_price } : {}), ...(raw.stock !== '' ? { stock_qty: d.stock } : {}) });
    }
  });
  return { products: [...bySlug.values()], errors, rows: grid.length - 1 };
}

export const CSV_TEMPLATE = toCsv([
  [...CSV_COLUMNS],
  ['grace-tee', 'Grace Oversized Tee', 'tee', 'draft', '22000', '', '', '', 'Heavyweight cotton tee.', 'Wash cold, inside out.', 'yes', '300', '', '', 'GRACE-TEE-BLK-M', 'Black', 'M', '', '', ''],
  ['grace-tee', '', '', '', '', '', '', '', '', '', '', '', '', '', 'GRACE-TEE-BLK-L', 'Black', 'L', '', '', ''],
  ['faith-candle', 'Faith Candle', 'fun', 'active', '9500', '12000', '', '', '', '', 'no', '400', '', '', 'FAITH-CANDLE', '', '', 'Vanilla', '', '25'],
]);
