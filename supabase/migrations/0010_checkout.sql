-- Pemart 0010: checkout. Money-critical steps run as single-transaction SQL functions.
-- Every function takes ONE jsonb argument `p`, is SECURITY DEFINER, and is executable by
-- the service role only (never by anon or signed-in browsers).

alter table public.orders
  add column if not exists public_token text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists reservations jsonb not null default '[]'::jsonb,   -- [{variant_id, qty}] stocked items held for this order
  add column if not exists surprise_note boolean not null default false,
  add column if not exists payment_note text;
create unique index if not exists orders_public_token_idx on public.orders(public_token);

alter table public.order_items drop constraint if exists order_items_kind_check;
alter table public.order_items add constraint order_items_kind_check check (kind in ('variant','bundle','gift_card','custom'));

-- ---------------------------------------------------------------- helpers
create or replace function public._gift_code() returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text := ''; i int;
begin
  for i in 1..12 loop code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
  return 'PG-' || substr(code,1,4) || '-' || substr(code,5,4) || '-' || substr(code,9,4);
end $$;

-- Put back stock holds, store credit and gift card balance for an unpaid order.
create or replace function public._release_order(p_order uuid) returns void language plpgsql as $$
declare o public.orders; r jsonb;
begin
  select * into o from public.orders where id = p_order;
  for r in select * from jsonb_array_elements(o.reservations) loop
    update public.product_variants
       set reserved_qty = greatest(0, reserved_qty - (r->>'qty')::int)
     where id = (r->>'variant_id')::uuid;
  end loop;
  if o.credit_used_kobo > 0 and o.profile_id is not null then
    update public.profiles set store_credit_kobo = store_credit_kobo + o.credit_used_kobo where id = o.profile_id;
  end if;
  if o.gift_card_used_kobo > 0 and o.gift_card_id is not null then
    update public.gift_cards set balance_kobo = balance_kobo + o.gift_card_used_kobo where id = o.gift_card_id;
  end if;
end $$;

-- ---------------------------------------------------------------- lookups for pricing
create or replace function public.checkout_context(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.discount_codes; amb public.ambassadors; gc public.gift_cards; uses int := 0; credit bigint := 0; out jsonb := '{}'::jsonb;
begin
  if coalesce(p->>'code','') <> '' then
    select * into d from public.discount_codes where upper(code) = upper(p->>'code') and is_active;
    if found then
      select count(*) into uses from public.orders o
       where o.discount_code_id = d.id and o.status not in ('cancelled','pending_payment','refunded')
         and ((p->>'profile_id' is not null and o.profile_id = (p->>'profile_id')::uuid)
              or (p->>'email' is not null and lower(o.contact_email) = lower(p->>'email')));
      select * into amb from public.ambassadors where id = d.ambassador_id and is_active;
      out := out || jsonb_build_object('discount', jsonb_build_object(
        'id', d.id, 'code', d.code, 'type', d.type, 'value', d.value, 'min_spend_kobo', d.min_spend_kobo,
        'starts_at', d.starts_at, 'ends_at', d.ends_at, 'usage_limit', d.usage_limit, 'times_used', d.times_used,
        'per_customer_limit', d.per_customer_limit, 'customer_uses', uses,
        'collection_ids', d.collection_ids, 'product_ids', d.product_ids,
        'ambassador_id', d.ambassador_id, 'ambassador_rate', amb.commission_rate));
    end if;
  end if;
  if coalesce(p->>'gift_code','') <> '' then
    select * into gc from public.gift_cards where upper(code) = upper(p->>'gift_code');
    if found then
      out := out || jsonb_build_object('gift_card', jsonb_build_object('id', gc.id, 'code', gc.code, 'balance_kobo', gc.balance_kobo, 'expires_at', gc.expires_at));
    end if;
  end if;
  if p->>'profile_id' is not null then
    select store_credit_kobo into credit from public.profiles where id = (p->>'profile_id')::uuid;
    out := out || jsonb_build_object('credit_kobo', coalesce(credit, 0));
  end if;
  return out;
end $$;

-- ---------------------------------------------------------------- custom requests
create or replace function public.custom_request_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare did uuid; rid uuid;
begin
  if coalesce(p->>'design_slug','') <> '' then select id into did from public.designs where slug = p->>'design_slug'; end if;
  insert into public.custom_requests (profile_id, contact_email, tier, product_type, design_id, colour, print_positions, text_fields, type_style, notes, upload_paths, status, fee_kobo)
  values ((p->>'profile_id')::uuid, p->>'contact_email', p->>'tier', p->>'product_type', did, p->>'colour',
          coalesce(array(select jsonb_array_elements_text(p->'print_positions')), '{back}'),
          coalesce(p->'text_fields', '{}'::jsonb), p->>'type_style', p->>'notes',
          coalesce(array(select jsonb_array_elements_text(p->'upload_paths')), '{}'), 'draft', (p->>'fee_kobo')::bigint)
  returning id into rid;
  return jsonb_build_object('id', rid);
end $$;

-- Requests usable in a new order: still draft and not attached to a live order.
create or replace function public.checkout_custom_requests(p jsonb) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'tier', c.tier, 'product_type', c.product_type, 'colour', c.colour, 'status', c.status,
    'text_fields', c.text_fields, 'type_style', c.type_style, 'design_id', c.design_id, 'print_positions', c.print_positions,
    'in_use', exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
                      where oi.custom_request_id = c.id and o.status not in ('cancelled'))
  )), '[]'::jsonb)
  from public.custom_requests c
  where c.id in (select (jsonb_array_elements_text(p->'ids'))::uuid)
