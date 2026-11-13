-- 0019: detailed staff roles (Store Manager, Content Editor, Fulfilment, Support, or a custom mix).
--
-- profiles.role stays the coarse gate (customer / staff / admin). Staff accounts get a list of permissions in a
-- separate, service-role-only table (so no customer or staff session can ever edit its own permissions).
-- Admins (owners) always have everything. Staff with no row keep exactly what Staff can do today
-- (orders, fulfilment, customers, reviews), so nothing changes for existing staff until an admin says so.
--
-- Enforcement is in the database: _require() looks up which permission the calling admin function needs
-- (admin_function_permissions) and checks it against the staff member's permissions. Functions that are not
-- listed keep their old rule (admin only, or any staff). Money, settings, team and activity stay admin only.
--
-- Rollback: supabase/rollback/0019_staff_permissions.sql (restores the 0017 _require).

create table if not exists public.staff_permissions (
  id uuid primary key references public.profiles(id) on delete cascade,
  permissions text[] not null default '{}',
  preset text,
  updated_at timestamptz not null default now(),
  constraint staff_permissions_known check (permissions <@ array['orders','fulfilment','customers','reviews','catalogue','content','marketing','reports']::text[])
);
alter table public.staff_permissions enable row level security;  -- no policies: service role only
revoke all on public.staff_permissions from anon, authenticated;

create table if not exists public.admin_function_permissions (
  fn text primary key,
  permissions text[] not null
);
alter table public.admin_function_permissions enable row level security;
revoke all on public.admin_function_permissions from anon, authenticated;

insert into public.admin_function_permissions (fn, permissions) values
  ('admin_orders_list',       array['orders','fulfilment']),
  ('admin_order_get',         array['orders','fulfilment']),
  ('admin_order_note',        array['orders','fulfilment']),
  ('admin_set_status',        array['orders','fulfilment']),
  ('admin_crypto_get',        array['orders']),
  ('admin_quotes_list',       array['orders']),
  ('admin_quote_update',      array['orders']),
  ('admin_quote_to_order',    array['orders']),
  ('admin_board',             array['fulfilment','orders']),
  ('admin_proofs_queue',      array['fulfilment','orders']),
  ('admin_proof_send',        array['fulfilment','orders']),
  ('admin_inventory_log',     array['catalogue','fulfilment']),
  ('admin_customers_list',    array['customers']),
  ('admin_reviews_list',      array['reviews']),
  ('admin_review_moderate',   array['reviews']),
  ('admin_catalogue_list',    array['catalogue']),
  ('admin_product_get',       array['catalogue']),
  ('admin_bundle_get',        array['catalogue']),
  ('admin_bundle_save',       array['catalogue']),
  ('admin_images_save',       array['catalogue']),
  ('admin_variants_generate', array['catalogue']),
  ('admin_inventory_adjust',  array['catalogue']),
  ('admin_website_save',      array['content']),
  ('admin_website_history',   array['content']),
  ('admin_website_restore',   array['content']),
  ('admin_discounts_list',    array['marketing']),
  ('admin_ambassador_create', array['marketing']),
  ('admin_reports',           array['reports'])
on conflict (fn) do update set permissions = excluded.permissions;

-- Website editor data for content editors (admin_settings_get stays owner only: it includes delivery zones).
create or replace function public.admin_website_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'settings', (select jsonb_build_object('website_content', s.website_content, 'website_revision', s.website_revision, 'hero_headline', s.hero_headline,
                   'hero_copy', s.hero_copy, 'hero_image_url', s.hero_image_url, 'hero_image_alt', s.hero_image_alt) from public.settings s limit 1),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]') from public.products where is_active and type not in ('gift_card')));
end $$;
insert into public.admin_function_permissions (fn, permissions) values ('admin_website_get', array['content'])
on conflict (fn) do update set permissions = excluded.permissions;

-- Permissions of a staff member (legacy default when no row exists).
create or replace function public._staff_perms(actor uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select permissions from public.staff_permissions where id = actor), array['orders','fulfilment','customers','reviews'])
$$;

-- Name of the function that called _require, read from the PL/pgSQL call stack.
create or replace function public._caller_fn() returns text
language plpgsql stable as $$
declare ctx text; ln text; m text[];
begin
  get diagnostics ctx = pg_context;
  -- The stack lists this function, then _require, then the admin function that called _require
  -- (with "SQL statement" lines in between). Return the first function that is neither of the first two.
  foreach ln in array string_to_array(ctx, E'\n') loop
    m := regexp_match(ln, '^PL/pgSQL function (?:public\.)?"?([a-z_0-9]+)"?\(');
    if m is null then m := regexp_match(ln, '^SQL function "([a-z_0-9]+)"'); end if;
    if m is not null and m[1] not in ('_caller_fn', '_require') then return m[1]; end if;
  end loop;
  return null;
end $$;

