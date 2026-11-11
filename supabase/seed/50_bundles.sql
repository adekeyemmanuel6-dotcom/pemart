-- Bundles. Gift boxes are available until 24 Dec 2026 (end of day, Lagos time) and hidden after.
insert into public.bundles (slug, name, kind, description, price_kobo, available_until, image, badge, sort_order) values
  ('starter', 'Starter', 'combo', 'Your first Pemart look. A tee in the design and colour you choose, plus a faith bracelet to finish it.', 2500000, null, '/placeholders/bundle.svg', null, 1),
  ('drip', 'Drip', 'combo', 'Tee, fashion glasses and a faith bracelet. The full outfit in one order.', 3300000, null, '/placeholders/bundle.svg', null, 2),
  ('signature', 'Signature', 'combo', 'Tee, a 30ml perfume and a faith bracelet. Our favourite combination.', 3750000, null, '/placeholders/bundle.svg', 'Most popular', 3),
  ('hoodie-season', 'Hoodie Season', 'combo', 'A hoodie and a pendant necklace for the cooler months.', 4800000, null, '/placeholders/bundle.svg', null, 4),
  ('two-of-us-starter', 'Two of Us Starter', 'couple', 'Two matching tees and a pair of couple bracelets. His and hers, side by side.', 4700000, null, '/placeholders/bundle.svg', null, 5),
  ('two-of-us-hoodie', 'Two of Us Hoodie', 'couple', 'Two matching hoodies and a pair of couple bracelets.', 8200000, null, '/placeholders/bundle.svg', null, 6),
  ('two-of-us-deluxe', 'Two of Us Deluxe', 'couple', 'Two tees, his and hers perfume, couple bracelets and an A4 frame with your names on it.', 8500000, null, '/placeholders/bundle.svg', 'Best for gifting', 7),
  ('joy-box', 'Joy Box', 'gift_box', 'A tee, a flying orb ball, a faith bracelet and a card in your words. Wrapped and ready to open.', 4200000, '2026-12-24 23:59:59+01', '/placeholders/gift-box.svg', null, 8),
  ('couples-christmas-box', 'Couple''s Christmas Box', 'gift_box', 'Two matching tees, a perfume pair, couple bracelets and a flying orb ball. Christmas for two.', 8900000, '2026-12-24 23:59:59+01', '/placeholders/gift-box.svg', 'Christmas favourite', 9),
  ('kingdom-box', 'Kingdom Box', 'gift_box', 'A hoodie, an A4 scripture frame, a perfume and a faith bracelet. A gift that lasts.', 6800000, '2026-12-24 23:59:59+01', '/placeholders/gift-box.svg', null, 10),
  ('family-box', 'Family Box', 'gift_box', 'Four matching tees and two flying orb balls. One design, the whole family.', 10500000, '2026-12-24 23:59:59+01', '/placeholders/gift-box.svg', null, 11);

-- Slots: what the customer picks for each part of a bundle.
insert into public.bundle_slots
  (bundle_id, label, product_type, allowed_collection_id, allowed_product_id, option_group, quantity,
   requires_size, requires_colour, requires_option, option_label, requires_custom_text, matching_group, sort_order)
select b.id, v.label, v.ptype,
  (select id from public.collections where slug = v.coll),
  (select id from public.products where slug = v.prod),
  v.og, v.qty, v.sz, v.col, v.opt, v.optlabel, v.txt, v.mg, v.ord
