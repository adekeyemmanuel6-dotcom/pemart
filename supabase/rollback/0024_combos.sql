-- Rollback for 0024_combos.sql. WARNING: deletes every combo collection, component, price rule and cost entered in Combo Management.
-- Orders that already contain combos keep their order_items rows (the 'combo' kind is kept allowed so they stay valid).
do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    delete from public.admin_function_permissions where fn in ('admin_combos_list','admin_combo_get','admin_combo_save','admin_combo_publish','admin_combo_set_status','admin_combo_duplicate','admin_combo_reorder','admin_components_list','admin_component_save','admin_component_archive','admin_combo_settings_save');
  end if;
end $$;
drop function if exists public.admin_combo_settings_save(jsonb);
drop function if exists public.admin_component_delete(jsonb);
drop function if exists public.admin_component_archive(jsonb);
drop function if exists public.admin_component_save(jsonb);
drop function if exists public.admin_components_list(jsonb);
drop function if exists public.admin_combo_costs_save(jsonb);
drop function if exists public.admin_combo_delete(jsonb);
drop function if exists public.admin_combo_reorder(jsonb);
drop function if exists public.admin_combo_duplicate(jsonb);
drop function if exists public.admin_combo_set_status(jsonb);
drop function if exists public.admin_combo_publish(jsonb);
drop function if exists public.admin_combo_save(jsonb);
drop function if exists public.admin_combo_get(jsonb);
drop function if exists public.admin_combos_list(jsonb);
drop function if exists public._combo_is_admin(uuid);
drop function if exists public.combo_settings_get(jsonb);
drop function if exists public.combo_public_list(jsonb);
drop function if exists public._combo_config(uuid, boolean);
drop function if exists public._combo_component_json(public.combo_components, boolean);
drop table if exists public.combo_settings;
drop table if exists public.combo_collection_costs;
drop table if exists public.combo_price_rules;
drop table if exists public.combo_slots;
drop table if exists public.combo_collections;
drop table if exists public.combo_component_options;
drop table if exists public.combo_components;
