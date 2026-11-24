-- Removes the draft garments this migration created, but only the ones that were never ordered, then restores the archived older tees and hoodies.
delete from public.products p
 where p.slug ~ '-(normal-tee|premium-tee|sweatshirt|hoodie)$' and p.status = 'draft' and p.base_price_kobo = 0
   and exists (select 1 from public.designs d where d.id = p.design_id and p.slug like d.slug || '-%')
   and not exists (select 1 from public.order_items oi where oi.variant_id in (select id from public.product_variants where product_id = p.id));
update public.products set slug = regexp_replace(slug, '-hoodie-old$', '-hoodie'), status = 'active'
 where slug ~ '-hoodie-old$' and status = 'archived' and not exists (select 1 from public.products x where x.slug = regexp_replace(public.products.slug, '-hoodie-old$', '-hoodie'));
update public.products set status = 'active'
 where status = 'archived' and type = 'tee' and slug in (select d.slug || '-tee' from public.designs d where d.slug in ('all-things', 'seek-first', 'be-still', 'trust-in-the-lord', 'i-shall-not-want'));
drop trigger if exists products_price_guard on public.products;
drop function if exists public._product_price_guard();
