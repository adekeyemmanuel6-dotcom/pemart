'use client';

export type ConfirmResult = { ok: true; number: string; token: string } | { ok: false; message: string; pending?: boolean };

/**
 * After the Paystack popup says "success", ask OUR server to confirm it (the server asks Paystack, and the
 * database checks the amount). Retries briefly if Paystack is slow to answer.
 */
export async function confirmPayment(reference: string): Promise<ConfirmResult> {
  let last = 'We could not confirm your payment.';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
      const j = await res.json();
      if (res.ok && j.ok) return { ok: true, number: j.number, token: j.token };
      last = j.message ?? last;
      if (res.status !== 202) return { ok: false, message: last };
    } catch { last = 'We could not confirm your payment. If you were charged, your order will be confirmed shortly.'; }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return { ok: false, message: last, pending: true };
}
