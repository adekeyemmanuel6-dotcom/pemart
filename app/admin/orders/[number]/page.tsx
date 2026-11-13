import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { Card, StatusBadge, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requirePerm } from '@/lib/admin/db';
import { confirmCryptoAction } from '@/lib/admin/actions-crypto';
import type { CryptoOrderView } from '@/lib/crypto-pay';
import { changeStatusAction, recordRefundAction, saveNoteAction } from '@/lib/admin/actions-ops';
import { privateFileUrl } from '@/lib/admin/files';
import { formatNaira } from '@/lib/money';
import { staffUpdateLink } from '@/lib/notifications/whatsapp';
import { STATUS_LABEL, nextStatuses, type OrderStatus } from '@/lib/orders/status';
import { TIERS } from '@/lib/custom/tiers';

type Item = { id: string; kind: string; name: string; options: Record<string, unknown>; selections: { label: string; productName: string; colour?: string; size?: string; option?: string; customText?: string }[] | null; unit_price_kobo: number; quantity: number; gift_message: string | null };
type Custom = { id: string; tier: keyof typeof TIERS; product_type: string; colour: string | null; status: string; text_fields: { lines?: string[]; name?: string; date?: string; verse?: string; size?: string }; type_style: string | null; notes: string | null; upload_paths: string[]; proofs: unknown[]; design_slug: string | null; print_positions: string[] };
type Order = Record<string, any> & { id: string; number: string; status: OrderStatus; items: Item[]; events: { status: string; note: string | null; created_at: string; actor: string | null }[]; payments: { reference: string; amount_kobo: number; status: string; verified_at: string | null }[]; custom_requests: Custom[]; commission: { amount_kobo: number; status: string } | null; customer: { id: string; name: string | null; store_credit_kobo: number } | null }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> { return { title: (await params).number }; }