$$;

-- ---------------------------------------------------------------- create order (atomic)
create or replace function public.checkout_create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; rv jsonb; v public.product_variants; oid uuid; onum text; tok text; res jsonb := '[]'::jsonb; n int;
begin
  -- 1. Reserve stock for stocked variants. Row locks serialise competing buyers.
  for rv in select * from jsonb_array_elements(coalesce(p->'reserve','[]'::jsonb)) loop
    select * into v from public.product_variants where id = (rv->>'variant_id')::uuid for update;
    if not found or not v.is_active then raise exception 'unavailable:%', coalesce(rv->>'variant_id','?'); end if;
    if v.stock_qty is not null then
      if v.stock_qty - v.reserved_qty < (rv->>'qty')::int then raise exception 'out_of_stock:%', v.sku; end if;
      update public.product_variants set reserved_qty = reserved_qty + (rv->>'qty')::int where id = v.id;
      res := res || jsonb_build_array(jsonb_build_object('variant_id', v.id, 'qty', (rv->>'qty')::int));
    end if;
  end loop;

  -- 2. Hold store credit and gift card balance (restored if the order is cancelled).
  if coalesce((p->>'credit_used')::bigint, 0) > 0 then
    update public.profiles set store_credit_kobo = store_credit_kobo - (p->>'credit_used')::bigint
     where id = (p->>'profile_id')::uuid and store_credit_kobo >= (p->>'credit_used')::bigint;
    get diagnostics n = row_count; if n = 0 then raise exception 'insufficient_credit'; end if;
  end if;
  if coalesce((p->>'gift_card_used')::bigint, 0) > 0 then
    update public.gift_cards set balance_kobo = balance_kobo - (p->>'gift_card_used')::bigint
     where id = (p->>'gift_card_id')::uuid and balance_kobo >= (p->>'gift_card_used')::bigint and (expires_at is null or expires_at > now());
    get diagnostics n = row_count; if n = 0 then raise exception 'gift_card_unavailable'; end if;
  end if;

  -- 3. The order, its items, first event and the payment record.
  insert into public.orders (profile_id, contact_email, contact_phone, status, has_custom, has_bundle,
      subtotal_kobo, discount_kobo, delivery_fee_kobo, gift_wrap_kobo, surprise_note_kobo, express_kobo, ship_ready_first_kobo,
      credit_used_kobo, gift_card_used_kobo, total_kobo, address, delivery_zone_id, delivery_zone_name, is_gift, gift_message,
      ship_ready_first, express, surprise_note, discount_code_id, discount_code, ambassador_code, gift_card_id,
      payment_reference, expires_at, reservations)
  values ((p->>'profile_id')::uuid, p->>'contact_email', p->>'contact_phone', 'pending_payment',
      coalesce((p->>'has_custom')::boolean,false), coalesce((p->>'has_bundle')::boolean,false),
      (p->>'subtotal')::bigint, (p->>'discount')::bigint, (p->>'delivery_fee')::bigint, (p->>'gift_wrap')::bigint,
      (p->>'surprise_note_fee')::bigint, (p->>'express_fee')::bigint, (p->>'ship_ready_first_fee')::bigint,
      (p->>'credit_used')::bigint, (p->>'gift_card_used')::bigint, (p->>'total')::bigint,
      p->'address', (p->>'delivery_zone_id')::uuid, p->>'delivery_zone_name', coalesce((p->>'is_gift')::boolean,false), p->>'gift_message',
      coalesce((p->>'ship_ready_first')::boolean,false), coalesce((p->>'express')::boolean,false), coalesce((p->>'surprise_note')::boolean,false),
      (p->>'discount_code_id')::uuid, p->>'discount_code', p->>'ambassador_code', (p->>'gift_card_id')::uuid,
      p->>'payment_reference', coalesce((p->>'expires_at')::timestamptz, now() + interval '24 hours'), res)
  returning id, number, public_token into oid, onum, tok;

  for it in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (order_id, kind, variant_id, bundle_id, name, options, selections, unit_price_kobo, quantity, custom_request_id, gift_message)
    values (oid, it->>'kind', (it->>'variant_id')::uuid, (it->>'bundle_id')::uuid, it->>'name', coalesce(it->'options','{}'::jsonb),
            it->'selections', (it->>'unit_price')::bigint, (it->>'quantity')::int, (it->>'custom_request_id')::uuid, it->>'gift_message');
  end loop;

  insert into public.order_events (order_id, status, note) values (oid, 'pending_payment', 'Order created');
  insert into public.payments (order_id, provider, reference, amount_kobo, currency, status)
  values (oid, 'paystack', p->>'payment_reference', (p->>'total')::bigint, 'NGN', 'initialised');

  return jsonb_build_object('order_id', oid, 'number', onum, 'token', tok, 'total', (p->>'total')::bigint, 'reference', p->>'payment_reference');
