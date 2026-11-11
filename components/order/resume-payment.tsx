'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resumePaymentAction } from '@/lib/actions/orders';
import { confirmPayment } from '@/lib/payment-client';
import { openPaystack } from '@/lib/paystack-client';
import { formatNaira } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { MockPaystack } from '@/components/checkout/mock-paystack';

/** Finish paying for an order that was started but not completed (also the target of the abandoned-checkout email). */
export function ResumePayment({ number, token, totalKobo }: { number: string; token: string; totalKobo: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  const [mock, setMock] = useState<{ reference: string; amount: number } | null>(null);

  async function done(reference: string) {
    setMock(null); setBusy(true);
    const r = await confirmPayment(reference);
    setBusy(false);
    if (r.ok || r.pending) router.replace(`/order/${number}?t=${token}`); else setMsg(r.message);
    router.refresh();
  }

  async function start() {
    setBusy(true); setMsg(null);
    const r = await resumePaymentAction(number, token);
    setBusy(false);
    if (!r.ok) return setMsg(r.message);
    if (r.mode !== 'pay') return;
    if (r.mock) return setMock({ reference: r.reference, amount: r.totalKobo });
    openPaystack(r.accessCode, { onSuccess: (ref) => done(ref), onCancel: () => setMsg('Payment was not completed. You can try again.'), onError: (m) => setMsg(`Payment error: ${m}`) });
  }

  return (
    <div>
      <Button onClick={start} disabled={busy}>{busy ? 'One moment…' : `Complete payment · ${formatNaira(totalKobo)}`}</Button>
      {msg && <p role="alert" className="mt-2 text-sm text-ember">{msg}</p>}
      {mock && <MockPaystack amountKobo={mock.amount} onPay={() => done(mock.reference)} onCancel={() => setMock(null)} />}
    </div>
  );
}
