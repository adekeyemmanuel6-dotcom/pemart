-- 0024: customisable combo collections (BEHOLD, ABIDE, THE DOER'S) with a reusable component library, selling-price rules,
-- internal cost tracking, draft/publish, and a public calculator.
--
-- Safe to apply on a live database: it only ADDS tables, functions and one allowed value ('combo') for order_items.kind.
-- Existing bundles, orders, products and prices are not touched. Rollback: supabase/rollback/0024_combos.sql
--
-- Design:
--  * Working tables (below) are what the admin edits. Nothing is public until "Publish".
--  * Publishing stores a self-contained JSON snapshot (selling data only: NO costs) on the collection. The storefront and
--    the checkout price from that snapshot, so a half-finished edit can never reach customers.
--  * Internal costs live in separate columns/tables that no public function ever selects.
--  * Everything is service-role only (RLS on, no policies); the app calls the functions below.

-- ------------------------------------------------------------------ order items may now be combos
alter table public.order_items drop constraint if exists order_items_kind_check;
alter table public.order_items add constraint order_items_kind_check
  check (kind in ('variant','bundle','gift_card','custom','revision','bulk','combo'));

-- ------------------------------------------------------------------ component library
create table if not exists public.combo_components (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('garment','frame','item')),
  description text check (char_length(description) <= 1000),
  image_url text,
  internal_cost_kobo bigint check (internal_cost_kobo is null or internal_cost_kobo >= 0),   -- ADMIN ONLY
  public_price_kobo bigint check (public_price_kobo is null or public_price_kobo >= 0),     -- add-on selling price
  customisable boolean not null default false,
  min_qty int not null default 0 check (min_qty >= 0),
  max_qty int not null default 1 check (max_qty >= min_qty and max_qty <= 20),
  inventory_status text not null default 'made_to_order' check (inventory_status in ('in_stock','made_to_order','out_of_stock')),
  is_active boolean not null default true,
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.combo_component_options (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.combo_components(id) on delete cascade,
  grp text not null check (grp in ('size','colour','frame_size')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 1 and 60),
  internal_cost_kobo bigint check (internal_cost_kobo is null or internal_cost_kobo >= 0), -- ADMIN ONLY
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (component_id, grp, slug)
);

-- ------------------------------------------------------------------ collections, package contents, prices
create table if not exists public.combo_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 2 and 80),
  label text check (char_length(label) <= 30),                 -- Basic, Max, Signature, Premium...
  tagline text check (char_length(tagline) <= 160),
  scripture_ref text check (char_length(scripture_ref) <= 60),
  scripture_text text check (char_length(scripture_text) <= 600),
  description text check (char_length(description) <= 2000),
  image_url text,
  legacy_bundle_id uuid references public.bundles(id) on delete set null,   -- the older bundle this replaces (kept, never deleted)
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  base_price_kobo bigint check (base_price_kobo is null or base_price_kobo >= 0),
  published_snapshot jsonb,
  published_at timestamptz,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.combo_slots (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.combo_collections(id) on delete cascade,
  kind text not null check (kind in ('garment','frame','item')),
  label text not null check (char_length(label) between 1 and 60),
  component_id uuid references public.combo_components(id) on delete restrict,   -- the fixed component (frame, item)
  allowed_component_ids uuid[] not null default '{}',                            -- garment choices
  quantity int not null default 1 check (quantity between 1 and 12),             -- e.g. 3 frames
  mode text not null default 'required' check (mode in ('required','optional','unavailable')),
  min_qty int not null default 0 check (min_qty >= 0),
  max_qty int not null default 1 check (max_qty >= min_qty and max_qty <= 20),
  same_size_only boolean not null default false,
  customise boolean not null default false,
  extra_price_kobo bigint check (extra_price_kobo is null or extra_price_kobo >= 0),
  sort_order int not null default 0,
  check ((kind = 'garment' and component_id is null) or (kind <> 'garment' and component_id is not null))
);
create index if not exists combo_slots_collection_idx on public.combo_slots (collection_id, sort_order);

