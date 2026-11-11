-- Products and variants. Prices in kobo (NGN x 100).
-- ---- Design products: one tee, hoodie (all designs), frame (Kingdom and Word designs) ----
insert into public.products (slug, name, type, design_id, collection_id, description, care, base_price_kobo, is_made_to_order, is_featured, is_seasonal, seo_description)
select d.slug || '-tee', d.name || ' Oversized Tee', 'tee', d.id, d.collection_id,
  'A heavyweight oversized tee with a boxy cut and dropped shoulders. The "' || d.name || '" print sits large across the back with a small mark on the chest. Printed to order and delivered within 5 days.',
  'Wash inside out in cold water. Do not bleach. Hang dry or tumble low. Iron inside out and never directly on the print.',
  2200000, true,
  d.slug in ('seek-first','all-things','god-dey','grace-dey-load','two-are-better','unto-us'),
  d.collection_id = (select id from public.collections where slug='christmas-drop'),
  'Oversized heavyweight tee with the "' || d.name || '" design. Made to order in Nigeria, delivered in 5 days.'
from public.designs d;

insert into public.products (slug, name, type, design_id, collection_id, description, care, base_price_kobo, is_made_to_order, is_featured, is_seasonal, seo_description)
select d.slug || '-hoodie', d.name || ' Hoodie', 'hoodie', d.id, d.collection_id,
  'A heavy fleece hoodie with a roomy oversized fit. The "' || d.name || '" print runs across the back. Warm, soft and made to order.',
  'Wash inside out in cold water. Do not bleach. Hang dry. Iron inside out and never directly on the print.',
  4200000, true, d.slug in ('seek-first','nothing-impossible','the-word'),
  d.collection_id = (select id from public.collections where slug='christmas-drop'),
  'Oversized hoodie with the "' || d.name || '" design. Made to order, delivered in 5 days.'
from public.designs d;

insert into public.products (slug, name, type, design_id, collection_id, description, care, base_price_kobo, compare_at_kobo, is_made_to_order, seo_description)
select d.slug || '-frame', d.name || ' Scripture Frame', 'frame', d.id, d.collection_id,
  'The "' || d.name || '" artwork as a framed wall print. Choose A4 or A3, in a black or natural wood frame. Ready to hang.',
  'Dust with a dry cloth. Keep out of direct sunlight and damp.',
  1500000, null, true,
  'Framed "' || d.name || '" wall art in A4 or A3. Black or wood frame, made to order.'
from public.designs d
where d.collection_id in (select id from public.collections where slug in ('kingdom','word'));

-- Variants: tees 5 colours x 6 sizes; hoodies 3 colours x 6 sizes (made to order: stock null).
insert into public.product_variants (product_id, sku, colour, size, stock_qty)
select p.id, upper(p.slug || '-' || replace(c.colour,' ','') || '-' || s.size), c.colour, s.size, null
from public.products p
cross join (values ('Blue Jean'),('Mocha'),('Sand'),('Black'),('Navy')) as c(colour)
cross join (values ('S'),('M'),('L'),('XL'),('XXL'),('XXXL')) as s(size)
where p.type = 'tee' and s.size <> 'XXXL';

insert into public.product_variants (product_id, sku, colour, size, stock_qty)
select p.id, upper(p.slug || '-' || replace(c.colour,' ','') || '-' || s.size), c.colour, s.size, null
from public.products p
cross join (values ('Black'),('Sand'),('Mocha')) as c(colour)
cross join (values ('S'),('M'),('L'),('XL'),('XXL')) as s(size)
where p.type = 'hoodie';

-- Frames: size and finish. A3 costs more (price override).
insert into public.product_variants (product_id, sku, size, option, price_kobo, stock_qty)
select p.id, upper(p.slug || '-' || z.size || '-' || z.finish), z.size, z.finish, z.price, null
from public.products p
cross join (values ('A4','Black',1500000),('A4','Wood',1500000),('A3','Black',2500000),('A3','Wood',2500000)) as z(size, finish, price)
where p.type = 'frame';

