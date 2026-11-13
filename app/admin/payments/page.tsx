import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card, DataTable, PageTitle, fmtDate } from '@/components/admin/ui';
import { adm, isMissingFunction, requireAdmin } from '@/lib/admin/db';
import { publicEnv } from '@/lib/env';
import { formatNaira } from '@/lib/money';
import { paystackConfig, paystackPing } from '@/lib/paystack';

export const metadata: Metadata = { title: 'Payments status' };
export const dynamic = 'force-dynamic';

type Health = {
  by_status: Record<string, number>; paid_total_kobo: number; last_success_at: string | null; last_webhook_at: string | null; webhooks_7d: number;
  rejected_7d: number; last_rejected_at: string | null; settle_errors_7d: number; refunds_needed: number; awaiting_payment: number;
  recent: { reference: string; provider: string; status: string; amount_kobo: number; created_at: string; verified_at: string | null; number: string }[];
};
type Level = 'ok' | 'warn' | 'bad';

function Check({ level, title, detail }: { level: Level; title: string; detail?: React.ReactNode }) {
  const Icon = level === 'ok' ? CheckCircle2 : level === 'warn' ? AlertTriangle : XCircle;
  const colour = level === 'ok' ? 'text-[#7fd19b]' : level === 'warn' ? 'text-gold' : 'text-ember';
  return (
    <li className="flex gap-3 py-2.5">
      <Icon className={`mt-0.5 size-5 shrink-0 ${colour}`} aria-hidden />
      <div><p className="font-semibold"><span className="sr-only">{level === 'ok' ? 'OK: ' : level === 'warn' ? 'Warning: ' : 'Problem: '}</span>{title}</p>{detail && <p className="text-sm text-muted">{detail}</p>}</div>
    </li>
  );
}

const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const h = (Date.now() - new Date(iso).getTime()) / 3600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
};

/** Admin only. Shows whether Paystack is set up and working. Never shows a key, only whether it is a test or live key. */
export default async function PaymentsPage() {
  const me = await requireAdmin('/admin/payments');
  const cfg = paystackConfig();
  const [ping, health] = await Promise.all([
    paystackPing(),
    adm<Health>('admin_payments_health', me).catch((e) => { if (isMissingFunction(e)) return null; throw e; }),
  ]);
  const webhookUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/webhooks/paystack`;
  const modesMatch = !cfg.secretMode || !cfg.publicMode || cfg.secretMode === cfg.publicMode;
  const live = cfg.secretMode === 'live';

  return (
    <>
      <PageTitle title="Payments status" sub="Is Paystack set up correctly and are payments coming through? Keys are never shown here." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Set-up">
          <ul className="divide-y divide-line">
            {cfg.mock && <Check level="warn" title="Mock payments are on" detail="Local development only; real payments are not taken." />}
            <Check level={cfg.secretSet ? 'ok' : 'bad'} title={cfg.secretSet ? `Secret key is set (${cfg.secretMode} key)` : 'Secret key is missing'} detail={cfg.secretSet ? undefined : 'Add PAYSTACK_SECRET_KEY in Vercel → Settings → Environment Variables.'} />
            <Check level={cfg.publicSet ? 'ok' : 'bad'} title={cfg.publicSet ? `Public key is set (${cfg.publicMode} key)` : 'Public key is missing'} detail={cfg.publicSet ? undefined : 'Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in Vercel, then redeploy.'} />
            {!modesMatch && <Check level="bad" title="The keys do not match" detail="One key is a test key and the other is live. Use both test keys or both live keys." />}
            {cfg.secretSet && !cfg.mock && (
              <Check level={live ? 'ok' : 'warn'} title={live ? 'Live mode: real payments are taken' : 'Test mode: no real money moves'} detail={live ? undefined : 'Switch both keys to your live keys when you are ready to sell.'} />
            )}
            <Check level={ping.ok ? 'ok' : 'bad'} title={ping.message} detail={ping.ms ? `Answered in ${ping.ms} ms` : undefined} />
          </ul>
        </Card>

        <Card title="Webhook (payment confirmations)">
          <p className="text-sm text-muted">In Paystack: Settings → API Keys &amp; Webhooks → Webhook URL. Use this address for {live ? 'Live' : 'Test'} mode:</p>
          <code className="mt-2 block select-all break-all rounded bg-sand p-3 text-sm">{webhookUrl}</code>
          {health ? (
            <ul className="mt-2 divide-y divide-line">
              <Check level={health.last_webhook_at && Date.now() - new Date(health.last_webhook_at).getTime() < 7 * 86400_000 ? 'ok' : health.last_success_at ? 'warn' : 'warn'}
                title={`Last webhook received: ${ago(health.last_webhook_at)}`}
                detail={health.last_webhook_at ? `${health.webhooks_7d} in the last 7 days` : 'If payments succeed but none arrive here, check the webhook URL above in Paystack.'} />
              {health.rejected_7d > 0 && <Check level="bad" title={`${health.rejected_7d} webhook${health.rejected_7d === 1 ? '' : 's'} rejected in 7 days (last ${ago(health.last_rejected_at)})`} detail="The signature did not match. Usually the secret key in Vercel is not the one for this Paystack mode." />}
              {health.settle_errors_7d > 0 && <Check level="bad" title={`${health.settle_errors_7d} payment${health.settle_errors_7d === 1 ? '' : 's'} could not be recorded`} detail="Paystack will retry these automatically. If it keeps happening, check the database." />}
            </ul>
          ) : <div className="mt-3"><NeedsMigration migration="0022_payment_health.sql" what="Webhook and payment history" /></div>}
        </Card>
      </div>

      {health && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Paid in 7 days', formatNaira(health.paid_total_kobo)],
              ['Last successful payment', ago(health.last_success_at)],
              ['Orders waiting for payment', String(health.awaiting_payment)],
              ['Refunds needed', String(health.refunds_needed)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line p-4"><p className="text-xs uppercase tracking-wide text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
            ))}
          </div>
          {health.refunds_needed > 0 && <p className="mt-3 text-sm"><Link href="/admin/orders" className="underline">Find these orders</Link>: each shows a red note explaining why a refund is needed.</p>}
          <h2 className="display mb-3 mt-8 text-3xl">Recent payment attempts</h2>
          <DataTable caption="Recent payment attempts" head={['When', 'Order', 'Method', 'Amount', 'Result']}>
            {health.recent.map((r) => (
              <tr key={r.reference}>
                <td className="px-3 py-2.5">{fmtDate(r.created_at, true)}</td>
                <td className="px-3 py-2.5"><Link href={`/admin/orders/${r.number}`} className="underline">{r.number}</Link></td>
                <td className="px-3 py-2.5">{r.provider === 'crypto' ? 'Crypto' : 'Paystack'}</td>
                <td className="px-3 py-2.5">{formatNaira(r.amount_kobo)}</td>
                <td className="px-3 py-2.5">{({ success: 'Paid', initialised: 'Started, not paid', failed: 'Failed', abandoned: 'Replaced by a newer attempt' } as Record<string, string>)[r.status] ?? r.status}</td>
              </tr>
            ))}
          </DataTable>
          {health.recent.length === 0 && <p className="mt-2 text-sm text-muted">No payments yet.</p>}
        </>
      )}
    </>
  );
}
