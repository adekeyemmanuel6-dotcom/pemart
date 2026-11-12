-- 0014: additive Wear The Word upgrade. Review with the owner before applying.
-- Existing IDs, order relationships and payment verification are preserved. No seed is run.
begin;
alter table public.settings
  add column free_shipping_threshold_kobo bigint not null default 20000000 check (free_shipping_threshold_kobo > 0),
  add column dispatch_origin text not null default 'Akure, Ondo State, Nigeria',
  add column hero_image_url text,
  add column hero_image_alt text,
  add column hero_headline text not null default 'WEAR WHAT YOU STAND ON.',
  add column hero_copy text not null default 'Your faith is more than what you believe. It is what you live, represent and carry every day.';
alter table public.products
  add column themes text[] not null default '{}',
  add column brand_collections text[] not null default '{}',
  add column weight_grams integer check (weight_grams > 0);
alter table public.delivery_zones
  add column cities text[] not null default '{}',
  add column provider text,
  add column service text,
  add column is_active boolean not null default true,
  add column rate_verified boolean not null default false,
  add column free_shipping_eligible boolean not null default true,
  add column min_days integer check (min_days >= 0),
  add column max_days integer check (max_days >= 0),
  add column weight_allowance_grams integer check (weight_allowance_grams > 0),
  add column additional_kg_kobo bigint check (additional_kg_kobo >= 0),
  add constraint delivery_estimate_range check ((min_days is null and max_days is null) or (min_days is not null and max_days is not null and min_days <= max_days));
alter table public.orders add column shipping_estimate_days integer, add column shipping_snapshot jsonb;
create index products_themes_idx on public.products using gin(themes);
create index products_brand_collections_idx on public.products using gin(brand_collections);
-- Explicit mapping of existing design IDs. No product, collection, variant or order ID changes.
update public.products p set brand_collections = array['scripture'], themes = array['Faith']
from public.designs d where p.design_id=d.id and d.verse_reference is not null;
update public.products p set brand_collections = array['together'], themes = array['Love']
from public.designs d where p.design_id=d.id and d.slug in ('two-are-better','better-together','my-beloved');
update public.products p set brand_collections = array['declaration'], themes = array['Faith','Confidence']
from public.designs d where p.design_id=d.id and d.slug in ('god-dey','no-shaking','grace-dey-load');
-- Clear ONLY the known shipped seasonal default. Preserve custom announcements.
update public.settings set announcement_text=null where announcement_text='Order by 17 Dec for Christmas delivery in Lagos';

create or replace function public.admin_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[]; t text := p->>'table';
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  allowed := case t
    when 'collections' then array['slug','name','intro','hero_image','sort_order','is_active','is_seasonal']
    when 'designs' then array['slug','name','story_or_verse','verse_reference','collection_id','artwork_front','artwork_back','preview_image','allowed_product_types','is_customisable','customisable_fields','is_active']
    when 'products' then array['slug','name','type','design_id','collection_id','description','care','base_price_kobo','compare_at_kobo','is_made_to_order','is_active','is_featured','is_seasonal','seo_title','seo_description','themes','brand_collections','weight_grams']
    when 'product_variants' then array['product_id','sku','colour','size','option','option_group','price_kobo','is_active']
    when 'bundles' then array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']
    when 'delivery_zones' then array['name','states','fee_kobo','free_over_kobo','lead_days','christmas_cutoff_date','sort_order','cities','provider','service','is_active','rate_verified','free_shipping_eligible','min_days','max_days','weight_allowance_grams','additional_kg_kobo']
    when 'discount_codes' then array['code','type','value','min_spend_kobo','starts_at','ends_at','usage_limit','per_customer_limit','collection_ids','product_ids','is_single_use','is_active']
    when 'ambassadors' then array['name','phone','email','commission_rate','payout_note','is_active']
    else null end;
  if allowed is null then raise exception 'bad_table'; end if;
  return jsonb_build_object('id', public._save_row(t, p->'row', allowed));
end $$;

create or replace function public.admin_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare allowed text[] := array['announcement_text','announcement_link','announcement_active','logo_url','upsell_product_id','upsell_price_kobo','gift_wrap_kobo','surprise_note_kobo','express_kobo','express_enabled',
    'whatsapp_number','instagram_url','tiktok_url','pay_on_delivery_enabled','maintenance_mode','revision_fee_kobo','review_credit_kobo','free_shipping_threshold_kobo','dispatch_origin','hero_image_url','hero_image_alt','hero_headline','hero_copy']; cols text;
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
  it jsonb; rv jsonb; v public.product_variants; oid uuid; onum text; tok text; res jsonb := '[]'::jsonb; n int; z public.delivery_zones; cfg public.settings; physical boolean; eligible bigint; expected bigint; weight bigint; missing_weight boolean; max_days_snapshot int;
