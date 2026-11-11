import { unstable_cache } from 'next/cache';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';

export type Review = { id: string; rating: number; text: string | null; display_name: string | null; photo_urls: string[]; created_at: string };

/** Approved, verified-buyer reviews only (RLS also enforces this for the public client). */
export const getProductReviews = unstable_cache(
  async (productId: string): Promise<Review[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await createPublicClient().from('reviews').select('id,rating,text,display_name,photo_urls,created_at')
      .eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false }).limit(30);
    return data ?? [];
  },
  ['product-reviews'], { tags: ['reviews'], revalidate: 300 },
);
