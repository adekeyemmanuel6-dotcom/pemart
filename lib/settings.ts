import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { isSupabaseConfigured } from '@/lib/env';
import { dbMode, getRpc } from '@/lib/db';

export type StoreSettings = {
  website_content?: unknown;
  website_revision?: number;
  free_shipping_threshold_kobo: number;
  dispatch_origin: string;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  hero_headline: string;
  hero_copy: string;
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
  revision_fee_kobo: number;
  review_credit_kobo: number;
};

// Matches seed data, so the shell looks right before Supabase is connected.
export const DEFAULT_SETTINGS: StoreSettings = {
  free_shipping_threshold_kobo: 20_000_000,
  dispatch_origin: 'Akure, Ondo State, Nigeria',
  hero_image_url: null,
  hero_image_alt: null,
  hero_headline: 'WEAR WHAT YOU STAND ON.',
  hero_copy: 'Your faith is more than what you believe. It’s what you live, represent and carry every day.',
  announcement_text: null,
  announcement_link: '/delivery',
  announcement_active: true,
  logo_url: null,
  whatsapp_number: null,
  instagram_url: null,
  tiktok_url: null,
  maintenance_mode: false,
  gift_wrap_kobo: 200000,
  surprise_note_kobo: 300000,
  express_kobo: 500000,
  express_enabled: true,
  upsell_product_id: null,
  upsell_price_kobo: null,
  revision_fee_kobo: 200000,
  review_credit_kobo: 200000,
};

/** Cached; admin edits call revalidateTag('settings'). */
export const getSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    if (dbMode() === 'pg') {
      const r = await (await getRpc())!<StoreSettings>('settings_public', {});
      if (r.data) return { ...DEFAULT_SETTINGS, ...r.data };
    }
    if (!isSupabaseConfigured) {
      // Local/demo: the offer is the seeded bracelet at ₦4,500, like the seed data.
      const fx = (await import('@/lib/catalogue/fixture.json')).default as unknown as {
        products: { id: string; slug: string }[];
      };
      return {
        ...DEFAULT_SETTINGS,
        upsell_product_id: fx.products.find((p) => p.slug === 'faith-bracelet')?.id ?? null,
        upsell_price_kobo: 450000,
      };
    }
    try {
      const { data } = await createPublicClient().from('settings').select('*').single();
      return { ...DEFAULT_SETTINGS, ...data };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ['store-settings'],
  { tags: ['settings'], revalidate: 300 },
);
