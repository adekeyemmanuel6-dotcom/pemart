import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseCsv, parseProductCsv, toCsv } from '@/lib/catalogue/csv';

describe('CSV parsing', () => {
  it('handles quotes, commas and newlines inside fields', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]);
  });
  it('round-trips and neutralises spreadsheet formulas on export', () => {
    expect(parseCsv(toCsv([['=SUM(A1)', 'a,b', 'plain']]))).toEqual([["'=SUM(A1)", 'a,b', 'plain']]);
  });
});

describe('product CSV import', () => {
  it('the template parses into products with variants', () => {
    const r = parseProductCsv(CSV_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.products.map((p) => [p.slug, p.variants.length])).toEqual([['grace-tee', 2], ['faith-candle', 1]]);
    const tee = r.products[0]!;
    expect(tee).toMatchObject({ price_kobo: 2200000, status: 'draft', made_to_order: true, weight_grams: 300 });
    expect(tee.variants[1]).toMatchObject({ sku: 'GRACE-TEE-BLK-L', size: 'L' });
    expect(tee.variants[0]).not.toHaveProperty('stock_qty');
    expect(r.products[1]!.variants[0]).toMatchObject({ stock_qty: 25 });
  });
  it('reports row-level errors with line numbers', () => {
    const r = parseProductCsv('slug,name,type,price,sku\nBad Slug,X,tee,10,A1\nok,Ok,spaceship,10,A2\nok2,Ok,tee,abc,A3\nok3,Ok,tee,100,DUP\nok4,Ok,tee,100,DUP\n');
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4, 6]);
    expect(r.errors[1]!.message).toContain('type must be one of');
  });
  it('requires the key columns and limits the size', () => {
    expect(parseProductCsv('name,price\nx,1').errors[0]!.message).toContain('slug');
    expect(parseProductCsv('slug,name,type,price\n' + 'a,b,tee,1\n'.repeat(1001)).errors[0]!.message).toContain('1,000');
  });
});
