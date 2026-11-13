-- 0021: product status (draft / active / archived) and CSV import.
--
-- Status: products.status is the source of truth in the admin. The storefront still reads products.is_active,
-- which a trigger keeps in step (active ⇔ is_active), so no storefront query had to change and older admin code
-- that only sets is_active keeps working (true → active, false → draft, archived stays archived).
--
-- Import: admin_products_import takes parsed CSV rows (one per variant, product fields repeated) and creates or
-- updates products by slug and variants by SKU in ONE transaction: any error rolls everything back. With
-- dry_run it only reports what would happen. Stock changes are logged as inventory adjustments.
--
-- Rollback: supabase/rollback/0021_product_status_import.sql

alter table public.products add column if not exists status text;
update public.products set status = case when is_active then 'active' else 'draft' end where status is null;
alter table public.products alter column status set not null;
do $$ begin
  alter table public.products add constraint products_status_check check (status in ('draft', 'active', 'archived'));
exception when duplicate_object then null; end $$;
create index if not exists products_status_idx on public.products(status);

create or replace function public._product_status_sync() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if new.status is null then new.status := case when new.is_active then 'active' else 'draft' end;
    else new.is_active := (new.status = 'active'); end if;
  elsif new.status is distinct from old.status then
    new.is_active := (new.status = 'active');
  elsif new.is_active is distinct from old.is_active then
    new.status := case when new.is_active then 'active' when old.status = 'archived' then 'archived' else 'draft' end;
  end if;
  return new;
end $$;
drop trigger if exists products_status_sync on public.products;
create trigger products_status_sync before insert or update on public.products
  for each row execute function public._product_status_sync();

-- admin_save: products may now save `status`. (Same permission handling as 0019; harmless without it.)
create or replace function public.admin_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[]; t text := p->>'table';
begin
  perform set_config('app.required_perm', case
    when t in ('collections','designs','products','product_variants','bundles') then 'catalogue'
    when t in ('discount_codes','ambassadors') then 'marketing'
    else '' end, true);
  perform public._require((p->>'actor')::uuid, array['admin']);
  perform set_config('app.required_perm', '', true);
  allowed := case t
    when 'collections' then array['slug','name','intro','hero_image','sort_order','is_active','is_seasonal']
    when 'designs' then array['slug','name','story_or_verse','verse_reference','collection_id','artwork_front','artwork_back','preview_image','allowed_product_types','is_customisable','customisable_fields','is_active']
    when 'products' then array['slug','name','type','design_id','collection_id','description','care','base_price_kobo','compare_at_kobo','is_made_to_order','is_active','status','is_featured','is_seasonal','seo_title','seo_description','themes','brand_collections','weight_grams']
    when 'product_variants' then array['product_id','sku','colour','size','option','option_group','price_kobo','is_active']
    when 'bundles' then array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']
    when 'delivery_zones' then array['name','states','fee_kobo','free_over_kobo','lead_days','christmas_cutoff_date','sort_order','cities','provider','service','is_active','rate_verified','free_shipping_eligible','min_days','max_days','weight_allowance_grams','additional_kg_kobo']
    when 'discount_codes' then array['code','type','value','min_spend_kobo','starts_at','ends_at','usage_limit','per_customer_limit','collection_ids','product_ids','is_single_use','is_active']
    when 'ambassadors' then array['name','phone','email','commission_rate','payout_note','is_active']
    else null end;
  if allowed is null then raise exception 'bad_table'; end if;
  return jsonb_build_object('id', public._save_row(t, p->'row', allowed));
end $$;

-- Catalogue list: include status.
create or replace function public.admin_catalogue_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'collections', (select coalesce(jsonb_agg(to_jsonb(c) - 'search' order by c.sort_order), '[]') from public.collections c),
    'designs', (select coalesce(jsonb_agg(to_jsonb(d) order by d.name), '[]') from public.designs d),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'slug', pr.slug, 'name', pr.name, 'type', pr.type, 'is_active', pr.is_active, 'status', pr.status, 'base_price_kobo', pr.base_price_kobo,
        'variants', (select count(*) from public.product_variants v where v.product_id = pr.id), 'images', (select count(*) from public.product_images i where i.product_id = pr.id)) order by pr.name), '[]') from public.products pr),
    'bundles', (select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object('slots', (select count(*) from public.bundle_slots s where s.bundle_id = b.id)) order by b.sort_order), '[]') from public.bundles b));
