-- Removes couples editions that have never been ordered, then the link column. Ordered editions are kept (archived) so past orders stay readable.
delete from public.combo_collections c where c.pair_of is not null and not exists (select 1 from public.order_items oi where oi.kind = 'combo' and oi.options->>'comboCollectionId' = c.id::text);
update public.combo_collections set status = 'archived' where pair_of is not null;
-- restore the 0024 definition of _combo_config (it no longer mentions pair_of), then drop the column
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
alter table public.combo_collections drop column if exists pair_of;
drop function if exists public.admin_combo_make_couples(jsonb);
drop function if exists public._combo_make_couples(uuid);
