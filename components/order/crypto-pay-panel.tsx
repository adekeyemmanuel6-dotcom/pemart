'use client';
import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { submitCryptoTx, type CryptoSubmitState } from '@/lib/actions/crypto';
import type { CryptoOrderView } from '@/lib/crypto-pay';
import { formatNaira } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-btn border border-ink px-3 text-sm font-semibold hover:border-gold hover:bg-gold hover:text-[#111]"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked: the address is still selectable */ }
      }}
      aria-label={`Copy ${label}`}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Wallet addresses, the amount, and a form to send us the transaction hash. Payment is confirmed by our team. */
export function CryptoPayPanel({ crypto, number, token, totalKobo, expiresLabel }: { crypto: CryptoOrderView; number: string; token?: string; totalKobo: number; expiresLabel: string | null }) {
  const [state, action, pending] = useActionState<CryptoSubmitState, FormData>(submitCryptoTx, null);
  const amount = formatNaira(totalKobo);
  return (
    <div className="mt-5 space-y-4 rounded-lg border-2 border-gold bg-white p-5" aria-labelledby="crypto-title">
      <h2 id="crypto-title" className="display text-3xl">Pay with crypto</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Send the equivalent of <strong>{amount}</strong> to one of the wallets below. Use the exact network shown: coins sent on another network can be lost.</li>
        <li>Paste the transaction hash below so we can find your payment.</li>
        <li>We confirm your order as soon as the payment arrives{expiresLabel ? `. We hold your items until ${expiresLabel}` : ''}.</li>
      </ol>
      {crypto.instructions && <p className="whitespace-pre-line rounded-md bg-sand/60 p-3 text-sm">{crypto.instructions}</p>}
      <ul className="space-y-3">
        {crypto.wallets.map((w) => (
          <li key={`${w.asset}-${w.network}`} className="rounded-md border border-line p-3">
            <p className="text-sm font-semibold">{w.asset} <span className="font-normal text-muted">· {w.network} network</span></p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded bg-sand/60 px-2 py-2 text-sm">{w.address}</code>
              <CopyButton text={w.address} label={`${w.asset} ${w.network} address`} />
            </div>
            {w.note && <p className="mt-1 text-xs text-muted">{w.note}</p>}
          </li>
        ))}
      </ul>

      {crypto.submissions.length > 0 && (
        <div className="rounded-md bg-sand/60 p-3 text-sm" role="status">
          <p className="font-semibold">Transaction received, waiting for our team to confirm</p>
          <ul className="mt-1 space-y-1">{crypto.submissions.map((s) => (<li key={s.hash} className="break-all text-muted">{s.asset} · {s.network}: {s.hash}</li>))}</ul>
        </div>
      )}

      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="number" value={number} />
        {token && <input type="hidden" name="token" value={token} />}
        <div>
          <Label htmlFor="crypto-wallet">I paid with</Label>
          <select id="crypto-wallet" name="wallet" className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base">
            {crypto.wallets.map((w) => (<option key={`${w.asset}-${w.network}`} value={`${w.asset}|${w.network}`}>{w.asset} · {w.network}</option>))}
          </select>
        </div>
        <div>
          <Label htmlFor="crypto-hash">Transaction hash (ID)</Label>
          <Input id="crypto-hash" name="hash" autoComplete="off" spellCheck={false} placeholder="e.g. 0x8f3c…" required aria-describedby="crypto-status" />
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'I have paid: send transaction'}</Button>
        <p id="crypto-status" role="status" aria-live="polite" className={`min-h-5 text-sm ${state?.ok ? 'text-gold-deep' : 'text-ember'}`}>{state?.message}</p>
      </form>
    </div>
  );
}
