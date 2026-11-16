-- 0023: pre-sale. People fill in a pre-order form (what they want, sizes, location, notes); the team sees every request
-- in the admin, with totals by garment and size for production planning. No payment is taken at this stage.
--
-- Everything goes through service-role-only functions. The public form calls presale_submit; the team uses the admin_presale_* functions,
-- which need the "orders" permission for staff (owners always can). Rollback: supabase/rollback/0023_presale.sql

create sequence if not exists public.presale_ref_seq start 1001;

create table if not exists public.presale_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('PRE-' || nextval('public.presale_ref_seq')),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 30),
  state text not null check (char_length(state) between 2 and 40),
  city text not null check (char_length(city) between 1 and 80),
  address text check (char_length(address) <= 300),
  -- [{ "garment": "tee" | "sweatshirt" | "hoodie", "sizes": { "S": 1, "M": 2, ... } }]
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total_qty int not null check (total_qty between 1 and 500),
  notes text check (char_length(notes) <= 1500),
  whatsapp_updates boolean not null default true,
  status text not null default 'new' check (status in ('new','contacted','confirmed','cancelled')),
  admin_note text check (char_length(admin_note) <= 1500),
  updated_at timestamptz not null default now()
);
create index if not exists presale_requests_status_idx on public.presale_requests (status, created_at desc);
alter table public.presale_requests enable row level security;   -- no policies: service role only
revoke all on public.presale_requests from anon, authenticated;

-- One row of owner-editable settings (headline, dates, poster image, offers...). Validated by the app.
create table if not exists public.presale_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.presale_config enable row level security;
revoke all on public.presale_config from anon, authenticated;
insert into public.presale_config (id) values (1) on conflict do nothing;

create or replace function public.presale_config_get(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select config from public.presale_config where id = 1), '{}'::jsonb)
$$;

create or replace function public.presale_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; sz jsonb; k text; qty int; total int := 0; clean jsonb := '[]'::jsonb; sizes_clean jsonb; rid uuid; ref text;
begin
  if jsonb_typeof(p->'items') <> 'array' then raise exception 'bad_items'; end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    if (it->>'garment') not in ('tee','sweatshirt','hoodie') then raise exception 'bad_garment'; end if;
    sizes_clean := '{}'::jsonb;
    for k, sz in select * from jsonb_each(coalesce(it->'sizes', '{}'::jsonb)) loop
      if k not in ('S','M','L','XL','XXL') then raise exception 'bad_size'; end if;
      qty := coalesce((sz #>> '{}')::int, 0);
      if qty < 0 or qty > 100 then raise exception 'bad_quantity'; end if;
      if qty > 0 then sizes_clean := sizes_clean || jsonb_build_object(k, qty); total := total + qty; end if;
    end loop;
    if sizes_clean <> '{}'::jsonb then clean := clean || jsonb_build_array(jsonb_build_object('garment', it->>'garment', 'sizes', sizes_clean)); end if;
  end loop;
  if total < 1 or total > 500 then raise exception 'bad_quantity'; end if;
  insert into public.presale_requests (name, email, phone, state, city, address, items, total_qty, notes, whatsapp_updates)
  values (btrim(p->>'name'), lower(btrim(p->>'email')), btrim(p->>'phone'), btrim(p->>'state'), btrim(p->>'city'),
          nullif(btrim(coalesce(p->>'address','')), ''), clean, total, nullif(btrim(coalesce(p->>'notes','')), ''), coalesce((p->>'whatsapp_updates')::boolean, true))
  returning id, reference into rid, ref;
  return jsonb_build_object('id', rid, 'reference', ref, 'total_qty', total, 'items', clean);
end $$;

-- Admin: all requests (newest first) plus totals by garment and size.
create or replace function public.admin_presale_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := nullif(p->>'status','');
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'requests', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
                   from public.presale_requests r where (st is null or r.status = st)),
    'counts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*)::int n from public.presale_requests group by status) c),
    -- totals exclude cancelled requests
    'totals', (select coalesce(jsonb_agg(jsonb_build_object('garment', garment, 'size', size, 'qty', qty) order by garment, size), '[]'::jsonb)
                 from (select i->>'garment' as garment, s.key as size, sum((s.value #>> '{}')::int)::int as qty
                         from public.presale_requests r, jsonb_array_elements(r.items) i, jsonb_each(i->'sizes') s
                        where r.status <> 'cancelled' group by 1, 2) t));
end $$;

create or replace function public.admin_presale_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if (p->>'status') not in ('new','contacted','confirmed','cancelled') then raise exception 'bad_status'; end if;
  update public.presale_requests set status = p->>'status', admin_note = nullif(btrim(coalesce(p->>'admin_note','')), ''), updated_at = now()
   where id = (p->>'id')::uuid;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_presale_config_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  insert into public.presale_config (id, config, updated_at) values (1, coalesce(p->'config', '{}'::jsonb), now())
  on conflict (id) do update set config = excluded.config, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Staff need the "orders" permission (migration 0019). Skipped quietly if 0019 has not been applied yet.
do $$
begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values
      ('admin_presale_list', array['orders']), ('admin_presale_update', array['orders'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['presale_config_get(jsonb)','presale_submit(jsonb)','admin_presale_list(jsonb)','admin_presale_update(jsonb)','admin_presale_config_save(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
