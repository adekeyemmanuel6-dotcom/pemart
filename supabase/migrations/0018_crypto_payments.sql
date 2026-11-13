-- 0018: pay with cryptocurrency (manual confirmation).
--
-- How it works: the buyer chooses "Pay with crypto" at checkout. The order is created exactly like a Paystack
-- order (same pricing checks, stock held), then switched to crypto: the store's wallet addresses at that moment
-- are copied onto the order, and the payment window is extended. The buyer sends the crypto and submits the
-- transaction hash. An ADMIN checks the wallet, and only then confirms the payment, which settles the order
-- through the same checkout_mark_paid used for Paystack (stock, discounts, gift cards, commissions, emails).
-- Nothing here can mark an order paid without an admin; customers can only attach a transaction hash.
--
-- Backward compatible: new nullable/defaulted columns and new functions only. Rollback: supabase/rollback/0018_crypto_payments.sql

alter table public.settings
  add column if not exists crypto_enabled boolean not null default false,
  add column if not exists crypto_wallets jsonb not null default '[]'::jsonb,
  add column if not exists crypto_instructions text,
  add column if not exists crypto_window_hours int not null default 48;

do $$ begin
  alter table public.settings add constraint settings_crypto_wallets_array check (jsonb_typeof(crypto_wallets) = 'array' and jsonb_array_length(crypto_wallets) <= 6);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.settings add constraint settings_crypto_window check (crypto_window_hours between 1 and 168);
exception when duplicate_object then null; end $$;

alter table public.orders
  add column if not exists payment_method text not null default 'paystack',
  add column if not exists crypto_payment jsonb;