from (values
  -- combos
  ('starter','Your tee','tee',null,null,null,1,true,true,false,null,false,null,1),
  ('starter','Faith bracelet','bracelet',null,'faith-bracelet',null,1,false,false,true,'Style',false,null,2),
  ('drip','Your tee','tee',null,null,null,1,true,true,false,null,false,null,1),
  ('drip','Fashion glasses','glasses',null,'fashion-glasses',null,1,false,false,true,'Frame',false,null,2),
  ('drip','Faith bracelet','bracelet',null,'faith-bracelet',null,1,false,false,true,'Style',false,null,3),
  ('signature','Your tee','tee',null,null,null,1,true,true,false,null,false,null,1),
  ('signature','Perfume 30ml','perfume',null,'perfume-30ml',null,1,false,false,true,'Scent',false,null,2),
  ('signature','Faith bracelet','bracelet',null,'faith-bracelet',null,1,false,false,true,'Style',false,null,3),
  ('hoodie-season','Your hoodie','hoodie',null,null,null,1,true,true,false,null,false,null,1),
  ('hoodie-season','Necklace','jewellery',null,'pendant-necklace',null,1,false,false,true,'Style',false,null,2),
  -- couples
  ('two-of-us-starter','His tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',1),
  ('two-of-us-starter','Her tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',2),
  ('two-of-us-starter','Couple bracelets','bracelet',null,'couple-bracelets',null,1,false,false,true,'Style',false,null,3),
  ('two-of-us-hoodie','His hoodie','hoodie','two-of-us',null,null,1,true,true,false,null,false,'pair',1),
  ('two-of-us-hoodie','Her hoodie','hoodie','two-of-us',null,null,1,true,true,false,null,false,'pair',2),
  ('two-of-us-hoodie','Couple bracelets','bracelet',null,'couple-bracelets',null,1,false,false,true,'Style',false,null,3),
  ('two-of-us-deluxe','His tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',1),
  ('two-of-us-deluxe','Her tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',2),
  ('two-of-us-deluxe','His perfume','perfume',null,'perfume-30ml','him',1,false,false,true,'Scent',false,null,3),
  ('two-of-us-deluxe','Her perfume','perfume',null,'perfume-30ml','her',1,false,false,true,'Scent',false,null,4),
  ('two-of-us-deluxe','Couple bracelets','bracelet',null,'couple-bracelets',null,1,false,false,true,'Style',false,null,5),
  ('two-of-us-deluxe','A4 name frame','frame',null,null,null,1,false,false,true,'Frame',true,null,6),
  -- gift boxes
  ('joy-box','Your tee','tee',null,null,null,1,true,true,false,null,false,null,1),
  ('joy-box','Flying orb ball','fun',null,'flying-orb-ball',null,1,false,false,true,'Colour',false,null,2),
  ('joy-box','Faith bracelet','bracelet',null,'faith-bracelet',null,1,false,false,true,'Style',false,null,3),
  ('couples-christmas-box','His tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',1),
  ('couples-christmas-box','Her tee','tee','two-of-us',null,null,1,true,true,false,null,false,'pair',2),
  ('couples-christmas-box','His perfume','perfume',null,'perfume-30ml','him',1,false,false,true,'Scent',false,null,3),
  ('couples-christmas-box','Her perfume','perfume',null,'perfume-30ml','her',1,false,false,true,'Scent',false,null,4),
  ('couples-christmas-box','Couple bracelets','bracelet',null,'couple-bracelets',null,1,false,false,true,'Style',false,null,5),
  ('couples-christmas-box','Flying orb ball','fun',null,'flying-orb-ball',null,1,false,false,true,'Colour',false,null,6),
  ('kingdom-box','Your hoodie','hoodie',null,null,null,1,true,true,false,null,false,null,1),
  ('kingdom-box','A4 scripture frame','frame','kingdom',null,null,1,false,false,true,'Frame',false,null,2),
  ('kingdom-box','Perfume 30ml','perfume',null,'perfume-30ml',null,1,false,false,true,'Scent',false,null,3),
  ('kingdom-box','Faith bracelet','bracelet',null,'faith-bracelet',null,1,false,false,true,'Style',false,null,4),
  ('family-box','Dad''s tee','tee',null,null,null,1,true,true,false,null,false,'family',1),
  ('family-box','Mum''s tee','tee',null,null,null,1,true,true,false,null,false,'family',2),
  ('family-box','Child tee 1','tee',null,null,null,1,true,true,false,null,false,'family',3),
  ('family-box','Child tee 2','tee',null,null,null,1,true,true,false,null,false,'family',4),
  ('family-box','Flying orb balls','fun',null,'flying-orb-ball',null,2,false,false,true,'Colour',false,null,5)
) as v(bslug,label,ptype,coll,prod,og,qty,sz,col,opt,optlabel,txt,mg,ord)
join public.bundles b on b.slug = v.bslug;