begin
  -- Validate the current shipping service inside the same transaction as order creation.
  select * into cfg from public.settings limit 1;
  select exists(select 1 from jsonb_array_elements(p->'items') i where i->>'kind' not in ('gift_card','revision')) into physical;
  if physical then
    select * into z from public.delivery_zones where id = (p->>'delivery_zone_id')::uuid for share;
    if z.id is null or not z.is_active or not z.rate_verified or not exists(
      select 1 from unnest(z.states) st where
        (case when trim(st) ~* '^(abuja|fct|fct\s*\(abuja\)|federal capital territory)$' then 'fct' else lower(trim(st)) end) =
        (case when trim(p->'address'->>'state') ~* '^(abuja|fct|fct\s*\(abuja\)|federal capital territory)$' then 'fct' else lower(trim(p->'address'->>'state')) end)
    )
      or nullif(trim(p->'address'->>'city'),'') is null
      or (cardinality(z.cities) > 0 and not exists(select 1 from unnest(z.cities) city where lower(trim(city)) = lower(trim(p->'address'->>'city'))))
      then raise exception 'shipping_confirmation_required'; end if;
    select greatest(0, coalesce(sum((i->>'unit_price')::bigint * (i->>'quantity')::int),0) - (p->>'discount')::bigint)
      into eligible from jsonb_array_elements(p->'items') i where i->>'kind' not in ('gift_card','revision');
    expected := z.fee_kobo;
    if z.weight_allowance_grams is not null then
      select sum(pr.weight_grams * (i->>'quantity')::int), bool_or(i->>'kind' <> 'variant' or pr.weight_grams is null)
        into weight, missing_weight from jsonb_array_elements(p->'items') i
        left join public.product_variants pv on pv.id = (i->>'variant_id')::uuid
        left join public.products pr on pr.id = pv.product_id
        where i->>'kind' not in ('gift_card','revision');
      if missing_weight or weight is null then raise exception 'shipping_weight_required'; end if;
      if weight > z.weight_allowance_grams then
        if z.additional_kg_kobo is null then raise exception 'shipping_weight_required'; end if;
        expected := expected + ceil((weight-z.weight_allowance_grams)::numeric / 1000)::bigint * z.additional_kg_kobo;
      end if;
    end if;
    if z.free_shipping_eligible and eligible >= cfg.free_shipping_threshold_kobo then expected := 0; end if;
    if (p->>'delivery_fee')::bigint is distinct from expected then raise exception 'shipping_quote_changed'; end if;
    max_days_snapshot := z.max_days;
  elsif coalesce((p->>'delivery_fee')::bigint,0) <> 0 then raise exception 'shipping_quote_changed';
  end if;
  if coalesce((p->>'ship_ready_first_fee')::bigint,0) <> (case when coalesce((p->>'ship_ready_first')::boolean,false) then coalesce(z.fee_kobo,0) else 0 end) then raise exception 'shipping_quote_changed'; end if;
  if (p->>'total')::bigint is distinct from greatest(0, (p->>'subtotal')::bigint - (p->>'discount')::bigint + (p->>'delivery_fee')::bigint + (p->>'gift_wrap')::bigint + (p->>'surprise_note_fee')::bigint + (p->>'express_fee')::bigint + (p->>'ship_ready_first_fee')::bigint - (p->>'credit_used')::bigint - (p->>'gift_card_used')::bigint) then raise exception 'invalid_total'; end if;

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
      payment_reference, expires_at, reservations, shipping_estimate_days, shipping_snapshot)
  values ((p->>'profile_id')::uuid, p->>'contact_email', p->>'contact_phone', 'pending_payment',
      coalesce((p->>'has_custom')::boolean,false), coalesce((p->>'has_bundle')::boolean,false),
      (p->>'subtotal')::bigint, (p->>'discount')::bigint, (p->>'delivery_fee')::bigint, (p->>'gift_wrap')::bigint,
      (p->>'surprise_note_fee')::bigint, (p->>'express_fee')::bigint, (p->>'ship_ready_first_fee')::bigint,
      (p->>'credit_used')::bigint, (p->>'gift_card_used')::bigint, (p->>'total')::bigint,
      p->'address', (p->>'delivery_zone_id')::uuid, p->>'delivery_zone_name', coalesce((p->>'is_gift')::boolean,false), p->>'gift_message',
      coalesce((p->>'ship_ready_first')::boolean,false), coalesce((p->>'express')::boolean,false), coalesce((p->>'surprise_note')::boolean,false),
      (p->>'discount_code_id')::uuid, p->>'discount_code', p->>'ambassador_code', (p->>'gift_card_id')::uuid,
      p->>'payment_reference', coalesce((p->>'expires_at')::timestamptz, now() + interval '24 hours'), res, max_days_snapshot, jsonb_build_object('origin',cfg.dispatch_origin,'provider',z.provider,'service',z.service,'min_days',z.min_days,'max_days',z.max_days,'threshold_kobo',cfg.free_shipping_threshold_kobo))
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
  lead := case when o.shipping_snapshot is not null then o.shipping_estimate_days else z.lead_days end;
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
      case new_status when 'approved' then 'Design approved. Production can now begin.' when 'proof_sent' then 'Your design proof is ready' when 'revision_requested' then 'Revision requested' else null end);
  end if;
  -- The 5-day clock starts only when EVERY custom design in the order is approved.
  if new_status = 'approved' and o.production_start_at is null then
    select * into z from public.delivery_zones where id = o.delivery_zone_id;
    update public.orders set production_start_at = now(), promised_by = now() + make_interval(days => case when o.shipping_snapshot is not null then o.shipping_estimate_days else z.lead_days end) where id = p_order;
  end if;
  return new_status;
end $$;

-- Website publishing: content only, with optimistic locking. Existing settings RLS remains in force.
alter table public.settings
  add column website_content jsonb not null default '{}'::jsonb check (jsonb_typeof(website_content) = 'object'),
  add column website_revision integer not null default 0 check (website_revision >= 0);
create or replace function public.admin_website_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $website$
declare version integer;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if p->'content' is null or jsonb_typeof(p->'content') <> 'object' or length((p->'content')::text) > 200000 then raise exception 'invalid_website_content'; end if;
  update public.settings set website_content = p->'content', website_revision = website_revision + 1
    where id and website_revision = (p->>'revision')::integer returning website_revision into version;
  if version is null then raise exception 'website_conflict'; end if;
  return jsonb_build_object('revision', version);
end $website$;
revoke all on function public.admin_website_save(jsonb) from public, anon, authenticated;
grant execute on function public.admin_website_save(jsonb) to service_role;

commit;
