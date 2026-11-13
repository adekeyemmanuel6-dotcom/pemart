'use server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { fetchOrder } from '@/lib/checkout/service';
import { txHashSchema } from '@/lib/crypto-pay';
import { getRpc } from '@/lib/db';
import { logEvent } from '@/lib/log';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { revalidatePath } from 'next/cache';

export type CryptoSubmitState = { ok: boolean; message: string } | null;

const input = z.object({
  number: z.string().trim().max(30),
  token: z.string().trim().max(200).optional(),
  wallet: z.string().max(60),
  hash: txHashSchema,
});
const ERRORS: Record<string, string> = {
  not_pending: 'This order is no longer waiting for payment.',
  not_crypto: 'This order is not set up for crypto payment.',
  bad_hash: 'That does not look like a transaction hash. Copy it from your wallet or block explorer.',
  bad_wallet: 'Choose the coin and network you paid with.',
  too_many: 'We already have several transactions for this order. Please message us on WhatsApp.',
};

/** The buyer attaches the transaction hash. This only records it for our team to check; it never marks the order paid. */
export async function submitCryptoTx(_prev: CryptoSubmitState, fd: FormData): Promise<CryptoSubmitState> {
  if (!(await rateLimit(`crypto-tx:${await clientIp()}`, 10, 10 * 60_000)).ok) return { ok: false, message: 'Too many attempts. Please wait a few minutes.' };
  const parsed = input.safeParse({ number: fd.get('number'), token: fd.get('token') || undefined, wallet: fd.get('wallet'), hash: fd.get('hash') });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the details and try again.' };
  const { number, token, wallet, hash } = parsed.data;
  const profile = await getProfile();
  const order = await fetchOrder({ number, token, profileId: profile?.id });
  if (!order) return { ok: false, message: 'We could not find that order.' };
  const [asset, network] = wallet.split('|');
  const rpc = await getRpc();
  if (!rpc) return { ok: false, message: 'Please try again shortly.' };
  const r = await rpc<{ ok: boolean; error?: string; already?: boolean }>('checkout_crypto_submit', { order_id: order.id, asset, network, hash });
  if (r.error || !r.data) {
    logEvent('crypto.submit_error', { number, error: r.error?.message });
    return { ok: false, message: 'We could not save that. Please try again or message us on WhatsApp.' };
  }
  if (!r.data.ok) return { ok: false, message: ERRORS[r.data.error ?? ''] ?? 'We could not save that. Please try again.' };
  logEvent('crypto.submitted', { number });
  revalidatePath(`/order/${number}`);
  return { ok: true, message: r.data.already ? 'We already have this transaction. We will confirm your order once it arrives.' : 'Thank you. We will confirm your order as soon as the payment arrives in our wallet.' };
}