do $$ begin
  alter table public.orders add constraint orders_payment_method check (payment_method in ('paystack', 'crypto'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ admin: wallet settings
create or replace function public.admin_crypto_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w jsonb; wallets jsonb := coalesce(p->'wallets', '[]'::jsonb);
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if jsonb_typeof(wallets) <> 'array' or jsonb_array_length(wallets) > 6 then raise exception 'invalid_wallets'; end if;
  for w in select * from jsonb_array_elements(wallets) loop
    if coalesce(w->>'asset','') !~ '^[A-Za-z0-9 ]{2,12}$'
       or coalesce(w->>'network','') !~ '^[A-Za-z0-9 ()._-]{2,40}$'
       or coalesce(w->>'address','') !~ '^[A-Za-z0-9:._-]{20,128}$'
       or length(coalesce(w->>'note','')) > 160 then raise exception 'invalid_wallet'; end if;
  end loop;
  if coalesce((p->>'enabled')::boolean, false) and jsonb_array_length(wallets) = 0 then raise exception 'wallet_required'; end if;
  update public.settings set
    crypto_enabled = coalesce((p->>'enabled')::boolean, false),
    crypto_wallets = (select coalesce(jsonb_agg(jsonb_build_object('asset', upper(trim(x->>'asset')), 'network', trim(x->>'network'), 'address', trim(x->>'address'), 'note', coalesce(trim(x->>'note'), ''))), '[]'::jsonb) from jsonb_array_elements(wallets) x),
    crypto_instructions = nullif(left(trim(coalesce(p->>'instructions', '')), 1000), ''),
    crypto_window_hours = greatest(1, least(168, coalesce((p->>'window_hours')::int, 48)))
  where id;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------ checkout: switch a new order to crypto
-- Called by the server right after checkout_create_order. Copies the wallets onto the order so a later
-- address change in the admin never changes where an existing order was told to pay.
create or replace function public.checkout_use_crypto(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; cfg public.settings;
begin
  select * into cfg from public.settings limit 1;
  if not cfg.crypto_enabled or jsonb_array_length(cfg.crypto_wallets) = 0 then raise exception 'crypto_unavailable'; end if;
  select * into o from public.orders where id = (p->>'order_id')::uuid for update;
  if o.id is null or o.status <> 'pending_payment' or o.payment_reference is distinct from p->>'reference' then raise exception 'crypto_bad_order'; end if;
  update public.orders set
    payment_method = 'crypto',
    crypto_payment = jsonb_build_object('wallets', cfg.crypto_wallets, 'instructions', cfg.crypto_instructions, 'submissions', '[]'::jsonb),
    expires_at = now() + make_interval(hours => cfg.crypto_window_hours)
  where id = o.id;
  update public.payments set provider = 'crypto' where reference = o.payment_reference and status = 'initialised';
  insert into public.order_events (order_id, status, note) values (o.id, 'pending_payment', 'Customer chose to pay with crypto');
  return jsonb_build_object('ok', true, 'expires_at', now() + make_interval(hours => cfg.crypto_window_hours));
end $$;

-- What the order page shows. The caller (server) has already authorised the viewer through checkout_get_order.
create or replace function public.checkout_get_crypto(p jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when o.payment_method = 'crypto' then jsonb_build_object(
    'wallets', coalesce(o.crypto_payment->'wallets', '[]'::jsonb),
    'instructions', o.crypto_payment->>'instructions',
    'submissions', coalesce(o.crypto_payment->'submissions', '[]'::jsonb),
    'expires_at', o.expires_at, 'status', o.status, 'total_kobo', o.total_kobo) end
  from public.orders o where o.id = (p->>'order_id')::uuid
$$;

-- The buyer attaches the transaction hash. Up to 5 submissions per order; this never changes the order status.
create or replace function public.checkout_crypto_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; subs jsonb; w jsonb;
begin
  select * into o from public.orders where id = (p->>'order_id')::uuid for update;
  if o.id is null or o.payment_method <> 'crypto' then return jsonb_build_object('ok', false, 'error', 'not_crypto'); end if;
  if o.status <> 'pending_payment' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  if coalesce(p->>'hash','') !~ '^(0x)?[A-Za-z0-9]{16,128}$' then return jsonb_build_object('ok', false, 'error', 'bad_hash'); end if;
  select x into w from jsonb_array_elements(o.crypto_payment->'wallets') x
   where x->>'asset' = p->>'asset' and x->>'network' = p->>'network' limit 1;
  if w is null then return jsonb_build_object('ok', false, 'error', 'bad_wallet'); end if;
  subs := coalesce(o.crypto_payment->'submissions', '[]'::jsonb);
  if jsonb_array_length(subs) >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  if exists (select 1 from jsonb_array_elements(subs) s where s->>'hash' = p->>'hash') then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.orders set crypto_payment = jsonb_set(crypto_payment, '{submissions}',
    subs || jsonb_build_array(jsonb_build_object('asset', w->>'asset', 'network', w->>'network', 'hash', p->>'hash', 'at', now())))
   where id = o.id;
  insert into public.order_events (order_id, status, note) values (o.id, 'pending_payment', 'Customer sent a crypto transaction for checking (' || (w->>'asset') || ' · ' || (w->>'network') || ')');
  return jsonb_build_object('ok', true, 'number', o.number);
end $$;

-- ------------------------------------------------------------ admin: confirm the crypto arrived
create or replace function public.admin_crypto_confirm(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; o public.orders; res jsonb;
begin
  perform public._require(actor, array['admin']);
  select * into o from public.orders where id = (p->>'order_id')::uuid;
  if o.id is null then raise exception 'not_found'; end if;
  if o.payment_method <> 'crypto' then raise exception 'not_crypto'; end if;
  res := public.checkout_mark_paid(jsonb_build_object(
    'reference', o.payment_reference, 'amount', o.total_kobo, 'currency', 'NGN',
    'payload', jsonb_build_object('source', 'crypto', 'confirmed_by', actor, 'confirmed_at', now(), 'note', left(coalesce(p->>'note',''), 300),
                                  'submissions', coalesce(o.crypto_payment->'submissions', '[]'::jsonb))));
  if coalesce((res->>'ok')::boolean, false) and not coalesce((res->>'already')::boolean, false) then
    insert into public.order_events (order_id, status, note)
    values (o.id, coalesce(res->>'status', 'paid'), 'Crypto payment confirmed by an admin' || coalesce(': ' || nullif(left(p->>'note', 300), ''), ''));
  end if;
  return res;
end $$;

-- Admin order screen: crypto details for one order.
create or replace function public.admin_crypto_get(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  perform public._require((p->>'actor')::uuid, array['staff', 'admin']);
  select * into o from public.orders where id = (p->>'order_id')::uuid;
  if o.id is null or o.payment_method <> 'crypto' then return null; end if;
  return jsonb_build_object('wallets', coalesce(o.crypto_payment->'wallets', '[]'::jsonb), 'submissions', coalesce(o.crypto_payment->'submissions', '[]'::jsonb), 'expires_at', o.expires_at, 'status', o.status);
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_crypto_settings_save(jsonb)','checkout_use_crypto(jsonb)','checkout_get_crypto(jsonb)','checkout_crypto_submit(jsonb)','admin_crypto_confirm(jsonb)','admin_crypto_get(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
