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
  gift_wrap_kobo: number;
  surprise_note_kobo: number;
  express_kobo: number;
  express_enabled: boolean;
  upsell_product_id: string | null;
  upsell_price_kobo: number | null;
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
  gift_wrap_kobo: 200000,
  surprise_note_kobo: 300000,
  express_kobo: 500000,
  express_enabled: true,
  upsell_product_id: null,
  upsell_price_kobo: null,
};

/** Cached; admin edits call revalidateTag('settings'). */
export const getSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    if (!isSupabaseConfigured) {
      // Local/demo: the offer is the seeded bracelet at ₦4,500, like the seed data.
      const fx = (await import('@/lib/catalogue/fixture.json')).default as unknown as { products: { id: string; slug: string }[] };
      return { ...DEFAULT_SETTINGS, upsell_product_id: fx.products.find((p) => p.slug === 'faith-bracelet')?.id ?? null, upsell_price_kobo: 450000 };
    }
    try {
      const { data } = await createPublicClient()
        .from('settings')
        .select('announcement_text,announcement_link,announcement_active,logo_url,whatsapp_number,instagram_url,tiktok_url,maintenance_mode,gift_wrap_kobo,surprise_note_kobo,express_kobo,express_enabled,upsell_product_id,upsell_price_kobo')
        .single();
      return data ?? DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ['store-settings'],
  { tags: ['settings'], revalidate: 300 },
);