create table if not exists public.combo_price_rules (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.combo_collections(id) on delete cascade,
  kind text not null check (kind in ('garment_adjust','frame_size_adjust','fixed_variant','promo','bundle_discount')),
  component_id uuid references public.combo_components(id) on delete cascade,      -- garment_adjust / fixed_variant
  option_id uuid references public.combo_component_options(id) on delete cascade,  -- frame_size_adjust
  frame_signature text,                                                            -- fixed_variant: sorted frame-size option ids, comma separated ('' = no frames)
  amount_kobo bigint,                                                              -- adjust (may be negative) or fixed final price (>= 0)
  discount_type text check (discount_type in ('percent','fixed')),
  discount_value bigint,
  label text check (char_length(label) <= 80),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (kind <> 'fixed_variant' or (component_id is not null and frame_signature is not null and amount_kobo >= 0)),
  check (kind <> 'garment_adjust' or (component_id is not null and amount_kobo is not null)),
  check (kind <> 'frame_size_adjust' or (option_id is not null and amount_kobo is not null)),
  check (kind not in ('promo','bundle_discount') or (discount_type is not null and discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100)))
);
create index if not exists combo_price_rules_collection_idx on public.combo_price_rules (collection_id);

-- Per-package overhead costs (admin only): printing, artwork, packaging, labour, fees, other.
create table if not exists public.combo_collection_costs (
  collection_id uuid primary key references public.combo_collections(id) on delete cascade,
  printing_apparel_kobo bigint not null default 0 check (printing_apparel_kobo >= 0),
  frame_artwork_kobo bigint not null default 0 check (frame_artwork_kobo >= 0),
  packaging_kobo bigint not null default 0 check (packaging_kobo >= 0),
  labor_kobo bigint not null default 0 check (labor_kobo >= 0),
  processing_fee_kobo bigint not null default 0 check (processing_fee_kobo >= 0),
  other_kobo bigint not null default 0 check (other_kobo >= 0)
);

-- Storefront copy for the calculator and story sections (validated by the app).
create table if not exists public.combo_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.combo_settings (id) values (1) on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['combo_components','combo_component_options','combo_collections','combo_slots','combo_price_rules','combo_collection_costs','combo_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ JSON builders
create or replace function public._combo_component_json(c public.combo_components, with_costs boolean) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'kind', c.kind, 'description', c.description, 'image_url', c.image_url,
      'public_price_kobo', c.public_price_kobo, 'customisable', c.customisable, 'min_qty', c.min_qty, 'max_qty', c.max_qty,
      'available', (c.is_active and c.archived_at is null and c.inventory_status <> 'out_of_stock'),
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'group', o.grp, 'label', o.label)
                                  || case when with_costs then jsonb_build_object('internal_cost_kobo', o.internal_cost_kobo) else '{}'::jsonb end
                                order by o.grp, o.sort_order, o.label)
                             from public.combo_component_options o where o.component_id = c.id and o.is_active), '[]'::jsonb))
    || case when with_costs then jsonb_build_object('internal_cost_kobo', c.internal_cost_kobo) else '{}'::jsonb end
$$;

-- The whole working configuration of one collection as one document. with_costs = true is for the admin only.
create or replace function public._combo_config(cid uuid, with_costs boolean default false) returns jsonb
language plpgsql stable set search_path = public as $$
declare col public.combo_collections; res jsonb;
begin
  select * into col from public.combo_collections where id = cid;
  if not found then return null; end if;
  res := jsonb_build_object(
    'id', col.id, 'slug', col.slug, 'name', col.name, 'label', col.label, 'tagline', col.tagline, 'scripture_ref', col.scripture_ref,
    'scripture_text', col.scripture_text, 'description', col.description, 'image_url', col.image_url, 'sort_order', col.sort_order,
    'legacy_bundle_id', col.legacy_bundle_id, 'version', col.version,
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'label', s.label, 'quantity', s.quantity, 'mode', s.mode,
              'min_qty', s.min_qty, 'max_qty', s.max_qty, 'same_size_only', s.same_size_only, 'customise', s.customise, 'extra_price_kobo', s.extra_price_kobo,
              'sort_order', s.sort_order,
              'components', coalesce((select jsonb_agg(public._combo_component_json(cc, with_costs)
                                                       order by array_position(case when s.component_id is not null then array[s.component_id] else s.allowed_component_ids end, cc.id))
                                        from public.combo_components cc
                                       where cc.id = any(case when s.component_id is not null then array[s.component_id] else s.allowed_component_ids end)), '[]'::jsonb))
              order by s.sort_order, s.label)
            from public.combo_slots s where s.collection_id = col.id), '[]'::jsonb),
    'rules', jsonb_build_object(
      'base_price_kobo', col.base_price_kobo,
      'garment_adjust', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'component_id', r.component_id, 'amount_kobo', r.amount_kobo) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'garment_adjust' and r.is_active), '[]'::jsonb),
      'frame_size_adjust', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'option_id', r.option_id, 'amount_kobo', r.amount_kobo) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'frame_size_adjust' and r.is_active), '[]'::jsonb),
      'fixed_variants', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'component_id', r.component_id, 'signature', r.frame_signature, 'amount_kobo', r.amount_kobo, 'label', r.label) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'fixed_variant' and r.is_active), '[]'::jsonb),
      'discounts', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'type', r.discount_type, 'value', r.discount_value, 'label', r.label,
                                    'starts_at', r.starts_at, 'ends_at', r.ends_at) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind in ('promo','bundle_discount') and r.is_active), '[]'::jsonb)));
  if with_costs then
    res := res || jsonb_build_object('overheads', coalesce((select to_jsonb(c) - 'collection_id' from public.combo_collection_costs c where c.collection_id = col.id),
      jsonb_build_object('printing_apparel_kobo', 0, 'frame_artwork_kobo', 0, 'packaging_kobo', 0, 'labor_kobo', 0, 'processing_fee_kobo', 0, 'other_kobo', 0)));
  end if;
  return res;
