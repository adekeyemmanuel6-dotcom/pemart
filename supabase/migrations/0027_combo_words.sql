-- The combo calculator lets customers choose one of your words (designs) for their garment and frames.
-- combo_public_list now also returns the active words (public data only: name, reference, picture).
create or replace function public.combo_public_list(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'collections', coalesce((select jsonb_agg(published_snapshot order by sort_order, name) from public.combo_collections where status = 'published' and published_snapshot is not null), '[]'::jsonb),
    'unavailable', coalesce((select jsonb_agg(id) from public.combo_components where not is_active or archived_at is not null or inventory_status = 'out_of_stock'), '[]'::jsonb),
    'words', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name, 'reference', d.verse_reference, 'image', coalesce(d.preview_image, d.artwork_front)) order by d.name)
                         from public.designs d where d.is_active), '[]'::jsonb))
$$;
