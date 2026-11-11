-- Pemart 0004: addresses, wishlist, ambassadors, discounts, gift cards, subscribers

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient text not null,
  phone text not null,
  line1 text not null,
  area text,
  city text not null,
  state text not null,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_profile_idx on public.addresses(profile_id);
create trigger addresses_updated before update on public.addresses
  for each row execute function public.set_updated_at();

create table public.wishlist_items (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create table public.stock_alerts (   -- back-in-stock signups
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  email text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, email)
);

create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  code text not null unique,
  commission_rate numeric(5,4) not null default 0.10 check (commission_rate between 0 and 1),
  payout_note text,   -- a reference only; never store card or full account numbers here
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ambassadors_updated before update on public.ambassadors
  for each row execute function public.set_updated_at();

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage','fixed')),
  value bigint not null check (value > 0),       -- percent (1-100) or kobo
  min_spend_kobo bigint not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  per_customer_limit int,
  times_used int not null default 0,
  collection_ids uuid[] not null default '{}',   -- empty = no restriction
  product_ids uuid[] not null default '{}',
  ambassador_id uuid references public.ambassadors(id) on delete set null,
  is_single_use boolean not null default false,  -- first-order popup codes
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percentage' or value <= 100)
);
create trigger discount_codes_updated before update on public.discount_codes
  for each row execute function public.set_updated_at();

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  initial_kobo bigint not null check (initial_kobo > 0),
  balance_kobo bigint not null check (balance_kobo >= 0),
  purchaser_email text,
  recipient_email text,
  message text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  source text not null default 'footer',
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index subscribers_email_uidx on public.subscribers (lower(email)) where email is not null;