end $$;

-- ------------------------------------------------------------------ public reads (no costs, published snapshots only)
create or replace function public.combo_public_list(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'collections', coalesce((select jsonb_agg(published_snapshot order by sort_order, name) from public.combo_collections where status = 'published' and published_snapshot is not null), '[]'::jsonb),
    -- components switched off or out of stock AFTER publishing are unavailable immediately, without re-publishing
    'unavailable', coalesce((select jsonb_agg(id) from public.combo_components where not is_active or archived_at is not null or inventory_status = 'out_of_stock'), '[]'::jsonb))
$$;

create or replace function public.combo_settings_get(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select settings from public.combo_settings where id = 1), '{}'::jsonb)
$$;

-- ------------------------------------------------------------------ admin: collections
create or replace function public._combo_is_admin(actor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = actor), false)
$$;

create or replace function public.admin_combos_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'label', c.label, 'status', c.status, 'sort_order', c.sort_order, 'image_url', c.image_url,
      'version', c.version, 'published_at', c.published_at, 'updated_at', c.updated_at,
      'has_unpublished_changes', (c.status = 'published' and (c.published_at is null or c.updated_at > c.published_at)),
      'config', public._combo_config(c.id, false),
      'orders', (select count(*)::int from public.order_items oi where oi.kind = 'combo' and oi.options->>'comboCollectionId' = c.id::text)
    ) order by c.sort_order, c.name), '[]'::jsonb) from public.combo_collections c);
end $$;

create or replace function public.admin_combo_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := (p->>'id')::uuid; adm boolean := public._combo_is_admin((p->>'actor')::uuid); col public.combo_collections;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into col from public.combo_collections where id = cid;
  if not found then return null; end if;
  return jsonb_build_object(
    'collection', to_jsonb(col) - 'published_snapshot',
    'has_unpublished_changes', (col.status = 'published' and (col.published_at is null or col.updated_at > col.published_at)),
    'slots', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order, s.label) from public.combo_slots s where s.collection_id = cid), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) - 'created_at' order by r.sort_order, r.created_at) from public.combo_price_rules r where r.collection_id = cid), '[]'::jsonb),
    'config', public._combo_config(cid, adm),
    'is_owner', adm,
    'orders', (select count(*)::int from public.order_items oi where oi.kind = 'combo' and oi.options->>'comboCollectionId' = cid::text));
end $$;

