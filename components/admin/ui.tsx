import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABEL } from '@/lib/orders/status';

export const inputCls = 'min-h-11 w-full rounded-btn border border-line bg-paper px-3 text-base text-ink placeholder:text-muted/70';
export const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-muted';

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="display text-4xl sm:text-5xl">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Card = ({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) => (
  <section className={`rounded-lg border border-line bg-sand/40 p-4 ${className}`} aria-label={title}>{title && <h2 className="display mb-3 text-2xl">{title}</h2>}{children}</section>
);

export const Stat = ({ label, value, tone, href }: { label: string; value: ReactNode; tone?: 'warn' | 'bad'; href?: string }) => {
  const inner = (<div className={`rounded-lg border p-4 ${tone === 'bad' ? 'border-ember bg-ember/15' : tone === 'warn' ? 'border-mocha bg-mocha/15' : 'border-line bg-sand/40'}`}><p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p><p className="display mt-1 text-3xl">{value}</p></div>);
  return href ? <Link href={href} className="block hover:opacity-90">{inner}</Link> : inner;
};

const STATUS_TONE: Record<string, string> = {
  pending_payment: 'bg-line text-ink', paid: 'bg-denim text-[#141414]', awaiting_proof: 'bg-mocha text-[#141414]', proof_sent: 'bg-mocha text-[#141414]', revision_requested: 'bg-ember text-[#141414]', approved: 'bg-denim text-[#141414]',
  in_production: 'bg-denim text-[#141414]', quality_check: 'bg-denim text-[#141414]', packed: 'bg-denim text-[#141414]', out_for_delivery: 'bg-mocha text-[#141414]', delivered: 'bg-ink text-paper', cancelled: 'bg-line text-muted', refunded: 'bg-line text-muted', reprint: 'bg-ember text-[#141414]',
};
export const StatusBadge = ({ status }: { status: string }) => (<span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[status] ?? 'bg-line text-ink'}`}>{STATUS_LABEL[status] ?? status}</span>);

export const Empty = ({ children }: { children: ReactNode }) => (<p className="rounded-lg border border-dashed border-line p-8 text-center text-muted">{children}</p>);

export function DataTable({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sand/60"><tr>{head.map((h) => (<th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>))}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const fmtDate = (iso: string | null | undefined, withTime = false) => !iso ? 'n/a' : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric' }), timeZone: 'Africa/Lagos' }).format(new Date(iso));
export const hoursSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600_000));
