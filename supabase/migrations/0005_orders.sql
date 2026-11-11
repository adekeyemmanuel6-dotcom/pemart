-- Pemart 0005: custom requests, carts, orders, payments, commissions, quotes, reviews

create sequence public.order_number_seq start 10001;

create or replace function public.next_order_number()
returns text language sql as $$
  select 'PM-' || nextval('public.order_number_seq')::text
$$;

create table public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  contact_email text,
  tier text not null check (tier in ('personalise','text_design','full_custom')),
  product_type text not null check (product_type in ('tee','hoodie','frame')),
  design_id uuid references public.designs(id) on delete set null,
  colour text,
  print_positions text[] not null default '{back}',
  text_fields jsonb not null default '{}'::jsonb,
  type_style text,
  notes text,
  upload_paths text[] not null default '{}',   -- private bucket paths
  preview_image text,
  status text not null default 'draft' check (status in
    ('draft','awaiting_proof','proof_sent','revision_requested','approved')),
  proofs jsonb not null default '[]'::jsonb,   -- [{version, path, message, sent_at}]
  revisions_used int not null default 0,
  fee_kobo bigint not null default 0,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index custom_requests_status_idx on public.custom_requests(status);
create index custom_requests_profile_idx on public.custom_requests(profile_id);
create trigger custom_requests_updated before update on public.custom_requests
  for each row execute function public.set_updated_at();

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_updated before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  selection jsonb not null,              -- variant or bundle selection; never trusted for price
  quantity int not null default 1 check (quantity > 0),
  custom_request_id uuid references public.custom_requests(id) on delete set null,
  gift_message text,
  created_at timestamptz not null default now()
);
create index cart_items_cart_idx on public.cart_items(cart_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default public.next_order_number(),
  profile_id uuid references public.profiles(id) on delete set null,
  contact_email text not null,
  contact_phone text not null,
  status text not null default 'pending_payment' check (status in (
    'pending_payment','paid','awaiting_proof','proof_sent','revision_requested',
    'approved','in_production','quality_check','packed','out_for_delivery',
    'delivered','cancelled','refunded','reprint')),
  has_custom boolean not null default false,
  has_bundle boolean not null default false,
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  gift_wrap_kobo bigint not null default 0,
  surprise_note_kobo bigint not null default 0,
  express_kobo bigint not null default 0,
  ship_ready_first_kobo bigint not null default 0,
  credit_used_kobo bigint not null default 0,
  gift_card_used_kobo bigint not null default 0,
  total_kobo bigint not null check (total_kobo >= 0),
  address jsonb not null,                    -- delivery address snapshot
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_zone_name text,
  is_gift boolean not null default false,
  gift_message text,
  ship_ready_first boolean not null default false,
  express boolean not null default false,
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  discount_code text,
  ambassador_code text,
  gift_card_id uuid references public.gift_cards(id) on delete set null,
  payment_reference text unique,
  paid_at timestamptz,
  production_start_at timestamptz,
  promised_by timestamptz,
  delivered_at timestamptz,
  expires_at timestamptz,                    -- pending_payment orders lapse after 24h
  abandoned_email_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_profile_idx on public.orders(profile_id);
create index orders_status_idx on public.orders(status);
create index orders_promised_idx on public.orders(promised_by);
create index orders_email_idx on public.orders(lower(contact_email));
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('variant','bundle','gift_card')),
  variant_id uuid references public.product_variants(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  name text not null,                        -- snapshot
  options jsonb not null default '{}'::jsonb,-- snapshot of colour/size/option
  selections jsonb,                          -- bundle slot selections snapshot
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity int not null check (quantity > 0),
  custom_request_id uuid references public.custom_requests(id) on delete set null,
  gift_message text,
  production_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  actor uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'paystack',
  reference text not null unique,            -- uniqueness makes webhook handling idempotent
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'initialised' check (status in ('initialised','success','failed','abandoned')),
  raw_payload jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.bulk_quotes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation text,
  phone text not null,
  email text not null,
  product_type text not null,
  quantity int not null check (quantity > 0),
  sizes jsonb,
  date_needed date,
  idea text,
  upload_paths text[] not null default '{}',
  status text not null default 'new' check (status in ('new','quoted','won','lost')),
  quoted_amount_kobo bigint check (quoted_amount_kobo >= 0),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bulk_quotes_updated before update on public.bulk_quotes
  for each row execute function public.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text,
  rating int not null check (rating between 1 and 5),
  text text,
  photo_urls text[] not null default '{}' check (cardinality(photo_urls) <= 3),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  credit_issued boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_product_idx on public.reviews(product_id, status);