export default async function OrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const me = await requirePerm(['orders', 'fulfilment'], `/admin/orders/${number}`);
  const o = await adm<Order | null>('admin_order_get', me, { number });
  // Crypto details exist only after migration 0018; before that (or for Paystack orders) this is null.
  const crypto = o ? await adm<CryptoOrderView | null>('admin_crypto_get', me, { order_id: o.id }).catch(() => null) : null;
  if (!o) notFound();
  const next = nextStatuses(o.status);
  const primary = next.find((s) => !['cancelled', 'refunded', 'reprint'].includes(s));
  const uploads = Object.fromEntries(await Promise.all(o.custom_requests.flatMap((c) => c.upload_paths.map(async (p) => [p, await privateFileUrl('design-uploads', p)] as const))));
  const a = o.address as { recipient: string; phone: string; line1: string; area?: string; city: string; state: string };
  const wa = staffUpdateLink(o.contact_phone, o.number, o.status, o.promised_by);

  return (
    <>
      <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm"><Link href="/admin/orders" className="underline underline-offset-4">← Orders</Link></p>
          <h1 className="display text-4xl sm:text-5xl">{o.number} <StatusBadge status={o.status} /></h1>
          <p className="mt-1 text-sm text-muted">Placed {fmtDate(o.created_at, true)}{o.paid_at ? ` · paid ${fmtDate(o.paid_at, true)}` : ''}{o.promised_by ? ` · promised by ${fmtDate(o.promised_by)}` : o.has_custom ? ' · promise starts at proof approval' : ''}</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-btn bg-[#1f8f4e] px-4 text-sm font-semibold text-white">WhatsApp update</a>
          <Link href={`/admin/orders/${o.number}/packing-slip`} target="_blank" className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-4 text-sm font-semibold">Packing slip</Link>
        </div>
      </div>

      {o.payment_note && <p role="alert" className="mb-4 rounded-lg border border-ember bg-ember/15 p-3 text-sm font-semibold">{o.payment_note}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card title="Items">
            <ul className="divide-y divide-line">{o.items.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex justify-between gap-3"><p className="font-semibold">{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.name}</p><p className="font-semibold">{formatNaira(i.unit_price_kobo * i.quantity)}</p></div>
                {i.kind === 'variant' && <p className="text-sm text-muted">{[i.options.colour, i.options.size, i.options.option].filter(Boolean).join(' · ')}</p>}
                {i.selections && <ul className="mt-1 space-y-0.5 text-sm text-muted">{i.selections.map((s) => (<li key={s.label}><strong className="text-ink">{s.label}:</strong> {[s.productName, s.colour, s.size, s.option, s.customText ? `"${s.customText}"` : ''].filter(Boolean).join(' · ')}</li>))}</ul>}
                {i.gift_message && <p className="mt-1 text-sm italic">Gift message: “{i.gift_message}”</p>}
                {i.kind === 'bulk' && <p className="text-sm text-muted">{String((i.options as { organisation?: string }).organisation ?? '')} {JSON.stringify((i.options as { sizes?: unknown }).sizes ?? {})}</p>}
              </li>))}</ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(o.subtotal_kobo)}</dd></div>
              {o.discount_kobo > 0 && <div className="flex justify-between"><dt>Discount {o.discount_code ? `(${o.discount_code})` : ''}</dt><dd>-{formatNaira(o.discount_kobo)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery ({o.delivery_zone_name ?? 'n/a'})</dt><dd>{formatNaira(o.delivery_fee_kobo)}</dd></div>
              {(o.gift_wrap_kobo + o.surprise_note_kobo + o.express_kobo + o.ship_ready_first_kobo) > 0 && <div className="flex justify-between"><dt>Extras{o.express ? ' (express)' : ''}{o.surprise_note ? ' (surprise note)' : ''}{o.ship_ready_first ? ' (ship ready first)' : ''}</dt><dd>{formatNaira(o.gift_wrap_kobo + o.surprise_note_kobo + o.express_kobo + o.ship_ready_first_kobo)}</dd></div>}
              {o.gift_card_used_kobo > 0 && <div className="flex justify-between"><dt>Gift card</dt><dd>-{formatNaira(o.gift_card_used_kobo)}</dd></div>}
              {o.credit_used_kobo > 0 && <div className="flex justify-between"><dt>Store credit</dt><dd>-{formatNaira(o.credit_used_kobo)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{formatNaira(o.total_kobo)}</dd></div>
            </dl>
          </Card>

          {o.custom_requests.length > 0 && (
            <Card title="Custom design briefs">
              <ul className="space-y-4">{o.custom_requests.map((c) => (
                <li key={c.id} className="rounded-md border border-line p-3 text-sm">
                  <p className="font-semibold">{TIERS[c.tier].name}: {c.colour} {c.product_type} ({c.text_fields.size}) · {c.print_positions.join(' + ')} <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-xs">{c.status.replace(/_/g, ' ')}</span></p>
                  {c.text_fields.lines?.some(Boolean) && <p>Words: <strong>{c.text_fields.lines.filter(Boolean).join(' / ')}</strong> (style: {c.type_style})</p>}
                  {(c.text_fields.name || c.text_fields.date || c.text_fields.verse) && <p>Personalise {c.design_slug}: {[c.text_fields.name, c.text_fields.date, c.text_fields.verse].filter(Boolean).join(' · ')}</p>}
                  {c.notes && <p>Idea: {c.notes}</p>}
                  {c.upload_paths.length > 0 && <ul className="mt-1">{c.upload_paths.map((p) => (<li key={p}>{uploads[p] ? <a href={uploads[p]!} target="_blank" rel="noopener noreferrer" className="underline">{p.split('/').pop()}</a> : <span className="text-muted">{p} (file link available once storage is connected)</span>}</li>))}</ul>}
                  <p className="mt-1">{c.proofs.length} proof{c.proofs.length === 1 ? '' : 's'} sent · <Link href="/admin/proofs" className="underline">Open proofs queue</Link></p>
                </li>))}</ul>
            </Card>
          )}

          <Card title="Timeline">
            <ol className="space-y-2 text-sm">{o.events.map((e, i) => (<li key={i}><strong>{STATUS_LABEL[e.status] ?? e.status}</strong> <span className="text-muted">· {fmtDate(e.created_at, true)}{e.actor ? ` · ${e.actor}` : ''}</span>{e.note && <span className="block text-muted">{e.note}</span>}</li>))}</ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Move this order">
            {next.length === 0 ? <p className="text-sm text-muted">No further steps from {STATUS_LABEL[o.status]}.</p> : (
              <ActionForm action={changeStatusAction} submitLabel={primary ? `Move to ${STATUS_LABEL[primary]}` : 'Update status'} pendingLabel="Updating…">
                <input type="hidden" name="orderId" value={o.id} />
                <label htmlFor="st" className={labelCls}>New status</label>
                <select id="st" name="to" defaultValue={primary ?? next[0]} className={inputCls}>{next.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}</select>
                <label htmlFor="stn" className={`${labelCls} mt-3`}>Note (optional)</label><input id="stn" name="note" className={inputCls} placeholder="Shown in the timeline" />
                <p className="mt-2 text-xs text-muted">In production, out for delivery and delivered also email the customer.</p>
              </ActionForm>)}
          </Card>

          <Card title="Customer">
            <p className="font-semibold">{a.recipient}</p><p className="text-sm text-muted">{o.contact_email}<br />{o.contact_phone}</p>
            <address className="mt-2 text-sm not-italic text-muted">{a.line1}{a.area ? `, ${a.area}` : ''}<br />{a.city}, {a.state}</address>
            {o.customer && <p className="mt-2 text-sm">Account: store credit {formatNaira(o.customer.store_credit_kobo)}</p>}
            {o.is_gift && <p className="mt-1 text-sm">🎁 Gift{o.gift_message ? `: “${o.gift_message}”` : ''}</p>}
          </Card>

          <Card title="Payment">
            <ul className="space-y-1 text-sm">{o.payments.map((p) => (<li key={p.reference} className="flex justify-between gap-2"><span className="break-all text-muted">{p.reference}</span><span className="shrink-0 font-semibold">{formatNaira(p.amount_kobo)} · {p.status}</span></li>))}</ul>
            {o.commission && <p className="mt-2 text-sm">Ambassador {o.ambassador_code}: commission {formatNaira(o.commission.amount_kobo)} ({o.commission.status})</p>}
            {crypto && (
              <div className="mt-4 space-y-3 border-t border-line pt-3 text-sm">
                <p className="font-semibold">Customer chose to pay with crypto</p>
                <ul className="space-y-1">{crypto.wallets.map((w) => (<li key={`${w.asset}-${w.network}`} className="break-all text-muted">{w.asset} · {w.network}: {w.address}</li>))}</ul>
                {crypto.submissions.length ? (
                  <div><p className="font-semibold">Transactions sent by the customer</p>
                    <ul className="mt-1 space-y-1">{crypto.submissions.map((t) => (<li key={t.hash} className="break-all"><span className="text-muted">{t.asset} · {t.network} · {fmtDate(t.at)}:</span> <code>{t.hash}</code></li>))}</ul></div>
                ) : <p className="text-muted">No transaction hash sent yet.</p>}
                {o.status === 'pending_payment' || o.status === 'cancelled' ? (
                  me.role === 'admin' ? (
                    <ActionForm action={confirmCryptoAction} submitLabel={`Confirm ${formatNaira(o.total_kobo)} received`} pendingLabel="Confirming…"
                      confirm={`Mark order ${o.number} as paid? Only do this after you have seen the full ${formatNaira(o.total_kobo)} arrive in the wallet.`}>
                      <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="number" value={o.number} />
                      <label className="flex min-h-11 items-start gap-2"><input type="checkbox" name="checked" className="mt-1 size-5 accent-ink" /><span>I have checked the wallet (or block explorer) and the full amount for this order has arrived.</span></label>
                      <label htmlFor="crypto-note" className={labelCls}>Note (optional, e.g. amount and coin received)</label>
                      <input id="crypto-note" name="note" maxLength={300} className={inputCls} />
                    </ActionForm>
                  ) : <p className="text-muted">An admin confirms crypto payments.</p>
                ) : <p className="font-semibold text-mocha">Crypto payment confirmed{o.paid_at ? ` on ${fmtDate(o.paid_at)}` : ''}.</p>}
              </div>
            )}
          </Card>

          <Card title="Internal notes">
            <ActionForm action={saveNoteAction} submitLabel="Save note"><input type="hidden" name="orderId" value={o.id} />
              <label htmlFor="notes" className="sr-only">Internal notes</label><textarea id="notes" name="notes" rows={4} defaultValue={o.notes ?? ''} className={`${inputCls} py-2`} placeholder="Only staff can see this" /></ActionForm>
          </Card>

          {['paid', 'awaiting_proof', 'proof_sent', 'revision_requested', 'approved', 'in_production', 'quality_check', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'reprint'].includes(o.status) && (
            <Card title="Refund">
              <details><summary className="min-h-11 cursor-pointer text-sm font-semibold">Record a refund</summary>
                <p className="my-2 text-sm text-muted">This only <strong>records</strong> the refund here. Send the money back in the Paystack dashboard.</p>
                <ActionForm action={recordRefundAction} submitLabel="Record refund" variant="danger"><input type="hidden" name="orderId" value={o.id} /><label htmlFor="rn" className={labelCls}>Reason</label><input id="rn" name="note" className={inputCls} required /></ActionForm></details>
            </Card>)}
        </div>
      </div>
    </>
  );
}
