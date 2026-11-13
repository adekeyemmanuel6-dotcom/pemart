-- Rollback for 0021_product_status_import.sql. is_active keeps each product's visibility (archived → hidden).
delete from public.admin_function_permissions where fn in ('admin_products_import','admin_products_export','admin_products_set_status');
drop function if exists public.admin_products_export(jsonb);
drop function if exists public.admin_products_import(jsonb);
drop function if exists public.admin_products_set_status(jsonb);
drop trigger if exists products_status_sync on public.products;
drop function if exists public._product_status_sync();
alter table public.products drop constraint if exists products_status_check;
drop index if exists public.products_status_idx;
alter table public.products drop column if exists status;
-- admin_save and admin_catalogue_list: re-run the definitions from 0019 (or 0014 if 0019 is not applied).
