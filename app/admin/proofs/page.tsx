import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { AdminUploader } from '@/components/admin/admin-uploader';
import { Card, Empty, PageTitle, fmtDate, hoursSince, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireStaff } from '@/lib/admin/db';
import { Flash } from '@/components/admin/flash';
import { sendProofAction } from '@/lib/admin/actions-ops';
import { privateFileUrl } from '@/lib/admin/files';
import { TIERS } from '@/lib/custom/tiers';

export const metadata: Metadata = { title: 'Proofs' };
type Q = { id: string; order_number: string; tier: keyof typeof TIERS; product_type: string; colour: string | null; status: string; text_fields: { lines?: string[]; name?: string; date?: string; verse?: string; size?: string }; type_style: string | null; notes: string | null; upload_paths: string[]; print_positions: string[]; design_slug: string | null; proofs: { version: number; sent_at: string }[]; feedback: { version: number; note: string; at: string }[]; revisions_used: number; waiting_since: string; promise_hours: number; overdue: boolean; recipient: string };

export default async function ProofsQueue({ searchParams }: { searchParams: Promise<{ flash?: string; flashLink?: string; flashLabel?: string }> }) {
  const sp = await searchParams;
  const me = await requireStaff('/admin/proofs');
  const queue = await adm<Q[]>('admin_proofs_queue', me);
  const todo = queue.filter((c) => c.status !== 'proof_sent'), waiting = queue.filter((c) => c.status === 'proof_sent');
  const files = Object.fromEntries(await Promise.all(todo.flatMap((c) => c.upload_paths.map(async (p) => [p, await privateFileUrl('design-uploads', p)] as const))));
  return (
    <>
      <PageTitle title="Design proofs" sub="Upload a proof image and send it. The customer is emailed and can approve or ask for changes." />
      <Flash sp={sp} />
      {todo.length === 0 ? <Empty>No proofs to make right now.</Empty> : (
        <ul className="space-y-4">{todo.map((c) => {
          const t = TIERS[c.tier], hrs = hoursSince(c.waiting_since);
          return (
            <li key={c.id}><Card className={c.overdue ? 'border-ember' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-lg font-bold"><Link href={`/admin/orders/${c.order_number}`} className="underline underline-offset-4">{c.order_number}</Link> · {t.name}</p>
                  <p className="text-sm text-muted">{c.recipient} · {c.colour} {c.product_type} ({c.text_fields.size}) · {c.print_positions.join(' + ')}</p></div>
                <p className={`rounded-full px-3 py-1 text-xs font-bold ${c.overdue ? 'bg-ember text-[#141414]' : 'bg-line'}`}>{c.status === 'revision_requested' ? 'Revision' : 'First proof'}: waiting {hrs}h of {c.promise_hours}h{c.overdue ? ' · LATE' : ''}</p>
              </div>
              <div className="mt-3 rounded-md bg-paper p-3 text-sm">
                {c.text_fields.lines?.some(Boolean) && <p>Words: <strong>{c.text_fields.lines.filter(Boolean).join(' / ')}</strong> · style: {c.type_style}</p>}
                {(c.text_fields.name || c.text_fields.date || c.text_fields.verse) && <p>Personalise <strong>{c.design_slug}</strong>: {[c.text_fields.name, c.text_fields.date, c.text_fields.verse].filter(Boolean).join(' · ')}</p>}
                {c.notes && <p>Idea: {c.notes}</p>}
                {c.upload_paths.length > 0 && <p>Uploads: {c.upload_paths.map((p) => files[p] ? <a key={p} href={files[p]!} target="_blank" rel="noopener noreferrer" className="mr-2 underline">{p.split('/').pop()}</a> : <span key={p} className="mr-2 text-muted">{p.split('/').pop()}</span>)}</p>}
                {c.feedback.length > 0 && <p className="mt-1 font-semibold text-ember">Customer feedback: “{c.feedback[c.feedback.length - 1]!.note}”</p>}
                <p className="mt-1 text-muted">Proofs sent: {c.proofs.length} · free revision {c.revisions_used > 0 ? 'used' : 'unused'}</p>
              </div>
              <ActionForm action={sendProofAction} submitLabel="Send proof to customer" pendingLabel="Sending…" className="mt-3" resetOnSuccess>
                <input type="hidden" name="customRequestId" value={c.id} />
                <div className="grid gap-3 sm:grid-cols-2"><AdminUploader bucket="proofs" name="path" label="Proof image (PNG, JPG or PDF)" accept=".png,.jpg,.jpeg,.pdf,.webp" />
                  <div><label htmlFor={`m-${c.id}`} className={labelCls}>Message (optional)</label><textarea id={`m-${c.id}`} name="message" rows={2} className={`${inputCls} py-2`} placeholder="A short note shown with the proof" /></div></div>
              </ActionForm>
            </Card></li>);
        })}</ul>)}

      {waiting.length > 0 && (<section className="mt-8"><h2 className="display mb-3 text-2xl">Waiting on the customer ({waiting.length})</h2>
        <ul className="divide-y divide-line rounded-lg border border-line">{waiting.map((c) => (<li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><Link href={`/admin/orders/${c.order_number}`} className="font-bold underline underline-offset-4">{c.order_number}</Link><span className="text-muted">{c.recipient} · proof v{c.proofs.length} sent {c.proofs.length ? fmtDate(c.proofs[c.proofs.length - 1]!.sent_at, true) : ''}</span></li>))}</ul></section>)}
    </>
  );
}
