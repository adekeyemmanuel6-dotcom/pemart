'use client';
import { useState, useTransition } from 'react';
import { importProductsCsv, type ImportSummary } from '@/lib/admin/actions-catalogue';
import { Card } from './ui';

/** Upload or paste a CSV, check it (nothing changes), then import. */
export function ProductImport() {
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();

  const run = (dry: boolean) => start(async () => {
    const r = await importProductsCsv(csv, dry);
    setResult(r);
    setChecked(dry && r.ok);
    if (!dry && r.ok) { setCsv(''); setName(''); }
  });

  return (
    <div className="space-y-4">
      <Card title="1. Choose your file">
        <p className="mb-3 text-sm text-muted">
          One row per variant (size, colour or option). For more rows of the same product, repeat the slug and leave the other product columns blank.
          Prices are in Naira. Existing products are matched by slug and variants by SKU, so you can also use this to update prices and stock. collection_slug and design_slug must match ones that already exist (see Export).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-btn bg-ink px-4 text-sm font-semibold text-paper">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              if (f.size > 2_000_000) { setResult({ ok: false, message: 'The file is too large (2 MB maximum).' }); return; }
              setCsv(await f.text()); setName(f.name); setResult(null); setChecked(false);
            }} />
          </label>
          <a href="/admin/catalogue/export?template=1" className="text-sm underline">Download a template</a>
          <a href="/admin/catalogue/export" className="text-sm underline">Export current products</a>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm">Or paste CSV text</summary>
          <label htmlFor="csv-text" className="sr-only">CSV text</label>
          <textarea id="csv-text" rows={8} value={csv} onChange={(e) => { setCsv(e.target.value); setName('pasted text'); setChecked(false); setResult(null); }} className="mt-2 w-full rounded border border-line bg-paper p-2 font-mono text-xs" />
        </details>
        {name && <p className="mt-2 text-sm">Selected: <strong>{name}</strong> ({csv.split(/\r?\n/).filter(Boolean).length - 1} rows)</p>}
      </Card>

      <Card title="2. Check, then import">
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!csv || pending} onClick={() => run(true)} className="min-h-11 rounded-btn border-2 border-ink px-5 text-sm font-semibold disabled:opacity-40">{pending && !checked ? 'Checking…' : 'Check file'}</button>
          <button type="button" disabled={!checked || pending} onClick={() => { if (window.confirm('Import these products now? Everything is saved together, or nothing if there is a problem.')) run(false); }}
            className="min-h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40">{pending && checked ? 'Importing…' : 'Import'}</button>
        </div>
        <div role="status" aria-live="polite" className="mt-4 space-y-2 text-sm">
          {result && <p className={result.ok ? 'font-semibold text-mocha' : 'font-semibold text-ember'}>{result.message}</p>}
          {result?.counts && (
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>New products: <strong>{result.counts.products_created}</strong></li>
              <li>Updated products: <strong>{result.counts.products_updated}</strong></li>
              <li>New variants: <strong>{result.counts.variants_created}</strong></li>
              <li>Updated variants: <strong>{result.counts.variants_updated}</strong></li>
              <li>Stock changes (logged): <strong>{result.counts.stock_changes}</strong></li>
            </ul>
          )}
          {result?.errors && result.errors.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-ember/50 p-2">
              {result.errors.slice(0, 100).map((e, i) => <li key={i}><strong>Row {e.row}:</strong> {e.message}</li>)}
              {result.errors.length > 100 && <li>…and {result.errors.length - 100} more</li>}
            </ul>
          )}
          {!checked && csv && !result && <p className="text-muted">Check the file first. Nothing is changed until you press Import.</p>}
        </div>
      </Card>
    </div>
  );
}