end $$;

-- Bulk status change from the catalogue list.
create or replace function public.admin_products_set_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if p->>'status' not in ('draft', 'active', 'archived') then raise exception 'invalid_status'; end if;
  update public.products set status = p->>'status' where id in (select (jsonb_array_elements_text(p->'ids'))::uuid) and type <> 'gift_card';
  get diagnostics n = row_count;
  return jsonb_build_object('updated', n);
end $$;

create or replace function public.admin_products_import(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (p->>'actor')::uuid; dry boolean := coalesce((p->>'dry_run')::boolean, true);
  r jsonb; v jsonb; pid uuid; vid uuid; coll uuid; des uuid; old_stock int; new_stock int; existing boolean;
  created_p int := 0; updated_p int := 0; created_v int := 0; updated_v int := 0; stock_changes int := 0;
  errors jsonb := '[]'::jsonb; i int := 0;
begin
  perform public._require(actor, array['admin']);
  if jsonb_typeof(p->'rows') <> 'array' or jsonb_array_length(p->'rows') > 1000 then raise exception 'too_many_rows'; end if;
  for r in select * from jsonb_array_elements(p->'rows') loop
    i := i + 1;
    coll := null; des := null;
    if coalesce(r->>'collection_slug', '') <> '' then
      select id into coll from public.collections where slug = r->>'collection_slug';
      if coll is null then errors := errors || jsonb_build_object('row', r->>'line', 'message', 'Unknown collection "' || (r->>'collection_slug') || '"'); continue; end if;
    end if;
    if coalesce(r->>'design_slug', '') <> '' then
      select id into des from public.designs where slug = r->>'design_slug';
      if des is null then errors := errors || jsonb_build_object('row', r->>'line', 'message', 'Unknown design "' || (r->>'design_slug') || '"'); continue; end if;
    end if;
    select id into pid from public.products where slug = r->>'slug';
    existing := pid is not null;
    if existing then updated_p := updated_p + 1; else created_p := created_p + 1; end if;
    for v in select * from jsonb_array_elements(coalesce(r->'variants', '[]'::jsonb)) loop
      select pv.id, pv.stock_qty into vid, old_stock from public.product_variants pv where pv.sku = v->>'sku';
      if vid is not null and (pid is null or (select product_id from public.product_variants where id = vid) <> pid) then
        errors := errors || jsonb_build_object('row', v->>'line', 'message', 'SKU ' || (v->>'sku') || ' belongs to another product');
      elsif vid is null then created_v := created_v + 1;
      else updated_v := updated_v + 1; end if;
      if v ? 'stock_qty' and (v->>'stock_qty') is distinct from old_stock::text then stock_changes := stock_changes + 1; end if;
    end loop;

    continue when dry;
    if jsonb_array_length(errors) > 0 then continue; end if;

    insert into public.products (slug, name, type, base_price_kobo, compare_at_kobo, collection_id, design_id, description, care, status,
                                 is_made_to_order, weight_grams, seo_title, seo_description)
    values (r->>'slug', r->>'name', r->>'type', (r->>'price_kobo')::bigint, nullif(r->>'compare_at_kobo','')::bigint, coll, des,
            nullif(r->>'description',''), nullif(r->>'care',''), coalesce(nullif(r->>'status',''), 'draft'),
            coalesce((r->>'made_to_order')::boolean, true), nullif(r->>'weight_grams','')::int, nullif(r->>'seo_title',''), nullif(r->>'seo_description',''))
    on conflict (slug) do update set
      name = excluded.name, type = excluded.type, base_price_kobo = excluded.base_price_kobo, compare_at_kobo = excluded.compare_at_kobo,
      collection_id = coalesce(excluded.collection_id, products.collection_id), design_id = coalesce(excluded.design_id, products.design_id),
      description = coalesce(excluded.description, products.description), care = coalesce(excluded.care, products.care),
      status = case when r ? 'status' and coalesce(r->>'status','') <> '' then excluded.status else products.status end,
      is_made_to_order = case when r ? 'made_to_order' then excluded.is_made_to_order else products.is_made_to_order end,
      weight_grams = coalesce(excluded.weight_grams, products.weight_grams),
      seo_title = coalesce(excluded.seo_title, products.seo_title), seo_description = coalesce(excluded.seo_description, products.seo_description)
    returning id into pid;

    for v in select * from jsonb_array_elements(coalesce(r->'variants', '[]'::jsonb)) loop
      select pv.id, pv.stock_qty into vid, old_stock from public.product_variants pv where pv.sku = v->>'sku' for update;
      new_stock := case when v ? 'stock_qty' then nullif(v->>'stock_qty','')::int else old_stock end;
      if vid is null then
        insert into public.product_variants (product_id, sku, colour, size, option, price_kobo, stock_qty)
        values (pid, v->>'sku', nullif(v->>'colour',''), nullif(v->>'size',''), nullif(v->>'option',''), nullif(v->>'price_kobo','')::bigint, new_stock)
        returning id into vid;
        if new_stock is not null and new_stock > 0 then
          insert into public.inventory_adjustments (variant_id, delta, reason, actor) values (vid, new_stock, 'CSV import (new variant)', actor);
        end if;
      else
        update public.product_variants set colour = coalesce(nullif(v->>'colour',''), colour), size = coalesce(nullif(v->>'size',''), size),
          option = coalesce(nullif(v->>'option',''), option), price_kobo = case when v ? 'price_kobo' then nullif(v->>'price_kobo','')::bigint else price_kobo end,
          stock_qty = new_stock
        where id = vid;
        if new_stock is distinct from old_stock and new_stock is not null then
          insert into public.inventory_adjustments (variant_id, delta, reason, actor) values (vid, new_stock - coalesce(old_stock, 0), 'CSV import', actor);
        end if;
      end if;
    end loop;
  end loop;

  if not dry and jsonb_array_length(errors) > 0 then raise exception 'import_errors: %', errors::text; end if;
  return jsonb_build_object('dry_run', dry, 'products_created', created_p, 'products_updated', updated_p,
    'variants_created', created_v, 'variants_updated', updated_v, 'stock_changes', stock_changes, 'errors', errors);
end $$;

-- Export: one row per variant (products without variants get one row).
create or replace function public.admin_products_export(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return coalesce((select jsonb_agg(x order by x->>'slug', x->>'sku') from (
    select jsonb_build_object('slug', pr.slug, 'name', pr.name, 'type', pr.type, 'status', pr.status, 'price_kobo', pr.base_price_kobo,
      'compare_at_kobo', pr.compare_at_kobo, 'collection_slug', c.slug, 'design_slug', d.slug, 'description', pr.description, 'care', pr.care,
      'made_to_order', pr.is_made_to_order, 'weight_grams', pr.weight_grams, 'seo_title', pr.seo_title, 'seo_description', pr.seo_description,
      'sku', v.sku, 'colour', v.colour, 'size', v.size, 'option', v.option, 'variant_price_kobo', v.price_kobo, 'stock_qty', v.stock_qty) x
    from public.products pr left join public.collections c on c.id = pr.collection_id left join public.designs d on d.id = pr.design_id
    left join public.product_variants v on v.product_id = pr.id
    where pr.type <> 'gift_card') t), '[]'::jsonb);
end $$;

do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values
      ('admin_products_import', array['catalogue']), ('admin_products_export', array['catalogue']), ('admin_products_set_status', array['catalogue'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_save(jsonb)','admin_catalogue_list(jsonb)','admin_products_set_status(jsonb)','admin_products_import(jsonb)','admin_products_export(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
