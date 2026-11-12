'use server';
import { customRequestSchema, type CustomRequestInput } from '@/lib/custom/schema';
import { TIERS } from '@/lib/custom/tiers';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { getRpc } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export type SaveCustomResult =
  | { ok: true; id: string; persisted: boolean; feeKobo: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Saves a custom design brief as a draft custom_request. The fee comes from the
 * server-side TIERS table, never from the browser. Payment happens at checkout
 * (Phase 4); the order then moves the request to awaiting_proof.
 */
export async function saveCustomRequest(input: CustomRequestInput): Promise<SaveCustomResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`custom:${ip}`, 15, 10 * 60_000)).ok) return { ok: false, message: 'Too many attempts. Please wait a few minutes.' };

  const parsed = customRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? 'form')] ??= i.message;
    return { ok: false, message: Object.values(fieldErrors)[0] ?? 'Please check your design details.', fieldErrors };
  }
  const v = parsed.data;
  const feeKobo = TIERS[v.tier].feeKobo;
  // Only paths we issued (guest/ prefix) or the demo marker are accepted.
  if (v.uploadPaths.some((p) => !/^(guest\/[0-9a-f-]{36}\/[\w.-]+|demo\/.+)$/.test(p))) return { ok: false, message: 'One of your uploads is not valid. Please re-upload it.' };

  const rpc = await getRpc();
  if (!rpc) return { ok: true, id: `demo-${crypto.randomUUID()}`, persisted: false, feeKobo };

  const { data: auth } = isSupabaseConfigured ? await (await createClient()).auth.getUser() : { data: { user: null } };
  const { data, error } = await rpc<{ id: string }>('custom_request_create', {
    profile_id: auth.user?.id ?? null, contact_email: auth.user?.email ?? null, tier: v.tier, product_type: v.productType, design_slug: v.designSlug ?? null, colour: v.colour,
    print_positions: v.printPositions === 'both' ? ['front', 'back'] : [v.printPositions],
    text_fields: { lines: v.textLines, name: v.name, date: v.date, verse: v.verse, size: v.size }, type_style: v.typeStyle ?? null,
    notes: v.notes ?? null, upload_paths: v.uploadPaths, fee_kobo: feeKobo,
  });
  if (error || !data) return { ok: false, message: 'We could not save your design. Please try again.' };
  return { ok: true, id: data.id, persisted: true, feeKobo };
}
