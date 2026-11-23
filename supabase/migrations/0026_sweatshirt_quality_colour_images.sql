-- Sweatshirts as a product type, a Quality label (Normal / Premium) for garments, and photos that can belong to one colour.
-- Additive and safe to re-run; no existing product, photo or order changes.

-- 1. products.type also allows 'sweatshirt'
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.products'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%''tee''%''hoodie''%' loop
    execute format('alter table public.products drop constraint %I', c);
  end loop;
  alter table public.products add constraint products_type_check
    check (type in ('tee','sweatshirt','hoodie','frame','perfume','jewellery','bracelet','glasses','fun','gift_card'));
end $$;

-- 2. products.quality: optional label shown on cards and product pages
alter table public.products add column if not exists quality text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_quality_check') then
    alter table public.products add constraint products_quality_check check (quality is null or quality in ('normal','premium'));
  end if;
end $$;

-- 3. product_images.colour: a photo can belong to one colour (the product page then shows it when that colour is chosen). Empty = every colour.
alter table public.product_images add column if not exists colour text;

-- 4. the admin save functions know the new columns
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
    when 'products' then array['slug','name','type','quality','design_id','collection_id','description','care','base_price_kobo','compare_at_kobo','is_made_to_order','is_active','status','is_featured','is_seasonal','seo_title','seo_description','themes','brand_collections','weight_grams']
    when 'product_variants' then array['product_id','sku','colour','size','option','option_group','price_kobo','is_active']
    when 'bundles' then array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']
    when 'delivery_zones' then array['name','states','fee_kobo','free_over_kobo','lead_days','christmas_cutoff_date','sort_order','cities','provider','service','is_active','rate_verified','free_shipping_eligible','min_days','max_days','weight_allowance_grams','additional_kg_kobo']
    when 'discount_codes' then array['code','type','value','min_spend_kobo','starts_at','ends_at','usage_limit','per_customer_limit','collection_ids','product_ids','is_single_use','is_active']
    when 'ambassadors' then array['name','phone','email','commission_rate','payout_note','is_active']
    else null end;
  if allowed is null then raise exception 'bad_table'; end if;
  return jsonb_build_object('id', public._save_row(t, p->'row', allowed));
end $$;

create or replace function public.admin_images_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := (p->>'product_id')::uuid; im jsonb; i int := 0; keep uuid[] := '{}'; rid uuid;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  for im in select * from jsonb_array_elements(p->'images') loop
    rid := public._save_row('product_images', im || jsonb_build_object('product_id', pid, 'sort_order', i), array['product_id','url','alt','view','sort_order','colour']);
    keep := keep || rid; i := i + 1;
  end loop;
  delete from public.product_images where product_id = pid and not (id = any(keep));
  return jsonb_build_object('ok', true, 'count', i);
end $$;
