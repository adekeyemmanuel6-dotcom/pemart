-- The Wear The Word catalogue: your words as garments (Normal T-shirt, Premium T-shirt, Sweatshirt, Hoodie) and your frames.
-- Everything is created as a DRAFT with a price of ₦0: set the price, add the photos, then make it Active.
-- Nothing goes on sale by itself. Safe to re-run (it never duplicates, and never overwrites a price, photo or text you changed).
-- To change the words, verses, colours or sizes, edit the lists below before running.
--
-- It also (1) removes the unpriced draft garments of an earlier version of this set, and (2) archives the OLD demo tees, hoodies and
-- frames, which stay available for past orders and can be restored. Products that gift boxes or couple packs still use are left alone.

-- 0. Needs migration 0026 (sweatshirt type, Quality label). Stop with a clear message if it has not been run.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'quality') then
    raise exception 'Run supabase/migrations/0026_sweatshirt_quality_colour_images.sql first (and 0027 and 0028 if you have not), then run this file again. Nothing was changed.';
  end if;
end $$;

-- 1. Safety: a garment or frame cannot be made Active while its price is still ₦0.
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
  if going_active and new.type in ('tee', 'sweatshirt', 'hoodie', 'frame') and coalesce(new.base_price_kobo, 0) = 0 then
    raise exception 'Set a price before making this product active.';
  end if;
  return new;
end $$;
drop trigger if exists products_price_guard on public.products;
create trigger products_price_guard before insert or update on public.products
  for each row execute function public._product_price_guard();

do $$
declare
  -- name, slug, reference, verse (King James Version); wear = on T-shirts, sweatshirts and hoodies; frame = also as a framed print
  words jsonb := '[
    {"slug":"jesus-is-king","name":"Jesus is King","ref":"Revelation 19:16","text":"And he hath on his vesture and on his thigh a name written, KING OF KINGS, AND LORD OF LORDS.","wear":true,"frame":false},
    {"slug":"faith-over-fear","name":"Faith Over Fear","ref":"Psalm 118:6","text":"The LORD is on my side; I will not fear: what can man do unto me?","wear":true,"frame":true},
    {"slug":"na-god-dey-run-am","name":"Na God Dey Run am","ref":"Psalm 37:5","text":"Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.","wear":true,"frame":false},
    {"slug":"no-be-luck-na-grace","name":"No be Luck, Na Grace","ref":"Ephesians 2:8","text":"For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:","wear":true,"frame":false},
    {"slug":"daily-loaded-with-benefits","name":"Daily Loaded with benefits","ref":"Psalm 68:19","text":"Blessed be the Lord, who daily loadeth us with benefits, even the God of our salvation.","wear":true,"frame":false},
    {"slug":"no-longer-a-slave-to-sin","name":"No Longer a Slave to Sin","ref":"Romans 6:6","text":"Knowing this, that our old man is crucified with him, that the body of sin might be destroyed, that henceforth we should not serve sin.","wear":true,"frame":false},
    {"slug":"jesus-no-dey-fail","name":"Jesus No dey Fail","ref":"Hebrews 13:8","text":"Jesus Christ the same yesterday, and to day, and for ever.","wear":true,"frame":false},
    {"slug":"sin-has-no-hold-over-me","name":"Sin Has No Hold Over me","ref":"Romans 6:14","text":"For sin shall not have dominion over you: for ye are not under the law, but under grace.","wear":true,"frame":false},
    {"slug":"i-can-do-all-things","name":"I Can Do All Things Through Christ","ref":"Philippians 4:13","text":"I can do all things through Christ which strengtheneth me.","wear":false,"frame":true},
    {"slug":"the-light-shines-in-the-darkness","name":"The Light Shines In the Darkness","ref":"John 1:5","text":"And the light shineth in darkness; and the darkness comprehended it not.","wear":false,"frame":true},
    {"slug":"saved-by-grace-fueled-by-faith","name":"Saved by Grace Fueled by Faith","ref":"Ephesians 2:8-9","text":"For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.","wear":false,"frame":true},
    {"slug":"he-left-the-99-to-find-me","name":"He left the 99 to find me","ref":"Luke 15:4","text":"What man of you, having an hundred sheep, if he lose one of them, doth not leave the ninety and nine in the wilderness, and go after that which is lost, until he find it?","wear":false,"frame":true},
    {"slug":"scriptures-on-business","name":"Scriptures on Business","ref":"Proverbs 16:3","text":"Commit thy works unto the LORD, and thy thoughts shall be established.","wear":false,"frame":true},
    {"slug":"scriptures-on-finances","name":"Scriptures on Finances","ref":"Philippians 4:19","text":"But my God shall supply all your need according to his riches in glory by Christ Jesus.","wear":false,"frame":true},
    {"slug":"scriptures-on-favour","name":"Scriptures on Favour","ref":"Psalm 5:12","text":"For thou, LORD, wilt bless the righteous; with favour wilt thou compass him as with a shield.","wear":false,"frame":true},
    {"slug":"scriptures-on-health","name":"Scriptures on Health","ref":"3 John 1:2","text":"Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.","wear":false,"frame":true},
    {"slug":"scriptures-on-strength","name":"Scriptures on Strength","ref":"Isaiah 40:31","text":"But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.","wear":false,"frame":true}
  ]'::jsonb;
  colours text[] := array['Black', 'White', 'Royal Blue', 'Army Green', 'Yellow', 'Navy Blue', 'Pink', 'Brown'];
  sizes   text[] := array['S', 'M', 'L', 'XL', 'XXL'];
  frame_sizes text[][] := array[['12X16', '12 × 16 inches'], ['16X20', '16 × 20 inches']];
  care_garment text := 'Wash inside out in cold water. Do not bleach. Hang dry or tumble low. Iron inside out and never directly on the print.';
  care_frame   text := 'Dust with a dry cloth. Keep out of direct sunlight and damp.';
  w jsonb; g record; d_id uuid; pid uuid; colour text; sz text; i int; used_designs uuid[]; used_collections uuid[]; used_products uuid[];
