-- Run with: psql -d pemart_local -f supabase/tests/verify.sql  (local stub DB)
\set ON_ERROR_STOP off
select 'designs' t, count(*) from designs union all select 'products', count(*) from products
 union all select 'variants', count(*) from product_variants union all select 'bundles', count(*) from bundles
 union all select 'slots', count(*) from bundle_slots union all select 'tables without RLS',
   count(*) from pg_tables where schemaname='public' and not rowsecurity;

-- Anonymous visitor
set role anon;
select 'anon sees products' t, count(*) from products;
select 'anon sees bundles' t, count(*) from bundles;
select 'anon sees orders (expect 0)' t, count(*) from orders;
select 'anon sees discount_codes (expect 0)' t, count(*) from discount_codes;
select 'anon search "hood"' t, count(*) from search_catalogue('hood');
select 'anon search "kingdom"' t, kind, name from search_catalogue('kingdom') limit 3;
reset role;

-- Customer cannot promote themselves or add credit
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','c@example.com') on conflict do nothing;
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'customer reads own profile' t, count(*) from profiles;
update profiles set role='admin' where id = auth.uid();                -- expect error
update profiles set store_credit_kobo=999999 where id = auth.uid();    -- expect error
update profiles set full_name='Ada' where id = auth.uid();             -- ok
update settings set announcement_text='hacked';                         -- expect 0 rows
select 'settings unchanged' t, announcement_text from settings;
reset role; reset request.jwt.claim.sub;

-- Staff can see orders/not discounts; admin can see discounts
update profiles set role='staff' where id='11111111-1111-1111-1111-111111111111';
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'staff sees discount_codes (expect 0)' t, count(*) from discount_codes;
reset role; reset request.jwt.claim.sub;
update profiles set role='admin' where id='11111111-1111-1111-1111-111111111111';
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'admin sees discount_codes' t, count(*) from discount_codes;
reset role; reset request.jwt.claim.sub;

-- Gift boxes disappear after 24 Dec 2026
begin;
update bundles set available_until = now() - interval '1 day' where kind='gift_box';
set local role anon;
select 'anon sees gift boxes after cutoff (expect 0)' t, count(*) from bundles where kind='gift_box';
rollback;
