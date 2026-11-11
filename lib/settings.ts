import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { isSupabaseConfigured } from '@/lib/env';

export type StoreSettings = {
  announcement_text: string | null;
  announcement_link: string | null;
  announcement_active: boolean;
  logo_url: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  maintenance_mode: boolean;
};

// Matches seed data, so the shell looks right before Supabase is connected.
export const DEFAULT_SETTINGS: StoreSettings = {
  announcement_text: 'Order by 17 Dec for Christmas delivery in Lagos',
  announcement_link: '/gift-boxes',
  announcement_active: true,
  logo_url: null,
  whatsapp_number: '2340000000000',
  instagram_url: 'https://instagram.com/pemart',
  tiktok_url: 'https://tiktok.com/@pemart',
  maintenance_mode: false,
};

/** Cached; admin edits call revalidateTag('settings'). */
export const getSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
    try {
      const { data } = await createPublicClient()
        .from('settings')
        .select('announcement_text,announcement_link,announcement_active,logo_url,whatsapp_number,instagram_url,tiktok_url,maintenance_mode')
        .single();
      return data ?? DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ['store-settings'],
  { tags: ['settings'], revalidate: 300 },
);
