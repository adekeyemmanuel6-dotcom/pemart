-- Couples editions: a combo collection with two garments (everything else as the single-person collection).
-- pair_of links an edition to the collection it is the couples version of. Additive and safe to re-run.
alter table public.combo_collections add column if not exists pair_of uuid references public.combo_collections(id) on delete set null;

-- the configuration document (and so the published snapshot) names the collection it pairs with, by slug
create or replace function public._combo_config(cid uuid, with_costs boolean default false) returns jsonb
language plpgsql stable set search_path = public as $$
declare col public.combo_collections; res jsonb;
begin
  select * into col from public.combo_collections where id = cid;
  if not found then return null; end if;
  res := jsonb_build_object(
    'id', col.id, 'slug', col.slug, 'name', col.name, 'label', col.label, 'tagline', col.tagline, 'scripture_ref', col.scripture_ref,
    'scripture_text', col.scripture_text, 'description', col.description, 'image_url', col.image_url, 'sort_order', col.sort_order,
    'legacy_bundle_id', col.legacy_bundle_id, 'version', col.version,
    'pair_of', (select slug from public.combo_collections where id = col.pair_of),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'label', s.label, 'quantity', s.quantity, 'mode', s.mode,
              'min_qty', s.min_qty, 'max_qty', s.max_qty, 'same_size_only', s.same_size_only, 'customise', s.customise, 'extra_price_kobo', s.extra_price_kobo,
              'sort_order', s.sort_order,
              'components', coalesce((select jsonb_agg(public._combo_component_json(cc, with_costs)
                                                       order by array_position(case when s.component_id is not null then array[s.component_id] else s.allowed_component_ids end, cc.id))
                                        from public.combo_components cc
                                       where cc.id = any(case when s.component_id is not null then array[s.component_id] else s.allowed_component_ids end)), '[]'::jsonb))
              order by s.sort_order, s.label)
            from public.combo_slots s where s.collection_id = col.id), '[]'::jsonb),
    'rules', jsonb_build_object(
      'base_price_kobo', col.base_price_kobo,
      'garment_adjust', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'component_id', r.component_id, 'amount_kobo', r.amount_kobo) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'garment_adjust' and r.is_active), '[]'::jsonb),
      'frame_size_adjust', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'option_id', r.option_id, 'amount_kobo', r.amount_kobo) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'frame_size_adjust' and r.is_active), '[]'::jsonb),
      'fixed_variants', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'component_id', r.component_id, 'signature', r.frame_signature, 'amount_kobo', r.amount_kobo, 'label', r.label) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind = 'fixed_variant' and r.is_active), '[]'::jsonb),
      'discounts', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'type', r.discount_type, 'value', r.discount_value, 'label', r.label,
                                    'starts_at', r.starts_at, 'ends_at', r.ends_at) order by r.sort_order)
                                    from public.combo_price_rules r where r.collection_id = col.id and r.kind in ('promo','bundle_discount') and r.is_active), '[]'::jsonb)));
  if with_costs then
    res := res || jsonb_build_object('overheads', coalesce((select to_jsonb(c) - 'collection_id' from public.combo_collection_costs c where c.collection_id = col.id),
      jsonb_build_object('printing_apparel_kobo', 0, 'frame_artwork_kobo', 0, 'packaging_kobo', 0, 'labor_kobo', 0, 'processing_fee_kobo', 0, 'other_kobo', 0)));
  end if;
  return res;
end $$;

-- Makes the couples edition of a collection: same contents, garments doubled, NO selling price (the owner sets it), draft.
create or replace function public._combo_make_couples(src_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare src public.combo_collections; nid uuid; nslug text; n int := 1;
begin
  select * into src from public.combo_collections where id = src_id;
  if not found then raise exception 'not_found'; end if;
  if src.pair_of is not null then raise exception 'This is already a couples edition.'; end if;
  select id into nid from public.combo_collections where pair_of = src.id order by created_at limit 1;
  if nid is not null then return nid; end if;     -- one edition per collection; idempotent
  nslug := left(src.slug, 48) || '-couples';
  while exists (select 1 from public.combo_collections where slug = nslug) loop n := n + 1; nslug := left(src.slug, 48) || '-couples-' || n; end loop;
  nid := gen_random_uuid();
  insert into public.combo_collections (id, slug, name, label, tagline, scripture_ref, scripture_text, description, image_url, legacy_bundle_id, sort_order, status, base_price_kobo, pair_of)
  values (nid, nslug, left(src.name, 66) || ' FOR COUPLES', src.label, src.tagline, src.scripture_ref, src.scripture_text, src.description, src.image_url, null, src.sort_order, 'draft', null, src.id);
  insert into public.combo_slots (collection_id, kind, label, component_id, allowed_component_ids, quantity, mode, min_qty, max_qty, same_size_only, customise, extra_price_kobo, sort_order)
    select nid, kind, label, component_id, allowed_component_ids, case when kind = 'garment' and mode <> 'unavailable' then 2 else quantity end, mode, min_qty, max_qty, same_size_only, customise, extra_price_kobo, sort_order
      from public.combo_slots where collection_id = src.id;
  -- the per-garment and per-frame-size extras carry over; base price, fixed prices and promotions do not
  insert into public.combo_price_rules (collection_id, kind, component_id, option_id, frame_signature, amount_kobo, is_active, sort_order)
    select nid, kind, component_id, option_id, null, amount_kobo, is_active, sort_order from public.combo_price_rules where collection_id = src.id and kind in ('garment_adjust','frame_size_adjust');
  return nid;
end $$;
revoke all on function public._combo_make_couples(uuid) from public, anon, authenticated;

create or replace function public.admin_combo_make_couples(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object('id', public._combo_make_couples((p->>'id')::uuid));
end $$;
revoke all on function public.admin_combo_make_couples(jsonb) from public, anon, authenticated;
grant execute on function public.admin_combo_make_couples(jsonb) to service_role;

do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values ('admin_combo_make_couples', array['catalogue'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;

-- starting content: a couples edition (draft, no price) of each seeded collection
do $$ declare c record; begin
  for c in select id from public.combo_collections where slug in ('behold','abide','doers') and pair_of is null loop
    perform public._combo_make_couples(c.id);
  end loop;
end $$;
