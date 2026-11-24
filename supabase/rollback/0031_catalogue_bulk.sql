drop function if exists public.admin_products_set_price(jsonb);
drop function if exists public.admin_products_delete(jsonb);
delete from public.admin_function_permissions where fn in ('admin_products_set_price', 'admin_products_delete');