begin
  -- A. remove the unpriced draft garments of an earlier version of this set (never ordered); put the renamed word back
  delete from public.products p
   where p.status = 'draft' and p.base_price_kobo = 0 and p.slug ~ '-(normal-tee|premium-tee|sweatshirt|hoodie)$'
     and p.design_id in (select id from public.designs where slug in ('all-things', 'seek-first', 'be-still', 'trust-in-the-lord', 'i-shall-not-want'))
     and not exists (select 1 from public.product_variants v join public.order_items oi on oi.variant_id = v.id where v.product_id = p.id);
  update public.designs set name = 'All Things' where slug = 'all-things' and name = 'Through Christ That Strengthens Me';

  -- B. the words: designs, then their products
  for w in select * from jsonb_array_elements(words) loop
    insert into public.designs (slug, name, story_or_verse, verse_reference, allowed_product_types, is_active)
    values (w->>'slug', w->>'name', w->>'text', w->>'ref', '{tee,sweatshirt,hoodie}', true)
    on conflict (slug) do nothing;
    select id into d_id from public.designs where slug = w->>'slug';

    if (w->>'wear')::boolean then
      for g in select * from (values
          ('normal-tee',  'Normal T-shirt',  'tee',        'normal',  'A comfortable everyday T-shirt'),
          ('premium-tee', 'Premium T-shirt', 'tee',        'premium', 'A premium-quality T-shirt'),
          ('sweatshirt',  'Sweatshirt',      'sweatshirt', null,      'A cosy sweatshirt'),
          ('hoodie',      'Hoodie',          'hoodie',     null,      'A warm hoodie')) as t(suffix, label, ptype, quality, intro) loop
        pid := null;
        insert into public.products (slug, name, type, quality, design_id, description, care, base_price_kobo, is_made_to_order, status, seo_description)
        values (w->>'slug' || '-' || g.suffix, (w->>'name') || ' ' || g.label, g.ptype, g.quality, d_id,
                g.intro || ' with the word "' || (w->>'name') || '" (' || (w->>'ref') || '). Printed to order and delivered within 5 days.',
                care_garment, 0, true, 'draft', g.label || ' with the word "' || (w->>'name') || '" (' || (w->>'ref') || '). Made to order in Nigeria.')
        on conflict (slug) do nothing
        returning id into pid;
        if pid is null then select id into pid from public.products where slug = w->>'slug' || '-' || g.suffix; end if;
        foreach colour in array colours loop
          foreach sz in array sizes loop
            insert into public.product_variants (product_id, sku, colour, size, stock_qty)
            values (pid, upper('WORD-' || (w->>'slug') || '-' || g.suffix || '-' || replace(colour, ' ', '') || '-' || sz), colour, sz, null)
            on conflict (sku) do nothing;
          end loop;
        end loop;
      end loop;
    end if;

    if (w->>'frame')::boolean then
      pid := null;
      insert into public.products (slug, name, type, design_id, description, care, base_price_kobo, is_made_to_order, status, seo_description)
      values (w->>'slug' || '-frame', (w->>'name') || ' Frame', 'frame', d_id,
              'The word "' || (w->>'name') || '" (' || (w->>'ref') || ') as a framed Scripture print. Printed to order and ready to hang.',
              care_frame, 0, true, 'draft', 'Framed Scripture print: "' || (w->>'name') || '" (' || (w->>'ref') || '). Made to order in Nigeria.')
      on conflict (slug) do nothing
      returning id into pid;
      if pid is null then select id into pid from public.products where slug = w->>'slug' || '-frame'; end if;
      for i in 1 .. array_length(frame_sizes, 1) loop
        insert into public.product_variants (product_id, sku, size, stock_qty)
        values (pid, 'WORD-' || upper(w->>'slug') || '-FRAME-' || frame_sizes[i][1], frame_sizes[i][2], null)
        on conflict (sku) do nothing;
      end loop;
    end if;
  end loop;

  -- C. archive the OLD demo tees, hoodies and frames (kept for past orders, restorable). Anything a gift box or couple pack still uses stays.
  select coalesce(array_agg(distinct x), '{}') into used_designs from public.bundle_slots s, unnest(s.allowed_design_ids) x;
  select coalesce(array_agg(distinct allowed_collection_id), '{}') into used_collections from public.bundle_slots where allowed_collection_id is not null;
  select coalesce(array_agg(distinct allowed_product_id), '{}') into used_products from public.bundle_slots where allowed_product_id is not null;
  update public.products p set status = 'archived'
   where p.type in ('tee', 'hoodie', 'frame') and p.status <> 'archived' and p.design_id is not null
     and p.id <> all (used_products)
     and p.design_id <> all (used_designs)
     and (p.collection_id is null or p.collection_id <> all (used_collections))
     and p.design_id not in (select id from public.designs where slug = any (select e->>'slug' from jsonb_array_elements(words) e))
     and p.slug not in (select e->>'slug' || '-' || s2 from jsonb_array_elements(words) e, unnest(array['normal-tee','premium-tee','sweatshirt','hoodie','frame']) s2);
end $$;
