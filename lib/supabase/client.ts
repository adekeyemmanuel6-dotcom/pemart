import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export const createClient = () =>
  createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
