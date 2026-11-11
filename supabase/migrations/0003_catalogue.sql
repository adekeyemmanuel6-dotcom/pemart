-- Pemart 0003: delivery zones, settings, collections, designs, products, bundles
-- All money columns are integer kobo (1 NGN = 100 kobo).

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  states text[] not null default '{}',
  fee_kobo bigint not null check (fee_kobo >= 0),
  free_over_kobo bigint check (free_over_kobo >= 0),
  lead_days int not null default 5 check (lead_days >= 0),
  christmas_cutoff_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_zones_updated before update on public.delivery_zones
  for each row execute function public.set_updated_at();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  intro text,
  hero_image text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_seasonal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  story_or_verse text,
  verse_reference text,
  collection_id uuid references public.collections(id) on delete set null,
  artwork_front text,          -- print/overlay artwork (transparent)
  artwork_back text,
  preview_image text,          -- display preview (on dark card)
  allowed_product_types text[] not null default '{tee,hoodie}',
  is_customisable boolean not null default false,
  customisable_fields jsonb not null default '[]'::jsonb,  -- e.g. ["name","date","verse"]
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_collection_idx on public.designs(collection_id);
create trigger designs_updated before update on public.designs
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null check (type in
    ('tee','hoodie','frame','perfume','jewellery','bracelet','glasses','fun','gift_card')),
  design_id uuid references public.designs(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  description text,
  care text,
  base_price_kobo bigint not null check (base_price_kobo >= 0),
  compare_at_kobo bigint check (compare_at_kobo >= 0),
  is_made_to_order boolean not null default false,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_seasonal boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_type_idx on public.products(type);
create index products_design_idx on public.products(design_id);
create index products_collection_idx on public.products(collection_id);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  view text not null default 'front' check (view in ('front','back','model','detail')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  colour text,
  size text,
  option text,                 -- e.g. scent, bracelet style, frame finish
  option_group text,           -- e.g. 'him' / 'her' for perfume
  price_kobo bigint check (price_kobo >= 0),  -- null = use product base price
  stock_qty int check (stock_qty >= 0),       -- null = made to order
  reserved_qty int not null default 0 check (reserved_qty >= 0),
  image_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants(product_id);
create trigger product_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null,
  reason text not null,
  actor uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_adjustments_variant_idx on public.inventory_adjustments(variant_id, created_at desc);

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('combo','couple','gift_box')),
  description text,
  price_kobo bigint not null check (price_kobo >= 0),
  available_from timestamptz,
  available_until timestamptz,
  image text,
  badge text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bundles_updated before update on public.bundles
  for each row execute function public.set_updated_at();

create table public.bundle_slots (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  label text not null,                       -- e.g. "His tee"
  product_type text not null,                -- allowed product type
  allowed_collection_id uuid references public.collections(id) on delete set null,
  allowed_design_ids uuid[] not null default '{}',
  allowed_product_id uuid references public.products(id) on delete set null,
  option_group text,                         -- restrict options (e.g. 'him'/'her')
  quantity int not null default 1 check (quantity > 0),
  requires_size boolean not null default false,
  requires_colour boolean not null default false,
  requires_option boolean not null default false,
  option_label text,                         -- e.g. "Scent", "Style"
  requires_custom_text boolean not null default false,  -- e.g. name on a frame
  matching_group text,                       -- slots sharing a group must use the same design
  sort_order int not null default 0
);
create index bundle_slots_bundle_idx on public.bundle_slots(bundle_id, sort_order);

-- One-row table of editable store settings.
create table public.settings (
  id boolean primary key default true check (id),
  announcement_text text,
  announcement_link text,
  announcement_active boolean not null default true,
  logo_url text,                              -- uploaded from admin later; wordmark fallback
  upsell_product_id uuid references public.products(id) on delete set null,
  upsell_price_kobo bigint check (upsell_price_kobo >= 0),
  gift_wrap_kobo bigint not null default 200000,
  surprise_note_kobo bigint not null default 300000,
  express_kobo bigint not null default 500000,
  express_enabled boolean not null default true,
  whatsapp_number text,                       -- digits only, international format
  instagram_url text,
  tiktok_url text,
  pay_on_delivery_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger settings_updated before update on public.settings
  for each row execute function public.set_updated_at();
