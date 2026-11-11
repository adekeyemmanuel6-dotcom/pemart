import { HOW_TO_MEASURE, SIZE_GUIDE, type SizeGuideType } from '@/lib/size-guide';

export function SizeGuideTable({ type, showHow = false }: { type: SizeGuideType; showHow?: boolean }) {
  const g = SIZE_GUIDE[type];
  return (
    <section aria-labelledby={`sg-${type}`} className="space-y-3">
      <h3 id={`sg-${type}`} className="display text-2xl">{g.title}</h3>
      <p className="text-muted">{g.note}</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[320px] text-left text-base">
          <caption className="sr-only">{g.title} measurements in centimetres</caption>
          <thead className="bg-sand/60"><tr>{g.columns.map((c, i) => (<th key={c} scope="col" className="px-4 py-3 text-sm font-semibold">{c}{i > 0 ? ' (cm)' : ''}</th>))}</tr></thead>
          <tbody>{g.rows.map((r) => (<tr key={r[0]} className="border-t border-line">{r.map((cell, i) => (i === 0 ? <th key={i} scope="row" className="px-4 py-3 font-semibold">{cell}</th> : <td key={i} className="px-4 py-3">{cell}</td>))}</tr>))}</tbody>
        </table>
      </div>
      {showHow && (<ol className="list-decimal space-y-1 pl-5 text-muted">{HOW_TO_MEASURE.map((s) => (<li key={s}>{s}</li>))}</ol>)}
    </section>
  );
}