end $$;

-- ---------------------------------------------------------------- mark paid (idempotent)
create or replace function public.checkout_mark_paid(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders; pay public.payments; z public.delivery_zones; amb public.ambassadors; r jsonb; v public.product_variants;
  item record; lead int; start_at timestamptz := now(); final text; codes jsonb := '[]'::jsonb; gc text; i int; sub_for_commission bigint;
begin
  select * into o from public.orders where payment_reference = p->>'reference' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown_reference'); end if;
  select * into pay from public.payments where reference = p->>'reference' for update;

  -- Idempotency: a second call (webhook retry, verify + webhook race) changes nothing.
  if pay.status = 'success' then
    return jsonb_build_object('ok', true, 'already', true, 'order_id', o.id, 'number', o.number, 'status', o.status, 'token', o.public_token);
  end if;

  -- Never trust the client or the network: the amount and currency must match what we charged.
  if (p->>'amount')::bigint is distinct from o.total_kobo or coalesce(p->>'currency','NGN') <> 'NGN' then
    update public.payments set status = 'failed', raw_payload = p->'payload' where id = pay.id;
    insert into public.order_events (order_id, status, note) values (o.id, o.status, 'Payment rejected: amount or currency mismatch');
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch', 'order_id', o.id);
  end if;

  if o.status = 'cancelled' then
    -- Paid after the order lapsed: take the hold again if we still can, otherwise flag it for a refund.
    begin
      for r in select * from jsonb_array_elements(o.reservations) loop
        select * into v from public.product_variants where id = (r->>'variant_id')::uuid for update;
        if v.stock_qty - v.reserved_qty < (r->>'qty')::int then raise exception 'out_of_stock'; end if;
        update public.product_variants set reserved_qty = reserved_qty + (r->>'qty')::int where id = v.id;
      end loop;
      -- credit and gift card were released at cancellation; take them again
      if o.credit_used_kobo > 0 then update public.profiles set store_credit_kobo = store_credit_kobo - o.credit_used_kobo where id = o.profile_id and store_credit_kobo >= o.credit_used_kobo; if not found then raise exception 'credit'; end if; end if;
      if o.gift_card_used_kobo > 0 then update public.gift_cards set balance_kobo = balance_kobo - o.gift_card_used_kobo where id = o.gift_card_id and balance_kobo >= o.gift_card_used_kobo; if not found then raise exception 'gift'; end if; end if;
    exception when others then
      update public.payments set status = 'success', verified_at = now(), raw_payload = p->'payload' where id = pay.id;
      update public.orders set payment_note = 'Paid after the order expired and could not be restored. Refund needed.' where id = o.id;
      insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', 'Payment received after expiry; could not restore stock. Refund needed.');
      return jsonb_build_object('ok', true, 'needs_refund', true, 'order_id', o.id, 'number', o.number, 'status', 'cancelled', 'token', o.public_token);
    end;
  end if;

  update public.payments set status = 'success', verified_at = now(), raw_payload = p->'payload' where id = pay.id;

  -- Stock: turn the hold into a real decrement.
  for r in select * from jsonb_array_elements(o.reservations) loop
    update public.product_variants
       set stock_qty = stock_qty - (r->>'qty')::int, reserved_qty = greatest(0, reserved_qty - (r->>'qty')::int)
     where id = (r->>'variant_id')::uuid and stock_qty is not null;
  end loop;

  if o.discount_code_id is not null then update public.discount_codes set times_used = times_used + 1 where id = o.discount_code_id; end if;

  -- Ambassador commission: rate x goods subtotal, recorded once per order.
  if o.ambassador_code is not null then
    select a.* into amb from public.ambassadors a where upper(a.code) = upper(o.ambassador_code);
    if found then
      sub_for_commission := o.subtotal_kobo;
      insert into public.commissions (ambassador_id, order_id, amount_kobo, status)
      values (amb.id, o.id, round(sub_for_commission * amb.commission_rate)::bigint, 'pending') on conflict (order_id) do nothing;
    end if;
  end if;

  -- Gift cards bought in this order: create the codes.
  for item in select * from public.order_items where order_id = o.id and kind = 'gift_card' loop
    for i in 1..item.quantity loop
      gc := public._gift_code();
      insert into public.gift_cards (code, initial_kobo, balance_kobo, purchaser_email, recipient_email, message, expires_at)
      values (gc, item.unit_price_kobo, item.unit_price_kobo, o.contact_email, nullif(item.options->>'recipient_email',''), nullif(item.options->>'message',''), now() + interval '12 months');
      codes := codes || jsonb_build_array(jsonb_build_object('code', gc, 'amount', item.unit_price_kobo, 'recipient_email', item.options->>'recipient_email', 'message', item.options->>'message'));
    end loop;
  end loop;

  -- Routing. Custom orders wait for the proof; the 5-day clock starts when it is approved (later phase).
  select * into z from public.delivery_zones where id = o.delivery_zone_id;
  lead := case when o.express then 2 else coalesce(z.lead_days, 5) end;
  insert into public.order_events (order_id, status, note) values (o.id, 'paid', 'Payment confirmed');
  if o.has_custom then
    final := 'awaiting_proof';
    update public.custom_requests set status = 'awaiting_proof'
     where id in (select custom_request_id from public.order_items where order_id = o.id and custom_request_id is not null);
    update public.orders set status = final, paid_at = start_at, expires_at = null where id = o.id;
    insert into public.order_events (order_id, status, note) values (o.id, final, 'Waiting for your design proof');
  else
    final := 'paid';
    update public.orders set status = final, paid_at = start_at, expires_at = null, production_start_at = start_at, promised_by = start_at + make_interval(days => lead) where id = o.id;
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'order_id', o.id, 'number', o.number, 'status', final, 'token', o.public_token, 'gift_cards', codes);
end $$;

