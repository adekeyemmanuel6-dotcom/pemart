-- Exports the seeded catalogue as one JSON document (same nested shape PostgREST returns).
select (jsonb_build_object(
  'collections', (select coalesce(jsonb_agg(to_jsonb(c) - 'search' order by c.sort_order), '[]') from public.collections c where c.is_active),
  'designs', (select coalesce(jsonb_agg(to_jsonb(d) order by d.name), '[]') from public.designs d where d.is_active),
  'products', (select coalesce(jsonb_agg(
      (to_jsonb(p) - 'search') || jsonb_build_object(
        'product_variants', (select coalesce(jsonb_agg(to_jsonb(v) - 'image_ids' order by v.sku), '[]') from public.product_variants v where v.product_id = p.id and v.is_active),
        'product_images', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]') from public.product_images i where i.product_id = p.id))
      order by p.name), '[]') from public.products p where p.is_active),
  'bundles', (select coalesce(jsonb_agg(
      to_jsonb(b) || jsonb_build_object('bundle_slots', (select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order), '[]') from public.bundle_slots s where s.bundle_id = b.id))
      order by b.sort_order), '[]') from public.bundles b where b.is_active),
  'zones', (select coalesce(jsonb_agg(to_jsonb(z) order by z.sort_order), '[]') from public.delivery_zones z)
));
