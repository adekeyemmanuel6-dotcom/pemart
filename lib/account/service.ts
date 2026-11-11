import 'server-only';
import { getRpc } from '@/lib/db';

export type Address = { id: string; recipient: string; phone: string; line1: string; area: string | null; city: string; state: string; is_default: boolean };
export type AccountOrder = { number: string; status: string; total_kobo: number; created_at: string; promised_by: string | null; has_custom: boolean; token: string; delivered_at: string | null; items: string[]; proofs_waiting: number; reviewable: boolean };
export type Overview = {
  profile: { id: string; email: string | null; full_name: string | null; phone: string | null; role: string; store_credit_kobo: number };
  orders: AccountOrder[]; addresses: Address[]; wishlist: string[];
};

export async function getOverview(profileId: string): Promise<Overview | null> {
  const rpc = await getRpc();
  if (!rpc) return null;
  const r = await rpc<Overview | null>('account_overview', { profile_id: profileId });
  return r.data ?? null;
}

export async function call<T>(fn: string, arg: Record<string, unknown>): Promise<T | null> {
  const rpc = await getRpc();
  if (!rpc) return null;
  const r = await rpc<T>(fn, arg);
  return r.error ? null : r.data;
}
