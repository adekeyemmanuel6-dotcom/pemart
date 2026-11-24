-- Garments for the first words: for each word, a Normal T-shirt, a Premium T-shirt, a Sweatshirt and a Hoodie, each in
-- every colour and size, made to order (SKUs start with WORD-). They are created as DRAFTS with NO price: set the price, add the photos, then make
-- them Active. Nothing here goes on sale by itself. Safe to re-run (it never duplicates or overwrites).
--
-- To change the words, colours or sizes, edit the three lists below before running.

-- 1. Safety: a garment cannot be made Active while its price is still ₦0.
create or replace function public._product_price_guard() returns trigger
language plpgsql as $$
declare going_active boolean;
begin
  -- "active" is stored twice (status and is_active, kept in step by another trigger), so work out what this save is asking for
  going_active := case
    when TG_OP = 'INSERT' then coalesce(new.status = 'active', new.is_active, false)
    when new.status is distinct from old.status then new.status = 'active'
    when new.is_active is distinct from old.is_active then coalesce(new.is_active, false)
    else new.status = 'active' end;
  if going_active and new.type in ('tee', 'sweatshirt', 'hoodie') and coalesce(new.base_price_kobo, 0) = 0 then
    raise exception 'Set a price before making this product active.';
  end if;
  return new;
end $$;
drop trigger if exists products_price_guard on public.products;
create trigger products_price_guard before insert or update on public.products
  for each row execute function public._product_price_guard();

do $$
declare
  words   text[] := array['all-things', 'seek-first', 'be-still', 'trust-in-the-lord', 'i-shall-not-want'];                  -- design slugs
  colours text[] := array['Black', 'White', 'Royal Blue', 'Army Green', 'Yellow', 'Navy Blue', 'Pink', 'Brown'];
  sizes   text[] := array['S', 'M', 'L', 'XL', 'XXL'];
  care    text := 'Wash inside out in cold water. Do not bleach. Hang dry or tumble low. Iron inside out and never directly on the print.';
  d record; g record; colour text; sz text; pid uuid;
begin
  -- the word you described keeps its page address, and now carries its full name
  update public.designs set name = 'Through Christ That Strengthens Me' where slug = 'all-things' and name = 'All Things';

  for d in select * from public.designs where slug = any(words) loop
    -- the older single tee and hoodie of these words are replaced by the set below: archived (kept for past orders, never deleted).
    -- The old hoodie gives up its address ("...-hoodie") to the new one and becomes "...-hoodie-old".
    update public.products set status = 'archived'
     where design_id = d.id and type = 'tee' and slug = d.slug || '-tee' and status <> 'archived';
    update public.products set status = 'archived', slug = d.slug || '-hoodie-old'
     where design_id = d.id and type = 'hoodie' and slug = d.slug || '-hoodie' and description not like 'A warm hoodie with the "%';   -- not one of the new ones, so re-running never renames those

    for g in select * from (values
        ('normal-tee',  'Normal T-shirt',  'tee',        'normal',  'A comfortable everyday T-shirt'),
        ('premium-tee', 'Premium T-shirt', 'tee',        'premium', 'A premium-quality T-shirt'),
        ('sweatshirt',  'Sweatshirt',      'sweatshirt', null,      'A cosy sweatshirt'),
        ('hoodie',      'Hoodie',          'hoodie',     null,      'A warm hoodie')) as t(suffix, label, ptype, quality, intro) loop
      insert into public.products (slug, name, type, quality, design_id, collection_id, description, care, base_price_kobo, is_made_to_order, status, seo_description)
      values (d.slug || '-' || g.suffix, d.name || ' ' || g.label, g.ptype, g.quality, d.id, d.collection_id,
              g.intro || ' with the "' || d.name || '" word' || coalesce(' (' || d.verse_reference || ')', '') || '. Printed to order and delivered within 5 days.',
              care, 0, true, 'draft',
              g.label || ' with the "' || d.name || '" word. Made to order in Nigeria.')
      on conflict (slug) do nothing
      returning id into pid;
      if pid is null then select id into pid from public.products where slug = d.slug || '-' || g.suffix; end if;
      foreach colour in array colours loop
        foreach sz in array sizes loop
          insert into public.product_variants (product_id, sku, colour, size, stock_qty)
          values (pid, upper('WORD-' || d.slug || '-' || g.suffix || '-' || replace(colour, ' ', '') || '-' || sz), colour, sz, null)
          on conflict (sku) do nothing;
        end loop;
      end loop;
      pid := null;
    end loop;

  end loop;
end $$;
