-- Rollback for 0020_media_library.sql. Uploaded files stay in storage; only the library list is removed.
delete from public.admin_function_permissions where fn like 'admin_media_%';
drop function if exists public.admin_media_delete(jsonb);
drop function if exists public.admin_media_update(jsonb);
drop function if exists public.admin_media_register(jsonb);
drop function if exists public.admin_media_list(jsonb);
drop function if exists public._media_usage(text);
drop table if exists public.media_assets;
