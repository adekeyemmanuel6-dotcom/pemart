-- Pemart 0011: accounts and post-purchase. Proof round trip, order status machine, reviews + store credit,
-- reminders, resuming payment. Same rules as 0010: one jsonb argument, SECURITY DEFINER, service role only.

alter table public.orders add column if not exists review_request_sent_at timestamptz;
alter table public.custom_requests add column if not exists revisions_paid int not null default 0,
                                   add column if not exists feedback jsonb not null default '[]'::jsonb;   -- [{version, note, at}]
alter table public.reviews add column if not exists credit_pending boolean not null default false,
                           add column if not exists moderated_at timestamptz;
alter table public.settings add column if not exists revision_fee_kobo bigint not null default 200000,
                            add column if not exists review_credit_kobo bigint not null default 200000;
alter table public.order_items drop constraint if exists order_items_kind_check;
alter table public.order_items add constraint order_items_kind_check check (kind in ('variant','bundle','gift_card','custom','revision'));
create unique index if not exists reviews_one_per_item on public.reviews(order_item_id) where order_item_id is not null;

-- ------------------------------------------------------------ status machine
create or replace function public._order_transition_ok(f text, t text) returns boolean language sql immutable as $$
  select case
    when f = t then false
    when t = 'cancelled' then f in ('paid','awaiting_proof','proof_sent','revision_requested','approved','in_production','quality_check','packed','reprint')
    when t = 'refunded' then f in ('paid','awaiting_proof','proof_sent','revision_requested','approved','in_production','quality_check','packed','out_for_delivery','delivered','reprint','cancelled')
    when t = 'in_production' then f in ('paid','approved','reprint')
    when t = 'quality_check' then f = 'in_production'
    when t = 'reprint' then f = 'quality_check'
    when t = 'packed' then f = 'quality_check'
    when t = 'out_for_delivery' then f = 'packed'
    when t = 'delivered' then f = 'out_for_delivery'
    else false end
$$;

