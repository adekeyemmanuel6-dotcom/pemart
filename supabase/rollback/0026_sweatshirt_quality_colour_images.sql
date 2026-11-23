-- Only safe while no product uses type 'sweatshirt'. Photos keep working; colour/quality values are dropped.
alter table public.product_images drop column if exists colour;
alter table public.products drop constraint if exists products_quality_check;
alter table public.products drop column if exists quality;
alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check check (type in ('tee','hoodie','frame','perfume','jewellery','bracelet','glasses','fun','gift_card'));
