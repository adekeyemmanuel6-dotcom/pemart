-- Rollback for 0023_presale.sql. WARNING: this deletes every pre-sale request. Export the list from Admin > Pre-sale first.
drop function if exists public.admin_presale_config_save(jsonb);
drop function if exists public.admin_presale_update(jsonb);
drop function if exists public.admin_presale_list(jsonb);
drop function if exists public.presale_submit(jsonb);
drop function if exists public.presale_config_get(jsonb);
do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    delete from public.admin_function_permissions where fn in ('admin_presale_list','admin_presale_update');
  end if;
end $$;
drop table if exists public.presale_config;
drop table if exists public.presale_requests;
drop sequence if exists public.presale_ref_seq;
