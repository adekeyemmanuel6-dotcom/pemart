export type ProductType = 'tee' | 'hoodie' | 'frame' | 'perfume' | 'jewellery' | 'bracelet' | 'glasses' | 'fun' | 'gift_card';

export type Collection = {
  id: string; slug: string; name: string; intro: string | null; hero_image: string | null;
  sort_order: number; is_active: boolean; is_seasonal: boolean;
};

export type Design = {
  id: string; slug: string; name: string; story_or_verse: string | null; verse_reference: string | null;
  collection_id: string | null; artwork_front: string | null; artwork_back: string | null; preview_image: string | null;
  is_customisable: boolean; customisable_fields?: string[];
};

export type Variant = {
  id: string; product_id: string; sku: string; colour: string | null; size: string | null;
  option: string | null; option_group: string | null; price_kobo: number | null;
  stock_qty: number | null; reserved_qty: number; is_active: boolean;
};

export type ProductImage = { id: string; url: string; alt: string; view: 'front' | 'back' | 'model' | 'detail'; sort_order: number };

export type Product = {
  id: string; slug: string; name: string; type: ProductType; design_id: string | null; collection_id: string | null;
  description: string | null; care: string | null; base_price_kobo: number; compare_at_kobo: number | null;
  is_made_to_order: boolean; is_active: boolean; is_featured: boolean; is_seasonal: boolean;
  seo_title: string | null; seo_description: string | null; created_at: string;
  product_variants: Variant[]; product_images: ProductImage[];
};

export type BundleSlot = {
  id: string; bundle_id: string; label: string; product_type: string; allowed_collection_id: string | null;
  allowed_design_ids: string[]; allowed_product_id: string | null; option_group: string | null; quantity: number;
  requires_size: boolean; requires_colour: boolean; requires_option: boolean; option_label: string | null;
  requires_custom_text: boolean; matching_group: string | null; sort_order: number;
};

export type Bundle = {
  id: string; slug: string; name: string; kind: 'combo' | 'couple' | 'gift_box'; description: string | null;
  price_kobo: number; available_from: string | null; available_until: string | null; image: string | null;
  badge: string | null; sort_order: number; is_active: boolean; bundle_slots: BundleSlot[];
};

export type DeliveryZone = {
  id: string; name: string; states: string[]; fee_kobo: number; free_over_kobo: number | null;
  lead_days: number; christmas_cutoff_date: string | null; sort_order: number;
};

export type Catalogue = {
  collections: Collection[]; designs: Design[]; products: Product[]; bundles: Bundle[]; zones: DeliveryZone[];
};

/** Compact product shape sent to client components (cards, grids). */
export type CardProduct = {
  slug: string; name: string; type: ProductType; designSlug: string | null; collectionSlug: string | null;
  priceKobo: number; compareAtKobo: number | null; hasRange: boolean;
  colours: string[]; sizes: string[]; imageUrl: string | null; featured: boolean; createdAt: string;
  bundleable: boolean; madeToOrder: boolean; soldOut: boolean;
};
