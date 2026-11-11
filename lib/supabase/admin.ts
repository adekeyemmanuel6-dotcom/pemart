import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Service-role client. BYPASSES Row Level Security. Server code only, and only
 * for jobs that cannot run as the visitor: checkout, webhooks, guest order lookup.
 * Always validate and authorise before calling it.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
