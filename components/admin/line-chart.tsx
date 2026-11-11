import { formatNaira } from '@/lib/money';

/** A small, accessible SVG line chart of revenue by day (no chart library needed). */
export function LineChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  const W = 640, H = 200, P = 28;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const x = (i: number) => P + (data.length <= 1 ? 0 : (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = data.map((d, i) => `${x(i)},${y(d.revenue)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue by day, from ${data[0]?.date} to ${data[data.length - 1]?.date}, peaking at ${formatNaira(max)}`} className="w-full">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
        <line x1={P} y1={P} x2={W - P} y2={P} stroke="var(--line)" strokeDasharray="3 4" />
        <text x={P} y={P - 8} fontSize="11" fill="var(--muted)">{formatNaira(max)}</text>
        <polyline fill="none" stroke="var(--denim)" strokeWidth="2.5" points={pts} />
        {data.map((d, i) => (<circle key={d.date} cx={x(i)} cy={y(d.revenue)} r={data.length > 45 ? 0 : 3} fill="var(--denim)"><title>{`${d.date}: ${formatNaira(d.revenue)} from ${d.orders} orders`}</title></circle>))}
        <text x={P} y={H - 8} fontSize="11" fill="var(--muted)">{data[0]?.date}</text><text x={W - P} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{data[data.length - 1]?.date}</text>
      </svg>
      <figcaption className="sr-only">Data table follows below.</figcaption>
    </figure>
  );
}

export function Bars({ rows, label }: { rows: { name: string; revenue: number; qty?: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <ul className="space-y-2" aria-label={label}>{rows.slice(0, 8).map((r) => (
      <li key={r.name}><div className="flex justify-between text-sm"><span className="truncate pr-2">{r.name}</span><span className="shrink-0 font-semibold">{formatNaira(r.revenue)}{r.qty !== undefined ? <span className="font-normal text-muted"> · {r.qty}</span> : ''}</span></div>
        <div className="mt-1 h-2 rounded bg-line" aria-hidden><div className="h-2 rounded bg-denim" style={{ width: `${Math.max(2, (r.revenue / max) * 100)}%` }} /></div></li>))}</ul>
  );
}
