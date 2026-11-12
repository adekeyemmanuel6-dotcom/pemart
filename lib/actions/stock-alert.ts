'use server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { createAdminClient } from '@/lib/supabase/admin';

export type StockAlertState = { ok: boolean; message: string } | null;
const schema = z.object({ email: z.email('Enter a valid email address').max(254), variantId: z.uuid() });

/** Back-in-stock signup for a sold-out variant. */
export async function requestStockAlert(_prev: StockAlertState, formData: FormData): Promise<StockAlertState> {
  const ip = await clientIp();
  if (!(await rateLimit(`stock-alert:${ip}`, 6, 10 * 60_000)).ok) return { ok: false, message: 'Too many attempts. Please try again shortly.' };
  const parsed = schema.safeParse({ email: String(formData.get('email') ?? '').trim().toLowerCase(), variantId: formData.get('variantId') });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check your details and try again.' };
  if (!isSupabaseConfigured || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) return { ok: false, message: 'Alerts open very soon. Please check back.' };
  const { error } = await createAdminClient().from('stock_alerts').insert({ variant_id: parsed.data.variantId, email: parsed.data.email });
  if (error && error.code !== '23505') return { ok: false, message: 'Something went wrong. Please try again.' };
  return { ok: true, message: "Done. We'll email you when it's back." };
}
