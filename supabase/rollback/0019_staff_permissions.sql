-- Rollback for 0019_staff_permissions.sql: back to two roles (staff / admin) exactly as in 0017.
create or replace function public._require(actor uuid, roles text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if actor is null or not (coalesce((select role from public.profiles where id = actor), 'none') = any(roles)) then
    raise exception 'forbidden';
  end if;
  perform set_config('app.actor', actor::text, true);
end $$;

create or replace function public.admin_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[]; t text := p->>'table';
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
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

create or replace function public.admin_team_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'email', pr.email, 'name', pr.full_name, 'role', pr.role,
      'last_sign_in_at', u.last_sign_in_at) order by case pr.role when 'admin' then 0 else 1 end, pr.email)
    from public.profiles pr left join auth.users u on u.id = pr.id
    where pr.role in ('staff', 'admin')), '[]'::jsonb);
end $$;

drop function if exists public.admin_set_permissions(jsonb);
drop function if exists public.admin_website_get(jsonb);
drop function if exists public.staff_permissions_get(jsonb);
drop function if exists public._caller_fn();
drop function if exists public._staff_perms(uuid);
drop table if exists public.admin_function_permissions;
drop table if exists public.staff_permissions;