-- ---- Stocked accessories ----
insert into public.products (slug, name, type, collection_id, description, care, base_price_kobo, is_made_to_order, is_featured, is_seasonal, seo_description)
select v.slug, v.name, v.type, (select id from public.collections where slug='accessories'), v.descr, v.care, v.price, false, v.feat, v.seasonal, v.descr
from (values
  ('faith-bracelet','Faith Bracelet','bracelet','A woven bracelet with a small faith charm. Six styles, adjustable to fit any wrist.','Keep dry when you can. Wipe clean with a soft cloth.',600000,true,false),
  ('couple-bracelets','Couple Bracelets (Pair)','bracelet','Two matching bracelets, one for each of you. Pick from three styles.','Keep dry when you can. Wipe clean with a soft cloth.',1000000,true,false),
  ('perfume-30ml','Perfume 30ml','perfume','A 30ml fragrance with a long, soft trail. Three scents for him and three for her.','Store away from heat and direct sunlight.',1500000,true,false),
  ('pendant-necklace','Necklace and Pendant','jewellery','A clean chain with a pendant that means something. Eight styles.','Avoid water and perfume on the chain. Store flat.',1200000,false,false),
  ('fashion-glasses','Fashion Glasses','glasses','Light frames for the look, not the lens. Five styles with UV-protected lenses.','Clean with the cloth provided. Store in a case.',1000000,false,false),
  ('flying-orb-ball','Flying Orb Ball','fun','A hand-launched glowing orb that flies, spins and returns. Fun for all ages and a favourite in our gift boxes.','Keep dry. Charge before first use.',1800000,true,true)
) as v(slug,name,type,descr,care,price,feat,seasonal);

insert into public.product_variants (product_id, sku, option, option_group, stock_qty)
select p.id, upper(p.slug || '-' || regexp_replace(o.opt,'[^A-Za-z0-9]+','','g')), o.opt, o.grp, o.qty
from public.products p
join (values
  ('faith-bracelet','Cross',null,40),('faith-bracelet','Anchor',null,40),('faith-bracelet','Dove',null,40),
  ('faith-bracelet','Olive Branch',null,40),('faith-bracelet','Grace',null,40),('faith-bracelet','Shield of Faith',null,40),
  ('couple-bracelets','Matching Cross',null,30),('couple-bracelets','Anchor and Rope',null,30),('couple-bracelets','Infinity',null,30),
  ('perfume-30ml','Oud Noir','him',25),('perfume-30ml','Cedar and Smoke','him',25),('perfume-30ml','Blue Amber','him',25),
  ('perfume-30ml','Velvet Rose','her',25),('perfume-30ml','White Jasmine','her',25),('perfume-30ml','Vanilla Bloom','her',25),
  ('pendant-necklace','Cross Pendant',null,20),('pendant-necklace','Dove',null,20),('pendant-necklace','Anchor',null,20),
  ('pendant-necklace','Lion of Judah',null,20),('pendant-necklace','Praying Hands',null,20),('pendant-necklace','Fish',null,20),
  ('pendant-necklace','Crown',null,20),('pendant-necklace','Initial Bar',null,20),
  ('fashion-glasses','Round Tortoise',null,20),('fashion-glasses','Square Black',null,20),('fashion-glasses','Aviator Gold',null,20),
  ('fashion-glasses','Clear Frame',null,20),('fashion-glasses','Cat-Eye Sand',null,20),
  ('flying-orb-ball','Midnight Blue',null,30),('flying-orb-ball','Ember Orange',null,30)
) as o(pslug, opt, grp, qty) on o.pslug = p.slug;

-- Digital gift cards (email delivery, fixed amounts)
insert into public.products (slug, name, type, description, base_price_kobo, is_made_to_order, seo_description)
values ('gift-card', 'Pemart Gift Card', 'gift_card',
  'A digital gift card delivered by email with a code to redeem at checkout. Choose ₦10,000, ₦25,000 or ₦50,000.',
  1000000, false, 'Digital Pemart gift card delivered by email. Redeemable at checkout.');
insert into public.product_variants (product_id, sku, option, price_kobo, stock_qty)
select p.id, 'GIFTCARD-' || a.amt, a.label, a.amt::bigint * 100, null
from public.products p
cross join (values (10000,'₦10,000'),(25000,'₦25,000'),(50000,'₦50,000')) as a(amt,label)
where p.slug = 'gift-card';

-- ---- Product images (placeholders until real photography is uploaded) ----
insert into public.product_images (product_id, url, alt, view, sort_order)
select p.id, d.preview_image, p.name || ' design', 'front', 0
from public.products p join public.designs d on d.id = p.design_id;

insert into public.product_images (product_id, url, alt, view, sort_order)
select p.id, '/placeholders/' || p.type || '.svg', p.name || ' garment', 'detail', 1
from public.products p where p.design_id is not null;

insert into public.product_images (product_id, url, alt, view, sort_order)
select p.id,
  '/placeholders/' || case p.type when 'jewellery' then 'necklace' when 'fun' then 'orb' when 'gift_card' then 'gift-card' else p.type end || '.svg',
  p.name, 'front', 0
from public.products p where p.design_id is null;