create or replace function public.admin_combo_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := nullif(p->>'id','')::uuid; c jsonb := p->'collection'; s jsonb; r jsonb; keep uuid[] := '{}'; sid uuid; rid uuid; i int := 0; ids uuid[];
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if c is null then raise exception 'nothing_to_save'; end if;
  if cid is null then
    insert into public.combo_collections (slug, name, label, tagline, scripture_ref, scripture_text, description, image_url, legacy_bundle_id, sort_order, base_price_kobo)
    values (c->>'slug', c->>'name', nullif(c->>'label',''), nullif(c->>'tagline',''), nullif(c->>'scripture_ref',''), nullif(c->>'scripture_text',''), nullif(c->>'description',''),
            nullif(c->>'image_url',''), nullif(c->>'legacy_bundle_id','')::uuid, coalesce((c->>'sort_order')::int, 0), nullif(c->>'base_price_kobo','')::bigint)
    returning id into cid;
  else
    update public.combo_collections set slug = c->>'slug', name = c->>'name', label = nullif(c->>'label',''), tagline = nullif(c->>'tagline',''),
      scripture_ref = nullif(c->>'scripture_ref',''), scripture_text = nullif(c->>'scripture_text',''), description = nullif(c->>'description',''),
      image_url = nullif(c->>'image_url',''), legacy_bundle_id = nullif(c->>'legacy_bundle_id','')::uuid, sort_order = coalesce((c->>'sort_order')::int, 0),
      base_price_kobo = nullif(c->>'base_price_kobo','')::bigint, updated_at = now()
     where id = cid;
    if not found then raise exception 'not_found'; end if;
  end if;

  if p ? 'slots' then
    i := 0;
    for s in select * from jsonb_array_elements(p->'slots') loop
      i := i + 1;
      if (s->>'kind') <> 'garment' and nullif(s->>'component_id','') is null then raise exception 'Choose the product for "%"', s->>'label'; end if;
      select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(s->'allowed_component_ids','[]'::jsonb)) x;
      sid := coalesce(nullif(s->>'id','')::uuid, gen_random_uuid());
      insert into public.combo_slots (id, collection_id, kind, label, component_id, allowed_component_ids, quantity, mode, min_qty, max_qty, same_size_only, customise, extra_price_kobo, sort_order)
      values (sid, cid, s->>'kind', s->>'label', nullif(s->>'component_id','')::uuid, ids, coalesce((s->>'quantity')::int,1), coalesce(s->>'mode','required'),
              coalesce((s->>'min_qty')::int,0), coalesce((s->>'max_qty')::int,1), coalesce((s->>'same_size_only')::boolean,false), coalesce((s->>'customise')::boolean,false),
              nullif(s->>'extra_price_kobo','')::bigint, i)
      on conflict (id) do update set kind = excluded.kind, label = excluded.label, component_id = excluded.component_id, allowed_component_ids = excluded.allowed_component_ids,
        quantity = excluded.quantity, mode = excluded.mode, min_qty = excluded.min_qty, max_qty = excluded.max_qty, same_size_only = excluded.same_size_only,
        customise = excluded.customise, extra_price_kobo = excluded.extra_price_kobo, sort_order = excluded.sort_order
        where public.combo_slots.collection_id = cid;
      keep := keep || sid;
    end loop;
    delete from public.combo_slots where collection_id = cid and not (id = any(keep));
  end if;

  if p ? 'rules' then
    keep := '{}'; i := 0;
    for r in select * from jsonb_array_elements(p->'rules') loop
      i := i + 1;
      rid := coalesce(nullif(r->>'id','')::uuid, gen_random_uuid());
      insert into public.combo_price_rules (id, collection_id, kind, component_id, option_id, frame_signature, amount_kobo, discount_type, discount_value, label, starts_at, ends_at, is_active, sort_order)
      values (rid, cid, r->>'kind', nullif(r->>'component_id','')::uuid, nullif(r->>'option_id','')::uuid, r->>'frame_signature', nullif(r->>'amount_kobo','')::bigint,
              nullif(r->>'discount_type',''), nullif(r->>'discount_value','')::bigint, nullif(r->>'label',''), nullif(r->>'starts_at','')::timestamptz, nullif(r->>'ends_at','')::timestamptz,
              coalesce((r->>'is_active')::boolean, true), i)
      on conflict (id) do update set kind = excluded.kind, component_id = excluded.component_id, option_id = excluded.option_id, frame_signature = excluded.frame_signature,
        amount_kobo = excluded.amount_kobo, discount_type = excluded.discount_type, discount_value = excluded.discount_value, label = excluded.label,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at, is_active = excluded.is_active, sort_order = excluded.sort_order
        where public.combo_price_rules.collection_id = cid;
      keep := keep || rid;
    end loop;
    delete from public.combo_price_rules where collection_id = cid and not (id = any(keep));
  end if;
  update public.combo_collections set updated_at = now() where id = cid;
  return jsonb_build_object('id', cid);
end $$;

