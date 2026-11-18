import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card } from '@/components/admin/ui';
import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import { configIssues, enumerateConfigs, priceCombo, startingPrice } from '@/lib/combos/pricing';
import { UNAVAILABLE_PRICE, type ComboConfig } from '@/lib/combos/types';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Preview combo', robots: { index: false } };

/** Shows the DRAFT the way a customer will see it once published. Prices only; internal costs are never rendered here. */
export default async function ComboPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePerm('catalogue', `/admin/combos/${id}/preview`);
  let got: { collection: { status: string; slug: string }; config: ComboConfig } | null;
  try { got = await adm('admin_combo_get', me, { id }); }
  catch (e) { if (isMissingFunction(e)) return <NeedsMigration migration="0024_combos.sql" what="Combo Management" />; throw e; }
  if (!got) notFound();
  const cfg = got.config; const issues = configIssues(cfg); const from = startingPrice(cfg);
  const rows = enumerateConfigs(cfg).map((e) => ({ e, q: priceCombo(cfg, e.selection) }));
  return (
    <>
      <div className="mb-5 mt-6"><p className="text-sm"><Link href={`/admin/combos/${id}`} className="underline underline-offset-4">← Back to editing</Link></p>
        <h1 className="display text-4xl sm:text-5xl">Preview: {cfg.name}</h1>
        <p className="mt-1 text-sm text-muted">{got.collection.status === 'published' ? 'This shows your latest draft. Customers see the last published version until you publish.' : 'Draft. Customers cannot see this yet.'}</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Customer view">
          {cfg.label && <p className="text-xs font-bold uppercase tracking-wide text-muted">{cfg.label}</p>}
          <p className="display text-3xl">{cfg.name}</p>{cfg.tagline && <p className="text-muted">{cfg.tagline}</p>}
          {cfg.scripture_ref && <p className="mt-2 text-sm italic">{cfg.scripture_text ? `“${cfg.scripture_text}” ` : ''}{cfg.scripture_ref}</p>}
          {cfg.description && <p className="mt-2 text-sm">{cfg.description}</p>}
          <p className="mt-3 font-bold">{from === null ? UNAVAILABLE_PRICE : `From ${formatNaira(from)}`}</p>
          <h3 className="display mt-4 text-xl">What is included</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {cfg.slots.filter((x) => x.mode !== 'unavailable').map((x) => (<li key={x.id}>
              {x.kind === 'garment' ? `${x.label}: choose ${x.components.map((c) => c.name).join(', ') || '(none yet)'}` : x.kind === 'frame' ? `${x.quantity} × ${x.label}, sizes: ${x.components[0]?.options.filter((o) => o.group === 'frame_size').map((o) => o.label).join(', ') || 'n/a'}` : `${x.mode === 'optional' ? 'Optional: ' : ''}${x.quantity > 1 ? `${x.quantity} × ` : ''}${x.components[0]?.name ?? x.label}`}
            </li>))}
          </ul>
        </Card>
        <Card title="Checks">
          {issues.length === 0 ? <p className="font-semibold">Everything checks out.</p> : (<ul className="space-y-1 text-sm">{issues.map((i, k) => (<li key={k} className={i.level === 'error' ? 'text-ember' : 'text-muted'}><strong>{i.level === 'error' ? 'Fix: ' : 'Note: '}</strong>{i.message}</li>))}</ul>)}
        </Card>
      </div>
      <Card title="Every price customers can get" className="mt-4">
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><caption className="sr-only">Price for each garment and frame-size combination</caption>
          <thead><tr className="text-xs uppercase tracking-wide text-muted"><th scope="col" className="py-1 pr-3">Selection</th><th scope="col" className="py-1">Price</th></tr></thead>
          <tbody>{rows.map(({ e, q }) => (<tr key={e.label} className="border-t border-line"><td className="py-1.5 pr-3">{e.label}</td><td className="py-1.5 font-semibold">{q.priced ? formatNaira(q.unitKobo) : UNAVAILABLE_PRICE}</td></tr>))}</tbody></table></div>
      </Card>
    </>
  );
}