-- ---------------------------------------------------------------- expiry
create or replace function public.checkout_cancel_expired(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id from public.orders where status = 'pending_payment' and expires_at is not null and expires_at < coalesce((p->>'now')::timestamptz, now()) for update skip locked loop
    perform public._release_order(o.id);
    update public.orders set status = 'cancelled' where id = o.id;
    update public.payments set status = 'abandoned' where order_id = o.id and status = 'initialised';
    insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', 'Not paid within 24 hours');
    n := n + 1;
  end loop;
  return jsonb_build_object('cancelled', n);
end $$;

-- ---------------------------------------------------------------- read an order (guest tracking, confirmation)
create or replace function public.checkout_get_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; ok boolean := false; phone_digits text;
begin
  select * into o from public.orders where number = upper(p->>'number');
  if not found then return null; end if;
  phone_digits := right(regexp_replace(coalesce(p->>'contact',''), '\D', '', 'g'), 10);
  ok := (coalesce(p->>'token','') <> '' and p->>'token' = o.public_token)
     or (p->>'profile_id' is not null and o.profile_id = (p->>'profile_id')::uuid)
     or (coalesce(p->>'contact','') <> '' and (lower(p->>'contact') = lower(o.contact_email)
          or (length(phone_digits) = 10 and phone_digits = right(regexp_replace(o.contact_phone, '\D', '', 'g'), 10))));
  if not ok then return null; end if;
  return jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'has_custom', o.has_custom, 'contact_email', o.contact_email, 'contact_phone', o.contact_phone,
    'subtotal_kobo', o.subtotal_kobo, 'discount_kobo', o.discount_kobo, 'delivery_fee_kobo', o.delivery_fee_kobo, 'gift_wrap_kobo', o.gift_wrap_kobo,
    'surprise_note_kobo', o.surprise_note_kobo, 'express_kobo', o.express_kobo, 'ship_ready_first_kobo', o.ship_ready_first_kobo,
    'credit_used_kobo', o.credit_used_kobo, 'gift_card_used_kobo', o.gift_card_used_kobo, 'total_kobo', o.total_kobo,
    'address', o.address, 'delivery_zone_name', o.delivery_zone_name, 'is_gift', o.is_gift, 'gift_message', o.gift_message,
    'discount_code', o.discount_code, 'payment_reference', o.payment_reference, 'paid_at', o.paid_at,
    'production_start_at', o.production_start_at, 'promised_by', o.promised_by, 'delivered_at', o.delivered_at,
    'expires_at', o.expires_at, 'created_at', o.created_at, 'token', o.public_token,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'name', i.name, 'options', i.options, 'selections', i.selections,
              'unit_price_kobo', i.unit_price_kobo, 'quantity', i.quantity, 'custom_request_id', i.custom_request_id, 'gift_message', i.gift_message) order by i.created_at), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
              from public.order_events e where e.order_id = o.id)
  );