create or replace function public.admin_combo_publish(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := (p->>'id')::uuid; cfg jsonb;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if not exists (select 1 from public.combo_slots where collection_id = cid and kind = 'garment' and mode = 'required') then raise exception 'Add a garment to the package before publishing.'; end if;
  cfg := public._combo_config(cid, false);
  if cfg is null then raise exception 'not_found'; end if;
  update public.combo_collections set status = 'published', published_snapshot = cfg || jsonb_build_object('version', version + 1), published_at = now(), version = version + 1, updated_at = now()
   where id = cid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_combo_set_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if (p->>'status') not in ('draft','archived') then raise exception 'bad_status'; end if;
  update public.combo_collections set status = p->>'status', updated_at = now() where id = (p->>'id')::uuid;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_combo_duplicate(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare src public.combo_collections; nid uuid := gen_random_uuid(); nslug text; n int := 1; idmap jsonb := '{}'::jsonb; s record;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into src from public.combo_collections where id = (p->>'id')::uuid;
  if not found then raise exception 'not_found'; end if;
  nslug := left(src.slug, 50) || '-copy';
  while exists (select 1 from public.combo_collections where slug = nslug) loop n := n + 1; nslug := left(src.slug, 50) || '-copy-' || n; end loop;
  insert into public.combo_collections (id, slug, name, label, tagline, scripture_ref, scripture_text, description, image_url, legacy_bundle_id, sort_order, status, base_price_kobo)
  values (nid, nslug, left(src.name, 70) || ' (Copy)', src.label, src.tagline, src.scripture_ref, src.scripture_text, src.description, src.image_url, null, src.sort_order + 1, 'draft', src.base_price_kobo);
  insert into public.combo_slots (collection_id, kind, label, component_id, allowed_component_ids, quantity, mode, min_qty, max_qty, same_size_only, customise, extra_price_kobo, sort_order)
    select nid, kind, label, component_id, allowed_component_ids, quantity, mode, min_qty, max_qty, same_size_only, customise, extra_price_kobo, sort_order from public.combo_slots where collection_id = src.id;
  insert into public.combo_price_rules (collection_id, kind, component_id, option_id, frame_signature, amount_kobo, discount_type, discount_value, label, starts_at, ends_at, is_active, sort_order)
    select nid, kind, component_id, option_id, frame_signature, amount_kobo, discount_type, discount_value, label, starts_at, ends_at, is_active, sort_order from public.combo_price_rules where collection_id = src.id;
  insert into public.combo_collection_costs select nid, printing_apparel_kobo, frame_artwork_kobo, packaging_kobo, labor_kobo, processing_fee_kobo, other_kobo from public.combo_collection_costs where collection_id = src.id;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.admin_combo_reorder(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x text; i int := 0;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  for x in select jsonb_array_elements_text(p->'ids') loop i := i + 1; update public.combo_collections set sort_order = i where id = x::uuid; end loop;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_combo_delete(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := (p->>'id')::uuid;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if exists (select 1 from public.order_items oi where oi.kind = 'combo' and oi.options->>'comboCollectionId' = cid::text) then
    raise exception 'Customers have ordered this combo, so it cannot be deleted. Archive it instead.';
  end if;
  if exists (select 1 from public.combo_collections where id = cid and status = 'published') then raise exception 'Unpublish it first, then delete.'; end if;
  delete from public.combo_collections where id = cid;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------ admin: costs (OWNERS ONLY)
create or replace function public.admin_combo_costs_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := p->'costs';
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if not public._combo_is_admin((p->>'actor')::uuid) then raise exception 'forbidden'; end if;
  insert into public.combo_collection_costs (collection_id, printing_apparel_kobo, frame_artwork_kobo, packaging_kobo, labor_kobo, processing_fee_kobo, other_kobo)
  values ((p->>'id')::uuid, coalesce((c->>'printing_apparel_kobo')::bigint,0), coalesce((c->>'frame_artwork_kobo')::bigint,0), coalesce((c->>'packaging_kobo')::bigint,0),
          coalesce((c->>'labor_kobo')::bigint,0), coalesce((c->>'processing_fee_kobo')::bigint,0), coalesce((c->>'other_kobo')::bigint,0))
  on conflict (collection_id) do update set printing_apparel_kobo = excluded.printing_apparel_kobo, frame_artwork_kobo = excluded.frame_artwork_kobo,
    packaging_kobo = excluded.packaging_kobo, labor_kobo = excluded.labor_kobo, processing_fee_kobo = excluded.processing_fee_kobo, other_kobo = excluded.other_kobo;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------ admin: component library
create or replace function public.admin_components_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm boolean := public._combo_is_admin((p->>'actor')::uuid);
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return (select coalesce(jsonb_agg(public._combo_component_json(c, adm) || jsonb_build_object(
      'is_active', c.is_active, 'archived_at', c.archived_at, 'inventory_status', c.inventory_status, 'sort_order', c.sort_order,
      'all_options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'group', o.grp, 'label', o.label, 'is_active', o.is_active, 'sort_order', o.sort_order)
                                      || case when adm then jsonb_build_object('internal_cost_kobo', o.internal_cost_kobo) else '{}'::jsonb end order by o.grp, o.sort_order, o.label)
                                from public.combo_component_options o where o.component_id = c.id), '[]'::jsonb),
      'used_in', (select count(*)::int from public.combo_slots s where s.component_id = c.id or c.id = any(s.allowed_component_ids)))
    order by c.kind, c.sort_order, c.name), '[]'::jsonb) from public.combo_components c);
end $$;

create or replace function public.admin_component_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := p->'component'; cid uuid := nullif(c->>'id','')::uuid; adm boolean := public._combo_is_admin((p->>'actor')::uuid); o jsonb; keep uuid[] := '{}'; oid uuid; i int := 0;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if cid is null then
    insert into public.combo_components (slug, name, kind, description, image_url, internal_cost_kobo, public_price_kobo, customisable, min_qty, max_qty, inventory_status, is_active, sort_order)
    values (c->>'slug', c->>'name', c->>'kind', nullif(c->>'description',''), nullif(c->>'image_url',''),
            case when adm then nullif(c->>'internal_cost_kobo','')::bigint end, nullif(c->>'public_price_kobo','')::bigint, coalesce((c->>'customisable')::boolean,false),
            coalesce((c->>'min_qty')::int,0), coalesce((c->>'max_qty')::int,1), coalesce(c->>'inventory_status','made_to_order'), coalesce((c->>'is_active')::boolean,true), coalesce((c->>'sort_order')::int,0))
    returning id into cid;
  else
    update public.combo_components set name = c->>'name', description = nullif(c->>'description',''), image_url = nullif(c->>'image_url',''),
      internal_cost_kobo = case when adm then nullif(c->>'internal_cost_kobo','')::bigint else internal_cost_kobo end,
      public_price_kobo = nullif(c->>'public_price_kobo','')::bigint, customisable = coalesce((c->>'customisable')::boolean,false),
      min_qty = coalesce((c->>'min_qty')::int,0), max_qty = coalesce((c->>'max_qty')::int,1), inventory_status = coalesce(c->>'inventory_status','made_to_order'),
      is_active = coalesce((c->>'is_active')::boolean,true), sort_order = coalesce((c->>'sort_order')::int,0), updated_at = now()
     where id = cid;
    if not found then raise exception 'not_found'; end if;
  end if;
  if p ? 'options' then
    for o in select * from jsonb_array_elements(p->'options') loop
      i := i + 1;
      oid := coalesce(nullif(o->>'id','')::uuid, gen_random_uuid());
      insert into public.combo_component_options (id, component_id, grp, slug, label, internal_cost_kobo, is_active, sort_order)
      values (oid, cid, o->>'grp', o->>'slug', o->>'label', case when adm then nullif(o->>'internal_cost_kobo','')::bigint end, coalesce((o->>'is_active')::boolean,true), i)
      on conflict (id) do update set label = excluded.label, is_active = excluded.is_active, sort_order = excluded.sort_order,
        internal_cost_kobo = case when adm then excluded.internal_cost_kobo else public.combo_component_options.internal_cost_kobo end
        where public.combo_component_options.component_id = cid;
      keep := keep || oid;
    end loop;
    -- options that disappeared from the form are switched off (never deleted: published snapshots and orders refer to them)
    update public.combo_component_options set is_active = false where component_id = cid and not (id = any(keep));
  end if;
  return jsonb_build_object('id', cid);
end $$;

create or replace function public.admin_component_archive(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  update public.combo_components set archived_at = case when coalesce((p->>'archive')::boolean, true) then now() else null end,
    is_active = not coalesce((p->>'archive')::boolean, true), updated_at = now() where id = (p->>'id')::uuid;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_component_delete(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := (p->>'id')::uuid;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if exists (select 1 from public.combo_slots s where s.component_id = cid or cid = any(s.allowed_component_ids)) then raise exception 'This item is used in a combo. Remove it from the combo first, or archive it.'; end if;
  if exists (select 1 from public.order_items oi where oi.kind = 'combo' and oi.selections::text like '%' || cid::text || '%') then raise exception 'Customers have ordered this item, so it cannot be deleted. Archive it instead.'; end if;
  delete from public.combo_components where id = cid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_combo_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  insert into public.combo_settings (id, settings, updated_at) values (1, coalesce(p->'settings','{}'::jsonb), now())
  on conflict (id) do update set settings = excluded.settings, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------ staff permission ("Products and gift boxes" = catalogue)
do $$
begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values
      ('admin_combos_list', array['catalogue']), ('admin_combo_get', array['catalogue']), ('admin_combo_save', array['catalogue']),
      ('admin_combo_publish', array['catalogue']), ('admin_combo_set_status', array['catalogue']), ('admin_combo_duplicate', array['catalogue']),
      ('admin_combo_reorder', array['catalogue']), ('admin_components_list', array['catalogue']), ('admin_component_save', array['catalogue']),
      ('admin_component_archive', array['catalogue']), ('admin_combo_settings_save', array['content'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;

-- ------------------------------------------------------------------ starting content (idempotent; NO selling prices are invented)
-- Internal reference costs supplied by the owner; selling prices are left empty for the owner to set.
insert into public.combo_components (slug, name, kind, description, internal_cost_kobo, customisable, max_qty, sort_order, is_active) values
  ('premium-tshirt',  'Premium Cotton T-shirt', 'garment', 'Premium cotton, 240–300 GSM.', 1000000, true, 1, 1, true),
  ('sweatshirt',      'Sweatshirt',             'garment', 'Heavyweight sweatshirt.',        1500000, true, 1, 2, true),
  ('hoodie',          'Hoodie',                 'garment', 'Heavyweight hoodie.',            2000000, true, 1, 3, true),
  ('normal-tshirt',   'Normal T-shirt',         'garment', 'Everyday cotton, 120–160 GSM. Reference only: not offered in the combos.', 300000, true, 1, 9, false),
  ('custom-frame',    'Customised Frame',       'frame',   'Framed Scripture print, customised for you.', null, true, 1, 1, true)
on conflict (slug) do nothing;

insert into public.combo_components (slug, name, kind, description, internal_cost_kobo, customisable, max_qty, sort_order, is_active) values
  ('diary-2027',      '2027 Diary',     'item', 'A 2027 diary for planning, prayer and reflection.', 700000, false, 1, 1, true),
  ('pen',             'Pen',            'item', null, 100000, false, 1, 2, true),
  ('highlight-pen',   'Highlight Pen',  'item', null, 100000, false, 1, 3, true),
  ('sticky-notes',    'Sticky Notes',   'item', null,  50000, false, 1, 4, true),
  ('perfume',         'Perfume',        'item', 'An optional gift upgrade.', 1000000, false, 1, 5, true)
on conflict (slug) do nothing;

-- Recommended extras start switched off (draft) until the owner enables them.
insert into public.combo_components (slug, name, kind, description, customisable, max_qty, sort_order, is_active) values
  ('scripture-promise-cards', 'Scripture Promise Cards',         'item', 'A set of Scripture promise cards.', false, 1, 10, false),
  ('scripture-bookmark',      'Scripture Bookmark',              'item', null, false, 1, 11, false),
  ('prayer-reflection-cards', 'Prayer and Reflection Cards',     'item', null, false, 1, 12, false),
  ('living-the-word-30-day',  '30-Day Living the Word Challenge','item', 'A 30-day challenge to live what you read.', false, 1, 13, false),
  ('word-for-this-season',    'Personalized Word for This Season Card', 'item', 'A card with a Word for your season, written for you.', true, 1, 14, false)
on conflict (slug) do nothing;

insert into public.combo_component_options (component_id, grp, slug, label, sort_order)
  select c.id, 'size', s.slug, s.label, s.ord from public.combo_components c,
    (values ('s','S',1),('m','M',2),('l','L',3),('xl','XL',4),('xxl','XXL',5)) as s(slug,label,ord)
   where c.slug in ('premium-tshirt','sweatshirt','hoodie','normal-tshirt')
on conflict do nothing;
insert into public.combo_component_options (component_id, grp, slug, label, sort_order)
  select c.id, 'colour', s.slug, s.label, s.ord from public.combo_components c,
    (values ('black','Black',1),('white','White',2),('sand','Sand',3)) as s(slug,label,ord)
   where c.slug in ('premium-tshirt','sweatshirt','hoodie','normal-tshirt')
on conflict do nothing;
insert into public.combo_component_options (component_id, grp, slug, label, internal_cost_kobo, sort_order)
  select c.id, 'frame_size', s.slug, s.label, s.cost, s.ord from public.combo_components c,
    (values ('12x16','12 × 16 inches',900000,1),('16x20','16 × 20 inches',1600000,2)) as s(slug,label,cost,ord)
   where c.slug = 'custom-frame'
on conflict do nothing;

insert into public.combo_collections (slug, name, label, tagline, scripture_ref, description, sort_order, status) values
  ('behold', 'BEHOLD COLLECTION', 'Basic', 'See the Word. Remember the Promise.', 'Psalm 119:18',
   'A customised garment and a customised frame, so the promise you are holding on to stays in front of your eyes.', 1, 'draft'),
  ('abide', 'ABIDE COLLECTION', 'Max', 'Surround Yourself With the Word.', 'John 15:7',
   'A customised garment and three customised frames, so the Word fills the room you live in.', 2, 'draft'),
  ('doers', 'THE DOER''S COLLECTION', 'Best', 'Beyond Reading. Living the Word.', 'James 1:22',
   'A customised garment and frame, plus a 2027 diary, pen, highlight pen and sticky notes to help you write it, reflect on it and live it.', 3, 'draft')
on conflict (slug) do nothing;

-- Point each new collection at the older combo bundle it replaces (if one exists). The bundle itself is never changed or deleted.
update public.combo_collections c set legacy_bundle_id = (select b.id from public.bundles b where b.kind = 'combo' and b.name ilike '%basic%' order by b.sort_order limit 1) where c.slug = 'behold' and c.legacy_bundle_id is null;
update public.combo_collections c set legacy_bundle_id = (select b.id from public.bundles b where b.kind = 'combo' and b.name ilike '%max%' order by b.sort_order limit 1) where c.slug = 'abide' and c.legacy_bundle_id is null;
update public.combo_collections c set legacy_bundle_id = (select b.id from public.bundles b where b.kind = 'combo' and b.name ilike '%best%' order by b.sort_order limit 1) where c.slug = 'doers' and c.legacy_bundle_id is null;

-- Slots: only when a collection has none yet, so re-running this migration never duplicates or overwrites the owner's edits.
do $$
declare garments uuid[]; frame uuid; col record;
begin
  select array_agg(id order by sort_order) into garments from public.combo_components where slug in ('premium-tshirt','sweatshirt','hoodie');
  select id into frame from public.combo_components where slug = 'custom-frame';
  for col in select id, slug from public.combo_collections where slug in ('behold','abide','doers') and not exists (select 1 from public.combo_slots s where s.collection_id = combo_collections.id) loop
    insert into public.combo_slots (collection_id, kind, label, allowed_component_ids, quantity, mode, customise, sort_order) values (col.id, 'garment', 'Customised garment', garments, 1, 'required', true, 1);
    insert into public.combo_slots (collection_id, kind, label, component_id, quantity, mode, customise, sort_order)
      values (col.id, 'frame', 'Customised frame', frame, case when col.slug = 'abide' then 3 else 1 end, 'required', true, 2);
    if col.slug = 'doers' then
      insert into public.combo_slots (collection_id, kind, label, component_id, quantity, mode, max_qty, sort_order)
        select col.id, 'item', c.name, c.id, 1, 'required', 1, 10 + c.sort_order from public.combo_components c where c.slug in ('diary-2027','pen','highlight-pen','sticky-notes');
      insert into public.combo_slots (collection_id, kind, label, component_id, quantity, mode, min_qty, max_qty, customise, sort_order)
        select col.id, 'item', c.name, c.id, 1, 'optional', 0, 1, c.customisable, 30 + c.sort_order from public.combo_components c
         where c.slug in ('perfume','scripture-promise-cards','scripture-bookmark','prayer-reflection-cards','living-the-word-30-day','word-for-this-season');
    end if;
  end loop;
end $$;

insert into public.combo_collection_costs (collection_id) select id from public.combo_collections on conflict do nothing;

-- ------------------------------------------------------------------ lock down
do $$
declare f text;
begin
  foreach f in array array['_combo_component_json(public.combo_components,boolean)','_combo_config(uuid,boolean)','_combo_is_admin(uuid)','combo_public_list(jsonb)','combo_settings_get(jsonb)',
    'admin_combos_list(jsonb)','admin_combo_get(jsonb)','admin_combo_save(jsonb)','admin_combo_publish(jsonb)','admin_combo_set_status(jsonb)','admin_combo_duplicate(jsonb)',
    'admin_combo_reorder(jsonb)','admin_combo_delete(jsonb)','admin_combo_costs_save(jsonb)','admin_components_list(jsonb)','admin_component_save(jsonb)',
    'admin_component_archive(jsonb)','admin_component_delete(jsonb)','admin_combo_settings_save(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
