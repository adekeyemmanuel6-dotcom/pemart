-- Revert application code FIRST. Export new configuration before rollback.
-- Keeps new columns, assignments and shipping snapshots for lossless recovery.
-- Restores prior function bodies; historical orders are never deleted or recalculated.
begin;
create or replace function public.admin_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[]; t text := p->>'table';
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  allowed := case t
    when 'collections' then array['slug','name','intro','hero_image','sort_order','is_active','is_seasonal']
    when 'designs' then array['slug','name','story_or_verse','verse_reference','collection_id','artwork_front','artwork_back','preview_image','allowed_product_types','is_customisable','customisable_fields','is_active']
    when 'products' then array['slug','name','type','design_id','collection_id','description','care','base_price_kobo','compare_at_kobo','is_made_to_order','is_active','is_featured','is_seasonal','seo_title','seo_description']
    when 'product_variants' then array['product_id','sku','colour','size','option','option_group','price_kobo','is_active']
    when 'bundles' then array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']
    when 'delivery_zones' then array['name','states','fee_kobo','free_over_kobo','lead_days','christmas_cutoff_date','sort_order']
    when 'discount_codes' then array['code','type','value','min_spend_kobo','starts_at','ends_at','usage_limit','per_customer_limit','collection_ids','product_ids','is_single_use','is_active']
    when 'ambassadors' then array['name','phone','email','commission_rate','payout_note','is_active']
    else null end;
  if allowed is null then raise exception 'bad_table'; end if;
  return jsonb_build_object('id', public._save_row(t, p->'row', allowed));
end $$;

create or replace function public.admin_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[] := array['announcement_text','announcement_link','announcement_active','logo_url','upsell_product_id','upsell_price_kobo','gift_wrap_kobo','surprise_note_kobo','express_kobo','express_enabled',
    'whatsapp_number','instagram_url','tiktok_url','pay_on_delivery_enabled','maintenance_mode','revision_fee_kobo','review_credit_kobo']; cols text;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select string_agg(format('%I = r.%I', key, key), ', ') into cols from jsonb_object_keys(p->'settings') as key where key = any(allowed);
  if cols is null then return jsonb_build_object('ok', true); end if;
  execute format('update public.settings s set %s from jsonb_populate_record(null::public.settings, $1) r where s.id', cols) using p->'settings';
  return jsonb_build_object('ok', true);
end $$;

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
commit;