end $$;

-- Lock every function down to the service role.
do $$
declare f text;
begin
  foreach f in array array[
    'checkout_context(jsonb)','custom_request_create(jsonb)','checkout_custom_requests(jsonb)','checkout_create_order(jsonb)',
    'checkout_mark_paid(jsonb)','checkout_cancel_expired(jsonb)','checkout_get_order(jsonb)','_release_order(uuid)','_gift_code()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Cancel one unpaid order right now (e.g. the payment provider refused to start a transaction).
create or replace function public.checkout_cancel_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = (p->>'order_id')::uuid and status = 'pending_payment' for update;
  if not found then return jsonb_build_object('cancelled', false); end if;
  perform public._release_order(o.id);
  update public.orders set status = 'cancelled' where id = o.id;
  update public.payments set status = 'failed' where order_id = o.id and status = 'initialised';
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', coalesce(p->>'note', 'Cancelled'));
  return jsonb_build_object('cancelled', true);
end $$;
revoke all on function public.checkout_cancel_order(jsonb) from public, anon, authenticated;
grant execute on function public.checkout_cancel_order(jsonb) to service_role;

-- Live stock for every stocked variant (a few dozen rows), so quotes never rely on the cached catalogue for availability.
create or replace function public.checkout_stock(p jsonb) returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'stock_qty', stock_qty, 'reserved_qty', reserved_qty)), '[]'::jsonb)
  from public.product_variants where stock_qty is not null
$$;
revoke all on function public.checkout_stock(jsonb) from public, anon, authenticated;
grant execute on function public.checkout_stock(jsonb) to service_role;
