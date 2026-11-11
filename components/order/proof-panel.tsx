'use client';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { Check, Clock } from 'lucide-react';
import { respondToProofAction, type ProofResult } from '@/lib/actions/orders';
import { useBag } from '@/lib/cart-store';
import { TIERS } from '@/lib/custom/tiers';
import { formatNaira } from '@/lib/money';
import type { CustomRequestView } from '@/lib/checkout/service';
import { Button } from '@/components/ui/button';

export type ProofItem = CustomRequestView & { latestUrl: string | null };
const fmt = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso));

function ProofCard({ r, number, token, revisionFeeKobo }: { r: ProofItem; number: string; token?: string; revisionFeeKobo: number }) {
  const router = useRouter();
  const add = useBag((s) => s.add), setOpen = useBag((s) => s.setOpen);
  const [state, action, pending] = useActionState<ProofResult, FormData>(respondToProofAction, null);
  const tier = TIERS[r.tier];
  const latest = r.proofs[r.proofs.length - 1];
  const freeLeft = Math.max(0, 1 + r.revisions_paid - r.revisions_used);
  const brief = r.tier === 'text_design' ? (r.text_fields.lines ?? []).filter(Boolean).join(' / ') : [r.text_fields.name, r.text_fields.date, r.text_fields.verse].filter(Boolean).join(' · ') || r.design_slug;

  return (
    <article className="rounded-lg border border-line bg-white p-5" aria-labelledby={`proof-${r.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`proof-${r.id}`} className="display text-2xl">{tier.name}: {r.colour} {r.product_type}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${r.status === 'proof_sent' ? 'bg-ember text-ink' : r.status === 'approved' ? 'bg-mocha text-white' : 'bg-sand'}`}>
          {r.status === 'proof_sent' ? 'Needs your answer' : r.status === 'approved' ? 'Approved' : r.status === 'revision_requested' ? 'Revision in progress' : 'Preparing proof'}
        </span>
      </div>
      {brief && <p className="mt-1 text-sm text-muted">Your brief: {brief}</p>}

      {r.status === 'awaiting_proof' && <p className="mt-3 flex items-center gap-2 text-sm"><Clock className="size-4" aria-hidden />We&apos;re preparing your first proof. It arrives within {tier.proofHours} hours of payment, and we&apos;ll email you.</p>}
      {r.status === 'revision_requested' && <p className="mt-3 text-sm">We&apos;re working on your changes and will send a new proof soon.</p>}

      {latest && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Proof version {latest.version} <span className="font-normal text-muted">· {fmt(latest.sent_at)}</span></p>
          {r.latestUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.latestUrl} alt={`Design proof version ${latest.version}`} className="mt-2 max-h-96 w-full rounded-md border border-line bg-sand/40 object-contain" />
          )}
          {latest.message && <p className="mt-2 rounded-md bg-sand/60 p-3 text-sm italic">“{latest.message}”</p>}
        </div>
      )}
      {r.feedback.length > 0 && (
        <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Your earlier feedback</summary>
          <ul className="mt-1 space-y-1 text-muted">{r.feedback.map((f, i) => (<li key={i}>v{f.version}: {f.note}</li>))}</ul></details>
      )}

      {r.status === 'approved' && <p className="mt-3 flex items-center gap-2 font-semibold"><Check className="size-4 text-mocha" aria-hidden />You approved this design.</p>}

      {r.status === 'proof_sent' && (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="number" value={number} /><input type="hidden" name="token" value={token ?? ''} /><input type="hidden" name="customRequestId" value={r.id} />
          <div>
            <label htmlFor={`note-${r.id}`} className="mb-1 block text-sm font-semibold">Want changes? Tell us what to change {freeLeft > 0 ? <span className="font-normal text-muted">({freeLeft} free revision left)</span> : <span className="font-normal text-muted">(extra revision: {formatNaira(revisionFeeKobo)})</span>}</label>
            <textarea id={`note-${r.id}`} name="note" rows={3} maxLength={1000} className="w-full rounded-btn border border-line bg-paper p-3 text-base" placeholder="e.g. Make the name bigger and move it lower" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" name="decision" value="approve" disabled={pending}>Approve this design</Button>
            <Button type="submit" name="decision" value="revise" variant="secondary" disabled={pending}>Request changes</Button>
          </div>
          <p className="text-xs text-muted"><strong className="text-ink">Your 5-day delivery clock starts when you approve.</strong> Nothing is printed until then.</p>
        </form>
      )}

      {/* Outside the form: after a successful answer the page refreshes and the form goes away, but this message stays. */}
      <div role="status" aria-live="polite" className="mt-3">
        {state && <p className={`text-sm ${state.ok ? 'font-semibold text-mocha' : 'text-ember'}`}>{state.message}</p>}
        {state?.paidRevision && <Button type="button" variant="secondary" className="mt-2" onClick={() => { add({ id: crypto.randomUUID(), kind: 'revision', refId: r.id, quantity: 1 }); setOpen(false); router.push('/checkout'); }}>Buy an extra revision · {formatNaira(revisionFeeKobo)}</Button>}
      </div>
    </article>
  );
}

export function ProofPanel({ items, number, token, revisionFeeKobo }: { items: ProofItem[]; number: string; token?: string; revisionFeeKobo: number }) {
  return (
    <section id="proofs" aria-labelledby="proofs-h" className="mt-10 scroll-mt-24">
      <h2 id="proofs-h" className="display mb-1 text-3xl">Your design proof{items.length > 1 ? 's' : ''}</h2>
      <p className="mb-4 text-sm text-muted">Approve it, or ask for changes. One revision is free.</p>
      <div className="space-y-4">{items.map((r) => (<ProofCard key={r.id} r={r} number={number} token={token} revisionFeeKobo={revisionFeeKobo} />))}</div>
    </section>
  );
}
