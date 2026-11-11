'use client';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/money';

/** DEV ONLY stand-in for the Paystack popup (PAYSTACK_MOCK=1). The server refuses to enable mock mode in production. */
export function MockPaystack({ amountKobo, onPay, onCancel }: { amountKobo: number; onPay: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Simulated Paystack payment" className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ember">Test mode · simulated</p>
        <p className="display mt-2 text-4xl">Paystack</p>
        <p className="mt-1 text-muted">This is a stand-in for the real payment popup.</p>
        <p className="my-4 text-2xl font-bold">{formatNaira(amountKobo)}</p>
        <Button className="w-full" onClick={onPay}>Simulate successful payment</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
