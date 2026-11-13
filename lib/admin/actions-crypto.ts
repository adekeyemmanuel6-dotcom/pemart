'use server';
import { z } from 'zod';
import { WALLET_SLOTS, cryptoWalletSchema } from '@/lib/crypto-pay';
import { sendOrderEmails } from '@/lib/checkout/service';
import { logEvent } from '@/lib/log';
import { adm, isMissingFunction, refreshStorefront, requireAdmin } from './db';
import { bool, int, run, str } from './actions-core';
import type { AdminResult } from './types';

const NEEDS_0018 = 'Crypto payments need the database update supabase/migrations/0018_crypto_payments.sql. Apply it in Supabase, then try again.';


/** Save the wallets buyers pay to. Every change is recorded in the activity log (migration 0017). */
export async function saveCryptoSettingsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin();
  return run(['/admin/settings', '/checkout'], async () => {
    const wallets = [];
    for (let i = 0; i < WALLET_SLOTS; i++) {
      const row = { asset: str(fd, `asset_${i}`), network: str(fd, `network_${i}`), address: str(fd, `address_${i}`), note: str(fd, `note_${i}`) };
      if (!row.asset && !row.network && !row.address) continue;
      const parsed = cryptoWalletSchema.safeParse(row);
      if (!parsed.success) return { ok: false, message: `Wallet ${i + 1}: ${parsed.error.issues[0]?.message}` };
      wallets.push({ ...parsed.data, asset: parsed.data.asset.toUpperCase() });
    }
    const enabled = bool(fd, 'crypto_enabled');
    if (enabled && wallets.length === 0) return { ok: false, message: 'Add at least one wallet address before switching crypto payments on.' };
    const hours = z.number().int().min(1).max(168).catch(48).parse(int(fd, 'crypto_window_hours') ?? 48);
    try {
      await adm('admin_crypto_settings_save', me, { enabled, wallets, instructions: str(fd, 'crypto_instructions').slice(0, 1000), window_hours: hours });
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0018 };
      throw e;
    }
    refreshStorefront();
    return { ok: true, message: enabled ? 'Crypto payments are on. Buyers can choose crypto at checkout.' : 'Saved. Crypto payments are off.' };
  });
}

/**
 * An admin confirms the crypto has arrived in the store's wallet. The database checks the role again and settles
 * the order with the same code as a Paystack payment (stock, discounts, gift cards, commissions).
 */
export async function confirmCryptoAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin();
  const orderId = z.uuid().parse(str(fd, 'order_id'));
  const number = str(fd, 'number');
  return run([`/admin/orders/${number}`, '/admin/orders', '/admin'], async () => {
    if (!bool(fd, 'checked')) return { ok: false, message: 'Tick the box to confirm you have seen the full amount arrive in the wallet.' };
    let r: { ok: boolean; already?: boolean; error?: string; number?: string; token?: string; needs_refund?: boolean; gift_cards?: { code: string; amount: number; recipient_email?: string; message?: string }[] };
    try {
      r = await adm('admin_crypto_confirm', me, { order_id: orderId, note: str(fd, 'note').slice(0, 300) });
    } catch (e) {
      if (isMissingFunction(e)) return { ok: false, message: NEEDS_0018 };
      throw e;
    }
    logEvent('payment.crypto_confirmed', { number, ok: r.ok, already: !!r.already, error: r.error });
    if (!r.ok) return { ok: false, message: r.error === 'amount_mismatch' ? 'The order total changed. Refresh the page.' : 'This payment could not be confirmed.' };
    if (r.already) return { ok: true, message: 'This order was already paid.' };
    if (r.needs_refund) return { ok: true, message: 'Recorded, but the order had expired and its items are no longer available. Refund the customer.' };
    if (r.number && r.token) await sendOrderEmails(r.number, r.token, r.gift_cards ?? []);
    return { ok: true, message: 'Payment confirmed. The order is now paid and the customer has been emailed.' };
  });
}
