import { z } from 'zod';

/** A wallet the store accepts payment to. Addresses are public by design: buyers need them to pay. */
export const cryptoWalletSchema = z.object({
  asset: z.string().trim().regex(/^[A-Za-z0-9 ]{2,12}$/, 'Coin: letters and numbers, e.g. USDT'),
  network: z.string().trim().regex(/^[A-Za-z0-9 ()._-]{2,40}$/, 'Network: e.g. TRC20, ERC20, BEP20, Bitcoin'),
  address: z.string().trim().regex(/^[A-Za-z0-9:._-]{20,128}$/, 'Paste the full wallet address (no spaces).'),
  note: z.string().trim().max(160).default(''),
});
export type CryptoWallet = z.infer<typeof cryptoWalletSchema>;

/** Transaction hash/ID as shown by a wallet or block explorer. */
export const txHashSchema = z.string().trim().regex(/^(0x)?[A-Za-z0-9]{16,128}$/, 'Paste the transaction hash (ID) from your wallet.');

export type CryptoSettings = { crypto_enabled?: boolean; crypto_wallets?: unknown; crypto_instructions?: string | null; crypto_window_hours?: number };

/** Wallets that are valid and usable; anything malformed is ignored rather than shown to buyers. */
export function activeWallets(s: CryptoSettings): CryptoWallet[] {
  if (!s.crypto_enabled || !Array.isArray(s.crypto_wallets)) return [];
  return s.crypto_wallets.flatMap((w) => {
    const r = cryptoWalletSchema.safeParse(w);
    return r.success ? [r.data] : [];
  });
}

export type CryptoOrderView = {
  wallets: CryptoWallet[];
  instructions: string | null;
  submissions: { asset: string; network: string; hash: string; at: string }[];
  expires_at: string | null;
  status: string;
  total_kobo?: number;
};

/** Wallet rows shown in Settings. */
export const WALLET_SLOTS = 4;
