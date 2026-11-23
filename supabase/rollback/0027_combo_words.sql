-- Back to the 0024 shape (no words). Orders that recorded a word keep it.
create or replace function public.combo_public_list(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'collections', coalesce((select jsonb_agg(published_snapshot order by sort_order, name) from public.combo_collections where status = 'published' and published_snapshot is not null), '[]'::jsonb),
    'unavailable', coalesce((select jsonb_agg(id) from public.combo_components where not is_active or archived_at is not null or inventory_status = 'out_of_stock'), '[]'::jsonb))
$$;