create or replace function public._require(actor uuid, roles text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
declare r text; needed text[]; caller text;
begin
  r := coalesce((select role from public.profiles where id = actor), 'none');
  if actor is null or r not in ('staff', 'admin') then
    if not (r = any(roles)) then raise exception 'forbidden'; end if;
  elsif r = 'staff' then
    caller := public._caller_fn();
    if caller = 'admin_save' then
      needed := string_to_array(nullif(current_setting('app.required_perm', true), ''), ',');
    else
      select afp.permissions into needed from public.admin_function_permissions afp where afp.fn = caller;
    end if;
    if needed is not null then
      if not (public._staff_perms(actor) && needed) then raise exception 'forbidden'; end if;
    elsif not ('staff' = any(roles)) then
      raise exception 'forbidden';
    end if;
  end if;
  perform set_config('app.actor', actor::text, true);
end $$;

-- admin_save edits several tables; the permission depends on the table.
create or replace function public.admin_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[]; t text := p->>'table';
begin
  perform set_config('app.required_perm', case
    when t in ('collections','designs','products','product_variants','bundles') then 'catalogue'
    when t in ('discount_codes','ambassadors') then 'marketing'
    else '' end, true);  -- delivery_zones and anything else: admin only
  perform public._require((p->>'actor')::uuid, array['admin']);
  perform set_config('app.required_perm', '', true);
  allowed := case t
    when 'collections' then array['slug','name','intro','hero_image','sort_order','is_active','is_seasonal']
    when 'designs' then array['slug','name','story_or_verse','verse_reference','collection_id','artwork_front','artwork_back','preview_image','allowed_product_types','is_customisable','customisable_fields','is_active']
    when 'products' then array['slug','name','type','design_id','collection_id','description','care','base_price_kobo','compare_at_kobo','is_made_to_order','is_active','is_featured','is_seasonal','seo_title','seo_description','themes','brand_collections','weight_grams']
    when 'product_variants' then array['product_id','sku','colour','size','option','option_group','price_kobo','is_active']
    when 'bundles' then array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']
    when 'delivery_zones' then array['name','states','fee_kobo','free_over_kobo','lead_days','christmas_cutoff_date','sort_order','cities','provider','service','is_active','rate_verified','free_shipping_eligible','min_days','max_days','weight_allowance_grams','additional_kg_kobo']
    when 'discount_codes' then array['code','type','value','min_spend_kobo','starts_at','ends_at','usage_limit','per_customer_limit','collection_ids','product_ids','is_single_use','is_active']
    when 'ambassadors' then array['name','phone','email','commission_rate','payout_note','is_active']
    else null end;
  if allowed is null then raise exception 'bad_table'; end if;
  return jsonb_build_object('id', public._save_row(t, p->'row', allowed));
end $$;

-- What the signed-in staff member may do (used by the admin app to show the right menu).
create or replace function public.staff_permissions_get(p jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select case (select role from public.profiles where id = (p->>'id')::uuid)
    when 'admin' then jsonb_build_object('role', 'admin', 'permissions', to_jsonb(array['orders','fulfilment','customers','reviews','catalogue','content','marketing','reports']), 'preset', 'owner')
    when 'staff' then jsonb_build_object('role', 'staff', 'permissions', to_jsonb(public._staff_perms((p->>'id')::uuid)),
                                         'preset', (select preset from public.staff_permissions where id = (p->>'id')::uuid))
    else null end
$$;

-- Team list now includes each staff member's permissions.
create or replace function public.admin_team_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'email', pr.email, 'name', pr.full_name, 'role', pr.role,
      'permissions', case when pr.role = 'staff' then to_jsonb(public._staff_perms(pr.id)) end,
      'preset', sp.preset,
      'last_sign_in_at', u.last_sign_in_at) order by case pr.role when 'admin' then 0 else 1 end, pr.email)
    from public.profiles pr left join auth.users u on u.id = pr.id left join public.staff_permissions sp on sp.id = pr.id
    where pr.role in ('staff', 'admin')), '[]'::jsonb);
end $$;

-- Set a staff member's permissions (admin only). Changing someone's role away from staff keeps the row
-- harmlessly; it only applies while they are staff.
create or replace function public.admin_set_permissions(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; target public.profiles; perms text[];
begin
  perform public._require(actor, array['admin']);
  select * into target from public.profiles where id = (p->>'id')::uuid;
  if target.id is null then raise exception 'account_not_found'; end if;
  if target.role <> 'staff' then raise exception 'not_staff'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into perms from jsonb_array_elements_text(coalesce(p->'permissions', '[]'::jsonb)) x;
  if not perms <@ array['orders','fulfilment','customers','reviews','catalogue','content','marketing','reports'] then raise exception 'invalid_permission'; end if;
  if cardinality(perms) = 0 then raise exception 'permission_required'; end if;
  insert into public.staff_permissions (id, permissions, preset, updated_at) values (target.id, perms, nullif(left(p->>'preset', 30), ''), now())
  on conflict (id) do update set permissions = excluded.permissions, preset = excluded.preset, updated_at = now();
  return jsonb_build_object('id', target.id, 'permissions', perms);
end $$;

drop trigger if exists audit_staff_permissions on public.staff_permissions;
create trigger audit_staff_permissions after insert or update or delete on public.staff_permissions
  for each row execute function public._audit_row('updated_at', '');

do $$
declare f text;
begin
  foreach f in array array['admin_website_get(jsonb)','_staff_perms(uuid)','_caller_fn()','staff_permissions_get(jsonb)','admin_team_list(jsonb)','admin_set_permissions(jsonb)','admin_save(jsonb)','_require(uuid,text[])']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
