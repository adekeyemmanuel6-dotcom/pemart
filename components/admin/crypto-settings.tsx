import { ActionForm } from '@/components/admin/action-form';
import { Card, inputCls, labelCls } from '@/components/admin/ui';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { saveCryptoSettingsAction } from '@/lib/admin/actions-crypto';
import { WALLET_SLOTS, type CryptoWallet } from '@/lib/crypto-pay';

/** Settings → Pay with crypto: switch it on and enter the wallet addresses buyers pay to. */
export function CryptoSettings({ settings: s }: { settings: Record<string, unknown> }) {
  if (!('crypto_wallets' in s)) {
    return (
      <section className="mt-10" aria-labelledby="crypto-h">
        <h2 id="crypto-h" className="display mb-3 text-3xl">Pay with crypto</h2>
        <NeedsMigration migration="0018_crypto_payments.sql" what="Accepting crypto payments" />
      </section>
    );
  }
  const wallets = (Array.isArray(s.crypto_wallets) ? s.crypto_wallets : []) as CryptoWallet[];
  return (
    <section className="mt-10" aria-labelledby="crypto-h">
      <h2 id="crypto-h" className="display mb-3 text-3xl">Pay with crypto</h2>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Buyers who choose crypto see these addresses and the order total in Naira, send the payment and paste the transaction
        hash. You check your wallet, then press <strong>Confirm received</strong> on the order. Nothing is marked paid automatically.
        Address changes only apply to new orders and are recorded in Activity.
      </p>
      <ActionForm action={saveCryptoSettingsAction} submitLabel="Save crypto settings">
        <Card title="Crypto payments">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="crypto_enabled" defaultChecked={Boolean(s.crypto_enabled)} className="size-5 accent-ink" />
            Offer “Pay with crypto” at checkout
          </label>
          <div className="mt-4 space-y-4">
            {Array.from({ length: WALLET_SLOTS }, (_, i) => {
              const w = wallets[i];
              return (
                <fieldset key={i} className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[120px_180px_1fr]">
                  <legend className="px-1 text-sm font-semibold">Wallet {i + 1}{i > 0 ? ' (optional)' : ''}</legend>
                  <div><label className={labelCls} htmlFor={`asset_${i}`}>Coin</label><input id={`asset_${i}`} name={`asset_${i}`} defaultValue={w?.asset ?? ''} placeholder="USDT" className={inputCls} /></div>
                  <div><label className={labelCls} htmlFor={`network_${i}`}>Network</label><input id={`network_${i}`} name={`network_${i}`} defaultValue={w?.network ?? ''} placeholder="TRC20" className={inputCls} /></div>
                  <div><label className={labelCls} htmlFor={`address_${i}`}>Wallet address</label><input id={`address_${i}`} name={`address_${i}`} defaultValue={w?.address ?? ''} placeholder="Paste the address to receive payments" spellCheck={false} autoComplete="off" className={`${inputCls} font-mono`} /></div>
                  <div className="md:col-span-3"><label className={labelCls} htmlFor={`note_${i}`}>Note for buyers (optional)</label><input id={`note_${i}`} name={`note_${i}`} defaultValue={w?.note ?? ''} maxLength={160} placeholder="e.g. Send USDT only on Tron (TRC20)" className={inputCls} /></div>
                </fieldset>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
            <div><label className={labelCls} htmlFor="crypto_instructions">Instructions shown with the addresses (optional)</label>
              <textarea id="crypto_instructions" name="crypto_instructions" rows={3} maxLength={1000} defaultValue={String(s.crypto_instructions ?? '')} placeholder="e.g. Use today's rate on Binance P2P. Message us on WhatsApp if you need help." className={`${inputCls} py-2`} /></div>
            <div><label className={labelCls} htmlFor="crypto_window_hours">Hold items for (hours)</label>
              <input id="crypto_window_hours" name="crypto_window_hours" type="number" min={1} max={168} defaultValue={Number(s.crypto_window_hours ?? 48)} className={inputCls} /></div>
          </div>
        </Card>
      </ActionForm>
    </section>
  );
}
