import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/**
 * Cookie-free anon client for public catalogue reads. Because it does not touch
 * cookies, pages that use it can be statically generated (ISR).
 */
export const createPublicClient = () =>
  createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