create or replace function public.order_set_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = (p->>'order_id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._order_transition_ok(o.status, p->>'to') then
    return jsonb_build_object('ok', false, 'error', 'bad_transition', 'from', o.status, 'to', p->>'to');
  end if;
  -- Production cannot start while a custom design is unapproved.
  if p->>'to' = 'in_production' and o.has_custom and o.status not in ('approved','reprint') then
    return jsonb_build_object('ok', false, 'error', 'proof_not_approved');
  end if;
  if p->>'to' in ('cancelled') then perform public._release_order(o.id); end if;
  update public.orders set status = p->>'to', delivered_at = case when p->>'to' = 'delivered' then now() else delivered_at end where id = o.id;
  insert into public.order_events (order_id, status, note, actor) values (o.id, p->>'to', p->>'note', (p->>'actor')::uuid);
  return jsonb_build_object('ok', true, 'order_id', o.id, 'number', o.number, 'token', o.public_token, 'email', o.contact_email, 'phone', o.contact_phone,
                            'status', p->>'to', 'promised_by', o.promised_by);
end $$;

-- ------------------------------------------------------------ digital orders finish instantly; payments found by reference
create or replace function public.checkout_mark_paid(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  oid uuid; o public.orders; pay public.payments; z public.delivery_zones; amb public.ambassadors; r jsonb; v public.product_variants;
  item record; lead int; start_at timestamptz := now(); final text; codes jsonb := '[]'::jsonb; gc text; i int; digital boolean;
begin
  -- Find the order through the PAYMENT reference (an order can have several over its life: see checkout_new_reference).
  select order_id into oid from public.payments where reference = p->>'reference';
  if oid is null then return jsonb_build_object('ok', false, 'error', 'unknown_reference'); end if;
  select * into o from public.orders where id = oid for update;
  select * into pay from public.payments where reference = p->>'reference' for update;

  if pay.status = 'success' or (o.status not in ('pending_payment','cancelled') and o.paid_at is not null) then
    -- Idempotency. (Also covers a second reference paying an order that is already settled: flagged for a refund.)
    if pay.status <> 'success' then
      update public.payments set status = 'success', verified_at = now(), raw_payload = p->'payload' where id = pay.id;
      update public.orders set payment_note = 'Paid twice (second reference ' || (p->>'reference') || '). Refund needed.' where id = o.id;
      insert into public.order_events (order_id, status, note) values (o.id, o.status, 'Duplicate payment received. Refund needed.');
      return jsonb_build_object('ok', true, 'already', true, 'duplicate_payment', true, 'order_id', o.id, 'number', o.number, 'status', o.status, 'token', o.public_token);
    end if;
    return jsonb_build_object('ok', true, 'already', true, 'order_id', o.id, 'number', o.number, 'status', o.status, 'token', o.public_token);
  end if;

  if (p->>'amount')::bigint is distinct from o.total_kobo or coalesce(p->>'currency','NGN') <> 'NGN' then
    update public.payments set status = 'failed', raw_payload = p->'payload' where id = pay.id;
    insert into public.order_events (order_id, status, note) values (o.id, o.status, 'Payment rejected: amount or currency mismatch');
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch', 'order_id', o.id);
  end if;

  if o.status = 'cancelled' then
    begin
      for r in select * from jsonb_array_elements(o.reservations) loop
        select * into v from public.product_variants where id = (r->>'variant_id')::uuid for update;
        if v.stock_qty - v.reserved_qty < (r->>'qty')::int then raise exception 'out_of_stock'; end if;
        update public.product_variants set reserved_qty = reserved_qty + (r->>'qty')::int where id = v.id;
      end loop;
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
  update public.payments set status = 'abandoned' where order_id = o.id and id <> pay.id and status = 'initialised';

  for r in select * from jsonb_array_elements(o.reservations) loop
    update public.product_variants set stock_qty = stock_qty - (r->>'qty')::int, reserved_qty = greatest(0, reserved_qty - (r->>'qty')::int)
     where id = (r->>'variant_id')::uuid and stock_qty is not null;
  end loop;
  if o.discount_code_id is not null then update public.discount_codes set times_used = times_used + 1 where id = o.discount_code_id; end if;

  if o.ambassador_code is not null then
    select a.* into amb from public.ambassadors a where upper(a.code) = upper(o.ambassador_code);
    if found then
      insert into public.commissions (ambassador_id, order_id, amount_kobo, status)
      values (amb.id, o.id, round(o.subtotal_kobo * amb.commission_rate)::bigint, 'pending') on conflict (order_id) do nothing;
    end if;
  end if;

  for item in select * from public.order_items where order_id = o.id and kind = 'gift_card' loop
    for i in 1..item.quantity loop
      gc := public._gift_code();
      insert into public.gift_cards (code, initial_kobo, balance_kobo, purchaser_email, recipient_email, message, expires_at)
      values (gc, item.unit_price_kobo, item.unit_price_kobo, o.contact_email, nullif(item.options->>'recipient_email',''), nullif(item.options->>'message',''), now() + interval '12 months');
      codes := codes || jsonb_build_array(jsonb_build_object('code', gc, 'amount', item.unit_price_kobo, 'recipient_email', item.options->>'recipient_email', 'message', item.options->>'message'));
    end loop;
  end loop;

  -- A paid extra revision gives that design one more free revision.
  for item in select * from public.order_items where order_id = o.id and kind = 'revision' and custom_request_id is not null loop
    update public.custom_requests set revisions_paid = revisions_paid + item.quantity where id = item.custom_request_id;
  end loop;

  select * into z from public.delivery_zones where id = o.delivery_zone_id;
  lead := case when o.express then 2 else coalesce(z.lead_days, 5) end;
  digital := not exists (select 1 from public.order_items where order_id = o.id and kind not in ('gift_card','revision'));
  insert into public.order_events (order_id, status, note) values (o.id, 'paid', 'Payment confirmed');
  if digital then
    final := 'delivered';
    update public.orders set status = final, paid_at = start_at, delivered_at = start_at, expires_at = null where id = o.id;
    insert into public.order_events (order_id, status, note) values (o.id, final, 'Delivered by email');
  elsif o.has_custom then
    final := 'awaiting_proof';
    update public.custom_requests set status = 'awaiting_proof' where id in (select custom_request_id from public.order_items where order_id = o.id and kind = 'custom' and custom_request_id is not null);
    update public.orders set status = final, paid_at = start_at, expires_at = null where id = o.id;
    insert into public.order_events (order_id, status, note) values (o.id, final, 'Waiting for your design proof');
  else
    final := 'paid';
    update public.orders set status = final, paid_at = start_at, expires_at = null, production_start_at = start_at, promised_by = start_at + make_interval(days => lead) where id = o.id;
  end if;
  return jsonb_build_object('ok', true, 'already', false, 'order_id', o.id, 'number', o.number, 'status', final, 'token', o.public_token, 'gift_cards', codes, 'digital', digital);
end $$;

-- ------------------------------------------------------------ the proof round trip
create or replace function public._recompute_custom_order(p_order uuid) returns text
language plpgsql security definer set search_path = public as $$
declare o public.orders; z public.delivery_zones; total int; appr int; rev int; awa int; new_status text;
begin
  select * into o from public.orders where id = p_order for update;
  if o.status not in ('awaiting_proof','proof_sent','revision_requested') then return o.status; end if;
  select count(*), count(*) filter (where c.status = 'approved'), count(*) filter (where c.status = 'revision_requested'), count(*) filter (where c.status = 'awaiting_proof')
    into total, appr, rev, awa
    from public.custom_requests c join public.order_items i on i.custom_request_id = c.id where i.order_id = p_order and i.kind = 'custom';
  new_status := case when total > 0 and appr = total then 'approved' when rev > 0 then 'revision_requested' when awa > 0 then 'awaiting_proof' else 'proof_sent' end;
  if new_status <> o.status then
    update public.orders set status = new_status where id = p_order;
    insert into public.order_events (order_id, status, note) values (p_order, new_status,
      case new_status when 'approved' then 'Design approved. Your 5-day delivery clock has started.' when 'proof_sent' then 'Your design proof is ready' when 'revision_requested' then 'Revision requested' else null end);
  end if;
  -- The 5-day clock starts only when EVERY custom design in the order is approved.
  if new_status = 'approved' and o.production_start_at is null then
    select * into z from public.delivery_zones where id = o.delivery_zone_id;
    update public.orders set production_start_at = now(), promised_by = now() + make_interval(days => coalesce(z.lead_days, 5)) where id = p_order;
  end if;
  return new_status;
end $$;

create or replace function public.proof_send(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.custom_requests; o public.orders; v int; st text;
begin
  select * into c from public.custom_requests where id = (p->>'custom_request_id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if c.status not in ('awaiting_proof','revision_requested') then return jsonb_build_object('ok', false, 'error', 'not_awaiting_proof', 'status', c.status); end if;
  select o2.* into o from public.orders o2 join public.order_items i on i.order_id = o2.id
   where i.custom_request_id = c.id and i.kind = 'custom' and o2.status <> 'cancelled' order by o2.created_at desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_order'); end if;
  v := jsonb_array_length(c.proofs) + 1;
  update public.custom_requests set status = 'proof_sent',
    proofs = proofs || jsonb_build_array(jsonb_build_object('version', v, 'path', p->>'path', 'message', p->>'message', 'sent_at', now()))
   where id = c.id;
  st := public._recompute_custom_order(o.id);
  insert into public.order_events (order_id, status, note, actor) values (o.id, st, 'Proof version ' || v || ' sent', (p->>'actor')::uuid);
  return jsonb_build_object('ok', true, 'version', v, 'order_id', o.id, 'number', o.number, 'token', o.public_token, 'email', o.contact_email, 'phone', o.contact_phone, 'order_status', st);
end $$;

create or replace function public.proof_respond(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.custom_requests; o public.orders; st text; allowance int;
begin
  select * into c from public.custom_requests where id = (p->>'custom_request_id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select o2.* into o from public.orders o2 join public.order_items i on i.order_id = o2.id
   where i.custom_request_id = c.id and i.kind = 'custom' and o2.status <> 'cancelled' order by o2.created_at desc limit 1;
  if not found or not ((coalesce(p->>'token','') <> '' and p->>'token' = o.public_token) or (p->>'profile_id' is not null and o.profile_id = (p->>'profile_id')::uuid)) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if c.status <> 'proof_sent' then return jsonb_build_object('ok', false, 'error', 'no_proof_waiting', 'status', c.status); end if;

  if p->>'decision' = 'approve' then
    update public.custom_requests set status = 'approved', approved_at = now() where id = c.id;
  elsif p->>'decision' = 'revise' then
    allowance := 1 + c.revisions_paid;
    if c.revisions_used >= allowance then return jsonb_build_object('ok', false, 'error', 'paid_revision_required', 'custom_request_id', c.id); end if;
    if length(btrim(coalesce(p->>'note',''))) < 3 then return jsonb_build_object('ok', false, 'error', 'note_required'); end if;
    update public.custom_requests set status = 'revision_requested', revisions_used = revisions_used + 1,
      feedback = feedback || jsonb_build_array(jsonb_build_object('version', jsonb_array_length(c.proofs), 'note', left(p->>'note', 1000), 'at', now()))
     where id = c.id;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_decision');
  end if;
  st := public._recompute_custom_order(o.id);
  insert into public.order_events (order_id, status, note) values (o.id, st, case when p->>'decision' = 'approve' then 'Design approved by customer' else 'Customer asked for a revision' end);
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('ok', true, 'decision', p->>'decision', 'order_status', st, 'order_id', o.id, 'number', o.number, 'token', o.public_token, 'email', o.contact_email,
                            'promised_by', o.promised_by, 'production_started', o.production_start_at is not null);
end $$;

-- Payment can be restarted: the old reference stays valid (a late payment on it is still matched), a new one is issued.
create or replace function public.checkout_new_reference(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where number = upper(p->>'number') and public_token = p->>'token' and status = 'pending_payment' and (expires_at is null or expires_at > now()) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_payable'); end if;
  update public.payments set status = 'abandoned' where order_id = o.id and status = 'initialised';
  insert into public.payments (order_id, provider, reference, amount_kobo, currency, status) values (o.id, 'paystack', p->>'reference', o.total_kobo, 'NGN', 'initialised');
  update public.orders set payment_reference = p->>'reference' where id = o.id;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'number', o.number, 'total', o.total_kobo, 'email', o.contact_email, 'token', o.public_token);
end $$;

-- ------------------------------------------------------------ reviews and store credit
create or replace function public._grant_review_credit(p_review uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare rv public.reviews; o public.orders; pid uuid; amt bigint;
begin
  select * into rv from public.reviews where id = p_review for update;
  if rv.credit_issued or cardinality(rv.photo_urls) = 0 then return false; end if;
  select o2.* into o from public.orders o2 join public.order_items i on i.order_id = o2.id where i.id = rv.order_item_id;
  pid := o.profile_id;
  if pid is null then select id into pid from public.profiles where lower(email) = lower(o.contact_email) limit 1; end if;
  select coalesce((select review_credit_kobo from public.settings limit 1), 200000) into amt;
  if pid is null then update public.reviews set credit_pending = true where id = rv.id; return false; end if;
  update public.profiles set store_credit_kobo = store_credit_kobo + amt where id = pid;
  update public.reviews set credit_issued = true, credit_pending = false where id = rv.id;
  return true;
end $$;

create or replace function public._claim_pending_credit(p_profile uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select rv.id from public.reviews rv join public.order_items i on i.id = rv.order_item_id join public.orders o on o.id = i.order_id
            where rv.credit_pending and not rv.credit_issued and rv.status = 'approved' and lower(o.contact_email) = lower(p_email) loop
    perform public._grant_review_credit(r.id);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  perform public._claim_pending_credit(new.id, new.email);
  return new;
end $$;

create or replace function public.review_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; i public.order_items; pid uuid; rid uuid;
begin
  select * into o from public.orders where number = upper(p->>'number');
  if not found or not ((coalesce(p->>'token','') <> '' and p->>'token' = o.public_token) or (p->>'profile_id' is not null and o.profile_id = (p->>'profile_id')::uuid)) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if o.status <> 'delivered' then return jsonb_build_object('ok', false, 'error', 'not_delivered'); end if;
  select * into i from public.order_items where id = (p->>'order_item_id')::uuid and order_id = o.id;
  if not found then return jsonb_build_object('ok', false, 'error', 'item_not_found'); end if;
  if i.kind = 'variant' then select product_id into pid from public.product_variants where id = i.variant_id;
  elsif i.kind = 'bundle' then pid := nullif(i.selections->0->>'productId', '')::uuid; end if;
  if pid is null then return jsonb_build_object('ok', false, 'error', 'not_reviewable'); end if;
  if exists (select 1 from public.reviews where order_item_id = i.id) then return jsonb_build_object('ok', false, 'error', 'already_reviewed'); end if;
  if (p->>'rating')::int not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'bad_rating'); end if;
  insert into public.reviews (product_id, order_item_id, profile_id, display_name, rating, text, photo_urls, status)
  values (pid, i.id, o.profile_id, left(nullif(btrim(p->>'display_name'), ''), 60), (p->>'rating')::int, left(nullif(btrim(p->>'text'), ''), 1500),
          coalesce(array(select jsonb_array_elements_text(p->'photo_urls')), '{}'), 'pending') returning id into rid;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.review_moderate(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rv public.reviews; granted boolean := false;
begin
  select * into rv from public.reviews where id = (p->>'review_id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p->>'decision' = 'approve' then
    update public.reviews set status = 'approved', moderated_at = now() where id = rv.id;
    granted := public._grant_review_credit(rv.id);   -- only photo reviews earn credit, and only once
  elsif p->>'decision' = 'reject' then
    update public.reviews set status = 'rejected', moderated_at = now() where id = rv.id;
  else return jsonb_build_object('ok', false, 'error', 'bad_decision'); end if;
  return jsonb_build_object('ok', true, 'credit_granted', granted);
end $$;

-- ------------------------------------------------------------ reminders (called hourly)
create or replace function public.reminders_due(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare abandoned jsonb; reviews jsonb;
begin
  with u as (
    update public.orders set abandoned_email_sent_at = now()
     where status = 'pending_payment' and created_at <= now() - interval '1 hour' and (expires_at is null or expires_at > now()) and abandoned_email_sent_at is null
     returning number, public_token, contact_email, total_kobo)
  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'token', public_token, 'email', contact_email, 'total', total_kobo)), '[]'::jsonb) into abandoned from u;
  with u as (
    update public.orders set review_request_sent_at = now()
     where status = 'delivered' and delivered_at <= now() - interval '3 days' and review_request_sent_at is null
       and exists (select 1 from public.order_items i where i.order_id = orders.id and i.kind in ('variant','bundle'))
     returning number, public_token, contact_email)
  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'token', public_token, 'email', contact_email)), '[]'::jsonb) into reviews from u;
  return jsonb_build_object('abandoned', abandoned, 'reviews', reviews);
end $$;

-- ------------------------------------------------------------ account
create or replace function public.profile_get(p jsonb) returns jsonb language sql security definer stable set search_path = public as $$
  select to_jsonb(x) from (select id, email, full_name, phone, role, store_credit_kobo from public.profiles where id = (p->>'id')::uuid) x
$$;

create or replace function public.account_overview(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.profiles; pid uuid := (p->>'profile_id')::uuid;
begin
  select * into pr from public.profiles where id = pid;
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'email', pr.email, 'full_name', pr.full_name, 'phone', pr.phone, 'role', pr.role, 'store_credit_kobo', pr.store_credit_kobo),
    'orders', (select coalesce(jsonb_agg(jsonb_build_object(
        'number', o.number, 'status', o.status, 'total_kobo', o.total_kobo, 'created_at', o.created_at, 'promised_by', o.promised_by, 'has_custom', o.has_custom,
        'token', o.public_token, 'delivered_at', o.delivered_at,
        'reviewable', exists (select 1 from public.order_items i where i.order_id = o.id and i.kind in ('variant','bundle') and not exists (select 1 from public.reviews r where r.order_item_id = i.id)),
        'items', (select coalesce(jsonb_agg(i.name order by i.created_at), '[]'::jsonb) from public.order_items i where i.order_id = o.id),
        'proofs_waiting', (select count(*) from public.custom_requests c join public.order_items i on i.custom_request_id = c.id where i.order_id = o.id and i.kind = 'custom' and c.status = 'proof_sent')
      ) order by o.created_at desc), '[]'::jsonb) from public.orders o where o.profile_id = pid or lower(o.contact_email) = lower(pr.email)),
    'addresses', (select coalesce(jsonb_agg(to_jsonb(a) order by a.is_default desc, a.created_at), '[]'::jsonb) from public.addresses a where a.profile_id = pid),
    'wishlist', (select coalesce(jsonb_agg(w.product_id), '[]'::jsonb) from public.wishlist_items w where w.profile_id = pid));
end $$;

create or replace function public.address_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := (p->>'profile_id')::uuid; zid uuid; aid uuid;
begin
  select id into zid from public.delivery_zones where (p->>'state') = any(states) limit 1;
  if p->>'id' is not null then
    update public.addresses set recipient = p->>'recipient', phone = p->>'phone', line1 = p->>'line1', area = p->>'area', city = p->>'city', state = p->>'state', delivery_zone_id = zid
     where id = (p->>'id')::uuid and profile_id = pid returning id into aid;
    if aid is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  else
    insert into public.addresses (profile_id, recipient, phone, line1, area, city, state, delivery_zone_id, is_default)
    values (pid, p->>'recipient', p->>'phone', p->>'line1', p->>'area', p->>'city', p->>'state', zid, not exists (select 1 from public.addresses where profile_id = pid)) returning id into aid;
  end if;
  if coalesce((p->>'is_default')::boolean, false) then
    update public.addresses set is_default = (id = aid) where profile_id = pid;
  end if;
  return jsonb_build_object('ok', true, 'id', aid);
end $$;

create or replace function public.address_delete(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := (p->>'profile_id')::uuid; was_default boolean;
begin
  delete from public.addresses where id = (p->>'id')::uuid and profile_id = pid returning is_default into was_default;
  if was_default then update public.addresses set is_default = true where id = (select id from public.addresses where profile_id = pid order by created_at limit 1); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.wishlist_toggle(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.wishlist_items where profile_id = (p->>'profile_id')::uuid and product_id = (p->>'product_id')::uuid;
  get diagnostics n = row_count;
  if n = 0 then insert into public.wishlist_items (profile_id, product_id) values ((p->>'profile_id')::uuid, (p->>'product_id')::uuid); return jsonb_build_object('on', true); end if;
  return jsonb_build_object('on', false);
end $$;

create or replace function public.profile_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set full_name = left(nullif(btrim(p->>'full_name'), ''), 80), phone = left(nullif(btrim(p->>'phone'), ''), 30) where id = (p->>'profile_id')::uuid;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------ order lookup now includes proofs and review state
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
    'expires_at', o.expires_at, 'created_at', o.created_at, 'token', o.public_token, 'profile_id', o.profile_id,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'name', i.name, 'options', i.options, 'selections', i.selections,
              'unit_price_kobo', i.unit_price_kobo, 'quantity', i.quantity, 'custom_request_id', i.custom_request_id, 'gift_message', i.gift_message,
              'review_status', (select r.status from public.reviews r where r.order_item_id = i.id)) order by i.created_at), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
              from public.order_events e where e.order_id = o.id),
    'custom_requests', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'tier', c.tier, 'product_type', c.product_type, 'colour', c.colour, 'status', c.status,
              'proofs', c.proofs, 'feedback', c.feedback, 'revisions_used', c.revisions_used, 'revisions_paid', c.revisions_paid, 'text_fields', c.text_fields,
              'type_style', c.type_style, 'notes', c.notes, 'print_positions', c.print_positions, 'design_slug', (select d.slug from public.designs d where d.id = c.design_id)) order by c.created_at), '[]'::jsonb)
              from public.custom_requests c join public.order_items i on i.custom_request_id = c.id where i.order_id = o.id and i.kind = 'custom')
  );
end $$;

create or replace function public.checkout_custom_requests(p jsonb) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'tier', c.tier, 'product_type', c.product_type, 'colour', c.colour, 'status', c.status,
    'text_fields', c.text_fields, 'type_style', c.type_style, 'design_id', c.design_id, 'print_positions', c.print_positions,
    'in_use', exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
                      where oi.custom_request_id = c.id and oi.kind = 'custom' and o.status not in ('cancelled'))
  )), '[]'::jsonb)
  from public.custom_requests c
  where c.id in (select (jsonb_array_elements_text(p->'ids'))::uuid)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'order_set_status(jsonb)','proof_send(jsonb)','proof_respond(jsonb)','checkout_new_reference(jsonb)','review_submit(jsonb)','review_moderate(jsonb)',
    'reminders_due(jsonb)','profile_get(jsonb)','account_overview(jsonb)','address_save(jsonb)','address_delete(jsonb)','wishlist_toggle(jsonb)','profile_update(jsonb)',
    'checkout_get_order(jsonb)','checkout_custom_requests(jsonb)','checkout_mark_paid(jsonb)','_recompute_custom_order(uuid)','_grant_review_credit(uuid)',
    '_claim_pending_credit(uuid,text)','_order_transition_ok(text,text)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
