'use server';
import { clientIp } from '@/lib/client-ip';
import { comboSelectionSchema } from '@/lib/combos/schema';
import { priceCombo } from '@/lib/combos/pricing';
import type { ComboCatalogue, PriceLine } from '@/lib/combos/types';
import { getRpc } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export type CheckComboResult = { ok: boolean; priced: boolean; unitKobo: number; lines: PriceLine[]; issues: string[]; version?: number };

/**
 * The authoritative check before a combo goes into the bag: prices the selection against the LIVE published data in the
 * database. The calculator shows an instant price using the same function; this is the one that counts.
 */
export async function checkCombo(selection: unknown): Promise<CheckComboResult> {
  const fail = (message: string): CheckComboResult => ({ ok: false, priced: false, unitKobo: 0, lines: [], issues: [message] });
  if (!(await rateLimit(`combo-check:${await clientIp()}`, 120, 60_000)).ok) return fail('Too many requests. Please slow down.');
  const parsed = comboSelectionSchema.safeParse(selection);
  if (!parsed.success) return fail('We could not read your selection. Please try again.');
  const rpc = await getRpc();
  if (!rpc) return fail('Combos are not connected to a database yet.');
  const live = await rpc<ComboCatalogue>('combo_public_list', {});
  const config = live.data?.collections.find((c) => c.slug === parsed.data.collection);
  if (!config) return fail('This combo is not available right now.');
  const q = priceCombo(config, parsed.data as never, { unavailable: new Set(live.data?.unavailable ?? []) });
  return { ok: q.ok, priced: q.priced, unitKobo: q.unitKobo, lines: q.lines, issues: q.issues, version: config.version };
}
