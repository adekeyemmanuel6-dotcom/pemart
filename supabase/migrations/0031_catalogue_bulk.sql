-- Catalogue bulk actions: set one price for many products, and permanently delete ARCHIVED products that were never ordered.
-- Additive and safe to re-run.

-- Same price for the ticked products (not gift cards). A price must be above zero.
create or replace function public.admin_products_set_price(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; price bigint := (p->>'price_kobo')::bigint;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if price is null or price <= 0 then raise exception 'Enter a price above zero.'; end if;
  update public.products set base_price_kobo = price
   where id in (select (jsonb_array_elements_text(p->'ids'))::uuid) and type <> 'gift_card';
  get diagnostics n = row_count;
  return jsonb_build_object('updated', n);
end $$;
revoke all on function public.admin_products_set_price(jsonb) from public, anon, authenticated;
grant execute on function public.admin_products_set_price(jsonb) to service_role;

-- Permanently delete products. Only ARCHIVED products can be deleted, and never one that appears on an order (it stays archived, so past
-- orders keep their details). Photos and variants go with the product.
create or replace function public.admin_products_delete(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ids uuid[] := array(select (jsonb_array_elements_text(p->'ids'))::uuid); deleted int := 0; not_archived int; ordered int;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select count(*) into not_archived from public.products where id = any(ids) and status <> 'archived';
  select count(*) into ordered from public.products pr where pr.id = any(ids) and pr.status = 'archived'
     and exists (select 1 from public.order_items oi join public.product_variants v on v.id = oi.variant_id where v.product_id = pr.id);
  with gone as (
    delete from public.products pr where pr.id = any(ids) and pr.status = 'archived'
       and not exists (select 1 from public.order_items oi join public.product_variants v on v.id = oi.variant_id where v.product_id = pr.id)
    returning 1)
  select count(*) into deleted from gone;
  return jsonb_build_object('deleted', deleted, 'not_archived', not_archived, 'kept_because_ordered', ordered);
end $$;
revoke all on function public.admin_products_delete(jsonb) from public, anon, authenticated;
grant execute on function public.admin_products_delete(jsonb) to service_role;

do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values
      ('admin_products_set_price', array['catalogue']), ('admin_products_delete', array['catalogue'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;
