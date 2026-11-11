-- Pemart 0012: admin. Every function takes ONE jsonb argument containing `actor` (the signed-in profile id,
-- verified by the app) and re-checks that profile's role INSIDE the database, on top of the page and server-action
-- gates in the app and the RLS policies on the tables. Service role only.

alter table public.order_items drop constraint if exists order_items_kind_check;
alter table public.order_items add constraint order_items_kind_check check (kind in ('variant','bundle','gift_card','custom','revision','bulk'));

create or replace function public._require(actor uuid, roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if actor is null or not (coalesce((select role from public.profiles where id = actor), 'none') = any(roles)) then
    raise exception 'forbidden';
  end if;
end $$;

-- Generic, whitelisted row saver. Only columns in `allowed` AND present in the JSON are written, so absent keys
-- keep their defaults (insert) or their current values (update).
create or replace function public._save_row(tbl text, p jsonb, allowed text[]) returns uuid
language plpgsql set search_path = public as $$
declare cols text[]; cl text; sl text; rid uuid := nullif(p->>'id','')::uuid; res uuid;
begin
  select coalesce(array_agg(k), '{}') into cols from jsonb_object_keys(p) k where k = any(allowed);
  if coalesce(array_length(cols,1), 0) = 0 then raise exception 'nothing_to_save'; end if;
  select string_agg(quote_ident(c), ', ') into cl from unnest(cols) c;
  if rid is null then
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id', tbl, cl, cl, tbl) into res using p;
  else
    select string_agg(format('%I = r.%I', c, c), ', ') into sl from unnest(cols) c;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 returning t.id', tbl, sl, tbl) into res using p, rid;
    if res is null then raise exception 'not_found'; end if;
  end if;
  return res;
end $$;

-- ------------------------------------------------------------ public catalogue as one document (dev mode + fixture export)
create or replace function public.catalogue_export(p jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'collections', (select coalesce(jsonb_agg(to_jsonb(c) - 'search' order by c.sort_order), '[]') from public.collections c where c.is_active),
    'designs', (select coalesce(jsonb_agg(to_jsonb(d) order by d.name), '[]') from public.designs d where d.is_active),
    'products', (select coalesce(jsonb_agg((to_jsonb(p) - 'search') || jsonb_build_object(
        'product_variants', (select coalesce(jsonb_agg(to_jsonb(v) - 'image_ids' order by v.sku), '[]') from public.product_variants v where v.product_id = p.id and v.is_active),
        'product_images', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]') from public.product_images i where i.product_id = p.id)) order by p.name), '[]')
      from public.products p where p.is_active),
    'bundles', (select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object('bundle_slots', (select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order), '[]') from public.bundle_slots s where s.bundle_id = b.id)) order by b.sort_order), '[]')
      from public.bundles b where b.is_active),
    'zones', (select coalesce(jsonb_agg(to_jsonb(z) order by z.sort_order), '[]') from public.delivery_zones z))
$$;
create or replace function public.settings_public(p jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'id' from public.settings s limit 1
$$;

-- ------------------------------------------------------------ overview
create or replace function public.admin_overview(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; is_admin boolean; today date := (now() at time zone 'Africa/Lagos')::date; wk date := date_trunc('week', now() at time zone 'Africa/Lagos')::date;
  rev jsonb := null; week_orders int; week_rev bigint; created int; paid_created int;
begin
  perform public._require(actor, array['staff','admin']);
  is_admin := public._require_is_admin(actor);
  if is_admin then
    select count(*), coalesce(sum(total_kobo),0) into week_orders, week_rev from public.orders
      where paid_at is not null and status not in ('cancelled','refunded') and (paid_at at time zone 'Africa/Lagos')::date >= wk;
    select count(*), count(*) filter (where paid_at is not null) into created, paid_created from public.orders where created_at >= now() - interval '7 days';
    rev := jsonb_build_object(
      'today_orders', (select count(*) from public.orders where paid_at is not null and status not in ('cancelled','refunded') and (paid_at at time zone 'Africa/Lagos')::date = today),
      'today_revenue', (select coalesce(sum(total_kobo),0) from public.orders where paid_at is not null and status not in ('cancelled','refunded') and (paid_at at time zone 'Africa/Lagos')::date = today),
      'week_orders', week_orders, 'week_revenue', week_rev,
      'aov', case when week_orders > 0 then round(week_rev::numeric / week_orders)::bigint else 0 end,
      'bundle_share', case when week_orders > 0 then (select round(100.0 * count(*) filter (where has_bundle) / count(*)) from public.orders where paid_at is not null and status not in ('cancelled','refunded') and (paid_at at time zone 'Africa/Lagos')::date >= wk) else 0 end,
      'conversion', case when created > 0 then round(100.0 * paid_created / created) else 0 end, 'checkouts_started', created, 'checkouts_paid', paid_created);
  end if;
  return jsonb_build_object(
    'revenue', rev,
    'due_48h', (select count(*) from public.orders where promised_by between now() and now() + interval '48 hours' and status in ('paid','approved','in_production','quality_check','packed','reprint','out_for_delivery')),
    'at_risk', (select coalesce(jsonb_agg(x), '[]') from (select number, status, promised_by, contact_email, address->>'recipient' as recipient from public.orders
        where promised_by <= now() + interval '24 hours' and status in ('paid','approved','in_production','quality_check','reprint') order by promised_by limit 12) x),
    'proofs_waiting', (select count(*) from public.custom_requests where status in ('awaiting_proof','revision_requested')),
    'proofs_overdue', (select count(*) from public.custom_requests c join public.order_items i on i.custom_request_id = c.id and i.kind = 'custom' join public.orders o on o.id = i.order_id
        where c.status in ('awaiting_proof','revision_requested') and o.paid_at is not null
          and now() > coalesce((select (c.feedback->-1->>'at')::timestamptz where c.status = 'revision_requested'), o.paid_at) + make_interval(hours => case c.tier when 'personalise' then 12 when 'text_design' then 24 else 48 end)),
    'low_stock', (select coalesce(jsonb_agg(x), '[]') from (select v.id, p.name as product, v.sku, v.colour, v.size, v.option, v.stock_qty - v.reserved_qty as available
        from public.product_variants v join public.products p on p.id = v.product_id where v.stock_qty is not null and v.is_active and p.is_active and v.stock_qty - v.reserved_qty <= 5
        order by v.stock_qty - v.reserved_qty, p.name limit 12) x),
    'new_quotes', (select count(*) from public.bulk_quotes where status = 'new'),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'refunds_needed', (select count(*) from public.orders where payment_note ilike '%refund needed%' and status not in ('refunded')));
end $$;

create or replace function public._require_is_admin(actor uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = actor), false)
$$;

-- ------------------------------------------------------------ orders
create or replace function public.admin_orders_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; q text := nullif(btrim(p->>'q'), ''); digits text; pg int := greatest(1, coalesce((p->>'page')::int, 1)); per int := least(100, greatest(1, coalesce((p->>'per_page')::int, 25)));
  statuses text[] := coalesce(array(select jsonb_array_elements_text(p->'status')), '{}'); total int; rows jsonb;
begin
  perform public._require(actor, array['staff','admin']);
  digits := right(regexp_replace(coalesce(q,''), '\D', '', 'g'), 10);
  with f as (
    select o.* from public.orders o
     where (q is null or o.number ilike '%' || q || '%' or lower(o.contact_email) like '%' || lower(q) || '%' or lower(o.address->>'recipient') like '%' || lower(q) || '%'
            or (length(digits) >= 6 and regexp_replace(o.contact_phone, '\D', '', 'g') like '%' || digits || '%'))
       and (cardinality(statuses) = 0 or o.status = any(statuses))
       and (nullif(p->>'zone','') is null or o.delivery_zone_name = p->>'zone')
       and (p->>'custom' is null or p->>'custom' = '' or o.has_custom = (p->>'custom')::boolean)
       and (nullif(p->>'promised_from','') is null or o.promised_by >= (p->>'promised_from')::date)
       and (nullif(p->>'promised_to','') is null or o.promised_by < (p->>'promised_to')::date + 1)
       and (coalesce((p->>'include_unpaid')::boolean, false) or o.status <> 'pending_payment' or cardinality(statuses) > 0))
  select (select count(*) from f),
         (select coalesce(jsonb_agg(r order by (r->>'created_at') desc), '[]') from (
            select jsonb_build_object('id', f.id, 'number', f.number, 'status', f.status, 'created_at', f.created_at, 'paid_at', f.paid_at, 'promised_by', f.promised_by,
              'total_kobo', f.total_kobo, 'email', f.contact_email, 'phone', f.contact_phone, 'recipient', f.address->>'recipient', 'zone', f.delivery_zone_name,
              'has_custom', f.has_custom, 'has_bundle', f.has_bundle, 'express', f.express,
              'at_risk', f.promised_by <= now() + interval '24 hours' and f.status in ('paid','approved','in_production','quality_check','reprint'),
              'items', (select coalesce(jsonb_agg(i.name order by i.created_at), '[]') from public.order_items i where i.order_id = f.id)) r
            from f order by f.created_at desc limit per offset (pg - 1) * per) s)
    into total, rows;
  return jsonb_build_object('total', total, 'page', pg, 'per_page', per, 'rows', rows);
end $$;

create or replace function public.admin_order_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; o public.orders;
begin
  perform public._require(actor, array['staff','admin']);
  select * into o from public.orders where number = upper(p->>'number');
  if not found then return null; end if;
  return to_jsonb(o) - 'reservations' || jsonb_build_object(
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]') from public.order_items i where i.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'created_at', e.created_at, 'actor', (select coalesce(full_name, email) from public.profiles where id = e.actor)) order by e.created_at), '[]') from public.order_events e where e.order_id = o.id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('reference', pay.reference, 'amount_kobo', pay.amount_kobo, 'status', pay.status, 'verified_at', pay.verified_at, 'created_at', pay.created_at) order by pay.created_at), '[]') from public.payments pay where pay.order_id = o.id),
    'custom_requests', (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('design_slug', (select d.slug from public.designs d where d.id = c.design_id), 'item_id', i.id) order by c.created_at), '[]')
        from public.custom_requests c join public.order_items i on i.custom_request_id = c.id and i.kind = 'custom' where i.order_id = o.id),
    'commission', (select to_jsonb(cm) from public.commissions cm where cm.order_id = o.id),
    'customer', (select jsonb_build_object('id', pr.id, 'name', pr.full_name, 'store_credit_kobo', pr.store_credit_kobo) from public.profiles pr where pr.id = o.profile_id));
end $$;

create or replace function public.admin_order_note(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  update public.orders set notes = left(p->>'notes', 4000) where id = (p->>'order_id')::uuid;
  insert into public.order_events (order_id, status, note, actor) select id, status, 'Internal note updated', (p->>'actor')::uuid from public.orders where id = (p->>'order_id')::uuid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return public.order_set_status(p);
end $$;

create or replace function public.admin_proof_send(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return public.proof_send(p);
end $$;

create or replace function public.admin_review_moderate(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return public.review_moderate(p);
end $$;

-- ------------------------------------------------------------ production board and proofs queue
create or replace function public.admin_board(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status, 'promised_by', o.promised_by, 'recipient', o.address->>'recipient', 'phone', o.contact_phone,
      'has_custom', o.has_custom, 'express', o.express, 'delivered_at', o.delivered_at,
      'due_soon', o.promised_by <= now() + interval '24 hours' and o.status not in ('out_for_delivery','delivered'),
      'items', (select coalesce(jsonb_agg(i.name order by i.created_at), '[]') from public.order_items i where i.order_id = o.id)) order by o.promised_by nulls last), '[]')
    from public.orders o
    where o.status in ('paid','approved','in_production','reprint','quality_check','packed','out_for_delivery')
       or (o.status = 'delivered' and o.delivered_at >= now() - interval '7 days'));
end $$;

create or replace function public.admin_proofs_queue(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return (select coalesce(jsonb_agg(r order by (r->>'overdue') desc, (r->>'waiting_since') asc), '[]') from (
    select jsonb_build_object(
      'id', c.id, 'order_number', o.number, 'order_id', o.id, 'tier', c.tier, 'product_type', c.product_type, 'colour', c.colour, 'status', c.status,
      'text_fields', c.text_fields, 'type_style', c.type_style, 'notes', c.notes, 'upload_paths', c.upload_paths, 'print_positions', c.print_positions,
      'design_slug', (select d.slug from public.designs d where d.id = c.design_id), 'proofs', c.proofs, 'feedback', c.feedback, 'revisions_used', c.revisions_used,
      'paid_at', o.paid_at, 'email', o.contact_email, 'phone', o.contact_phone, 'recipient', o.address->>'recipient',
      'waiting_since', case when c.status = 'revision_requested' then coalesce((c.feedback->-1->>'at')::timestamptz, o.paid_at) else o.paid_at end,
      'promise_hours', case c.tier when 'personalise' then 12 when 'text_design' then 24 else 48 end,
      'overdue', c.status in ('awaiting_proof','revision_requested') and now() > case when c.status = 'revision_requested' then coalesce((c.feedback->-1->>'at')::timestamptz, o.paid_at) else o.paid_at end
                 + make_interval(hours => case c.tier when 'personalise' then 12 when 'text_design' then 24 else 48 end)) r
    from public.custom_requests c join public.order_items i on i.custom_request_id = c.id and i.kind = 'custom' join public.orders o on o.id = i.order_id
    where c.status in ('awaiting_proof','revision_requested','proof_sent') and o.status not in ('cancelled','refunded') and o.paid_at is not null) s);
end $$;

-- ------------------------------------------------------------ bulk quotes
create or replace function public.admin_quotes_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return (select coalesce(jsonb_agg(to_jsonb(q) || jsonb_build_object('order_number', (select number from public.orders where id = q.order_id)) order by q.created_at desc), '[]') from public.bulk_quotes q);
end $$;

create or replace function public.admin_quote_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  if p->>'status' not in ('new','quoted','won','lost') then raise exception 'bad_status'; end if;
  update public.bulk_quotes set status = p->>'status', quoted_amount_kobo = coalesce((p->>'quoted_amount_kobo')::bigint, quoted_amount_kobo) where id = (p->>'id')::uuid;
  return jsonb_build_object('ok', true);
end $$;

-- A won quote becomes an UNPAID order the customer pays through their private link (valid 7 days).
create or replace function public.admin_quote_to_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.bulk_quotes; oid uuid; onum text; tok text; zid uuid; zname text; amt bigint;
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  select * into q from public.bulk_quotes where id = (p->>'id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if q.order_id is not null then return jsonb_build_object('ok', false, 'error', 'already_converted'); end if;
  amt := coalesce(q.quoted_amount_kobo, 0);
  if amt <= 0 then return jsonb_build_object('ok', false, 'error', 'no_quoted_amount'); end if;
  select id, name into zid, zname from public.delivery_zones where (p->'address'->>'state') = any(states) limit 1;
  insert into public.orders (contact_email, contact_phone, status, subtotal_kobo, total_kobo, address, delivery_zone_id, delivery_zone_name, notes, expires_at)
  values (q.email, q.phone, 'pending_payment', amt, amt, p->'address', zid, zname, 'Bulk quote ' || upper(left(q.id::text, 8)) || coalesce(' / ' || q.organisation, ''), now() + interval '7 days')
  returning id, number, public_token into oid, onum, tok;
  insert into public.order_items (order_id, kind, name, options, unit_price_kobo, quantity)
  values (oid, 'bulk', 'Bulk order: ' || q.quantity || ' x ' || q.product_type, jsonb_build_object('quantity', q.quantity, 'sizes', q.sizes, 'organisation', q.organisation, 'idea', q.idea), amt, 1);
  insert into public.order_events (order_id, status, note, actor) values (oid, 'pending_payment', 'Created from bulk quote', (p->>'actor')::uuid);
  update public.bulk_quotes set status = 'won', order_id = oid where id = q.id;
  return jsonb_build_object('ok', true, 'order_id', oid, 'number', onum, 'token', tok, 'email', q.email, 'total', amt, 'name', q.name);
end $$;

-- ------------------------------------------------------------ reviews and customers
create or replace function public.admin_reviews_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'rating', r.rating, 'text', r.text, 'display_name', r.display_name, 'photo_urls', r.photo_urls, 'created_at', r.created_at,
      'credit_issued', r.credit_issued, 'credit_pending', r.credit_pending, 'product', pr.name, 'order_number', (select o.number from public.order_items i join public.orders o on o.id = i.order_id where i.id = r.order_item_id)) order by r.created_at desc), '[]')
    from public.reviews r join public.products pr on pr.id = r.product_id where (nullif(p->>'status','') is null or r.status = p->>'status'));
end $$;

create or replace function public.admin_customers_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q text := nullif(btrim(p->>'q'), ''); pg int := greatest(1, coalesce((p->>'page')::int, 1)); per int := least(5000, greatest(1, coalesce((p->>'per_page')::int, 25))); total int; rows jsonb;
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  with c as (
    select lower(o.contact_email) as email, (array_agg(o.address->>'recipient' order by o.created_at desc))[1] as name, (array_agg(o.contact_phone order by o.created_at desc))[1] as phone,
           count(*) as orders, coalesce(sum(o.total_kobo), 0) as spend, max(o.paid_at) as last_order
      from public.orders o where o.paid_at is not null and o.status not in ('cancelled','refunded') group by lower(o.contact_email))
  select (select count(*) from c where q is null or c.email like '%' || lower(q) || '%' or lower(coalesce(c.name,'')) like '%' || lower(q) || '%'),
         (select coalesce(jsonb_agg(x), '[]') from (
            select c.email, c.name, c.phone, c.orders, c.spend, c.last_order, coalesce((select store_credit_kobo from public.profiles where lower(email) = c.email), 0) as store_credit_kobo,
                   exists (select 1 from public.profiles where lower(email) = c.email) as has_account
              from c where q is null or c.email like '%' || lower(q) || '%' or lower(coalesce(c.name,'')) like '%' || lower(q) || '%'
              order by c.last_order desc nulls last limit per offset (pg - 1) * per) x)
    into total, rows;
  return jsonb_build_object('total', total, 'page', pg, 'per_page', per, 'rows', rows);
end $$;

-- ------------------------------------------------------------ reports (admin)
create or replace function public.admin_reports(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d1 date := (p->>'from')::date; d2 date := (p->>'to')::date; res jsonb;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  create temporary table if not exists _rep_orders (id uuid, total bigint, zone text, amb text, created date) on commit drop;
  truncate _rep_orders;
  insert into _rep_orders select id, total_kobo, coalesce(delivery_zone_name, 'Digital'), ambassador_code, (paid_at at time zone 'Africa/Lagos')::date
    from public.orders where paid_at is not null and status not in ('cancelled','refunded','pending_payment') and (paid_at at time zone 'Africa/Lagos')::date between d1 and d2;
  res := jsonb_build_object(
    'totals', (select jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total),0), 'aov', case when count(*) > 0 then round(sum(total)::numeric / count(*))::bigint else 0 end) from _rep_orders),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('date', g.d, 'orders', coalesce(s.n,0), 'revenue', coalesce(s.rev,0)) order by g.d), '[]')
        from generate_series(d1, d2, interval '1 day') g(d) left join (select created, count(*) n, sum(total) rev from _rep_orders group by created) s on s.created = g.d::date),
    'designs', (select coalesce(jsonb_agg(x order by (x->>'revenue')::bigint desc), '[]') from (
        select jsonb_build_object('name', coalesce(d.name, 'Custom / other'), 'qty', sum(i.quantity), 'revenue', sum(i.unit_price_kobo * i.quantity)) x
          from public.order_items i join _rep_orders o on o.id = i.order_id left join public.product_variants v on v.id = i.variant_id left join public.products pr on pr.id = v.product_id left join public.designs d on d.id = pr.design_id
         where i.kind in ('variant','custom') group by coalesce(d.name, 'Custom / other') limit 20) t),
    'products', (select coalesce(jsonb_agg(x order by (x->>'revenue')::bigint desc), '[]') from (
        select jsonb_build_object('name', pr.name, 'qty', sum(i.quantity), 'revenue', sum(i.unit_price_kobo * i.quantity)) x
          from public.order_items i join _rep_orders o on o.id = i.order_id join public.product_variants v on v.id = i.variant_id join public.products pr on pr.id = v.product_id where i.kind = 'variant' group by pr.name limit 20) t),
    'bundles', (select coalesce(jsonb_agg(x order by (x->>'revenue')::bigint desc), '[]') from (
        select jsonb_build_object('name', i.name, 'qty', sum(i.quantity), 'revenue', sum(i.unit_price_kobo * i.quantity)) x
          from public.order_items i join _rep_orders o on o.id = i.order_id where i.kind = 'bundle' group by i.name) t),
    'collections', (select coalesce(jsonb_agg(x order by (x->>'revenue')::bigint desc), '[]') from (
        select jsonb_build_object('name', coalesce(c.name, 'No collection'), 'qty', sum(i.quantity), 'revenue', sum(i.unit_price_kobo * i.quantity)) x
          from public.order_items i join _rep_orders o on o.id = i.order_id join public.product_variants v on v.id = i.variant_id join public.products pr on pr.id = v.product_id left join public.collections c on c.id = pr.collection_id
         where i.kind = 'variant' group by coalesce(c.name, 'No collection')) t),
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('name', zone, 'orders', n, 'revenue', rev) order by rev desc), '[]') from (select zone, count(*) n, sum(total) rev from _rep_orders group by zone) z),
    'ambassadors', (select coalesce(jsonb_agg(x order by (x->>'revenue')::bigint desc), '[]') from (
        select jsonb_build_object('code', o.amb, 'orders', count(*), 'revenue', sum(o.total), 'commission', coalesce(sum((select cm.amount_kobo from public.commissions cm where cm.order_id = o.id)), 0)) x
          from _rep_orders o where o.amb is not null group by o.amb) t));
  return res;
end $$;

-- ------------------------------------------------------------ catalogue (admin)
create or replace function public.admin_catalogue_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'collections', (select coalesce(jsonb_agg(to_jsonb(c) - 'search' order by c.sort_order), '[]') from public.collections c),
    'designs', (select coalesce(jsonb_agg(to_jsonb(d) order by d.name), '[]') from public.designs d),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'slug', pr.slug, 'name', pr.name, 'type', pr.type, 'is_active', pr.is_active, 'base_price_kobo', pr.base_price_kobo,
        'variants', (select count(*) from public.product_variants v where v.product_id = pr.id), 'images', (select count(*) from public.product_images i where i.product_id = pr.id)) order by pr.name), '[]') from public.products pr),
    'bundles', (select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object('slots', (select count(*) from public.bundle_slots s where s.bundle_id = b.id)) order by b.sort_order), '[]') from public.bundles b));
end $$;

create or replace function public.admin_product_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.products;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into pr from public.products where id = (p->>'id')::uuid;
  if not found then return null; end if;
  return (to_jsonb(pr) - 'search') || jsonb_build_object(
    'variants', (select coalesce(jsonb_agg(to_jsonb(v) order by v.colour, v.size, v.option), '[]') from public.product_variants v where v.product_id = pr.id),
    'images', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]') from public.product_images i where i.product_id = pr.id));
end $$;

create or replace function public.admin_bundle_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bundles;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into b from public.bundles where id = (p->>'id')::uuid;
  if not found then return null; end if;
  return to_jsonb(b) || jsonb_build_object('slots', (select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order), '[]') from public.bundle_slots s where s.bundle_id = b.id));
end $$;

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

create or replace function public.admin_bundle_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bid uuid; s jsonb; i int := 0;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  bid := public._save_row('bundles', p->'bundle', array['slug','name','kind','description','price_kobo','available_from','available_until','image','badge','sort_order','is_active']);
  if p ? 'slots' then
    delete from public.bundle_slots where bundle_id = bid;
    for s in select * from jsonb_array_elements(p->'slots') loop
      i := i + 1;
      perform public._save_row('bundle_slots', (s - 'id') || jsonb_build_object('bundle_id', bid, 'sort_order', i),
        array['bundle_id','label','product_type','allowed_collection_id','allowed_design_ids','allowed_product_id','option_group','quantity','requires_size','requires_colour','requires_option','option_label','requires_custom_text','matching_group','sort_order']);
    end loop;
  end if;
  return jsonb_build_object('id', bid);
end $$;

create or replace function public.admin_images_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := (p->>'product_id')::uuid; im jsonb; i int := 0; keep uuid[] := '{}'; rid uuid;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  for im in select * from jsonb_array_elements(p->'images') loop
    rid := public._save_row('product_images', im || jsonb_build_object('product_id', pid, 'sort_order', i), array['product_id','url','alt','view','sort_order']);
    keep := keep || rid; i := i + 1;
  end loop;
  delete from public.product_images where product_id = pid and not (id = any(keep));
  return jsonb_build_object('ok', true, 'count', i);
end $$;

create or replace function public.admin_variants_generate(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.products; cols text[]; szs text[]; opts text[]; c text; s text; o text; n int := 0; made int;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into pr from public.products where id = (p->>'product_id')::uuid;
  if not found then raise exception 'not_found'; end if;
  cols := coalesce(nullif(array(select jsonb_array_elements_text(p->'colours')), '{}'), array[null]::text[]);
  szs  := coalesce(nullif(array(select jsonb_array_elements_text(p->'sizes')), '{}'), array[null]::text[]);
  opts := coalesce(nullif(array(select jsonb_array_elements_text(p->'options')), '{}'), array[null]::text[]);
  foreach c in array cols loop foreach s in array szs loop foreach o in array opts loop
    insert into public.product_variants (product_id, sku, colour, size, option, stock_qty)
    values (pr.id, upper(regexp_replace(pr.slug || coalesce('-' || c, '') || coalesce('-' || s, '') || coalesce('-' || o, ''), '[^A-Za-z0-9]+', '-', 'g')), c, s, o, nullif(p->>'stock_qty', '')::int)
    on conflict (sku) do nothing;
    get diagnostics made = row_count; n := n + made;
  end loop; end loop; end loop;
  return jsonb_build_object('ok', true, 'created', n);
end $$;

create or replace function public.admin_inventory_adjust(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.product_variants; d int := (p->>'delta')::int;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if length(btrim(coalesce(p->>'reason', ''))) < 3 then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  if d = 0 then return jsonb_build_object('ok', false, 'error', 'zero'); end if;
  select * into v from public.product_variants where id = (p->>'variant_id')::uuid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v.stock_qty is null then return jsonb_build_object('ok', false, 'error', 'made_to_order'); end if;
  if v.stock_qty + d < 0 then return jsonb_build_object('ok', false, 'error', 'below_zero'); end if;
  update public.product_variants set stock_qty = stock_qty + d where id = v.id;
  insert into public.inventory_adjustments (variant_id, delta, reason, actor) values (v.id, d, left(p->>'reason', 200), (p->>'actor')::uuid);
  return jsonb_build_object('ok', true, 'stock_qty', v.stock_qty + d);
end $$;

create or replace function public.admin_inventory_log(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['staff','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('delta', a.delta, 'reason', a.reason, 'created_at', a.created_at, 'actor', (select coalesce(full_name, email) from public.profiles where id = a.actor), 'sku', v.sku) order by a.created_at desc), '[]')
    from public.inventory_adjustments a join public.product_variants v on v.id = a.variant_id where (nullif(p->>'variant_id','') is null or a.variant_id = (p->>'variant_id')::uuid) limit 100);
end $$;

-- ------------------------------------------------------------ discounts and ambassadors (admin)
create or replace function public.admin_discounts_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'codes', (select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object('ambassador', (select name from public.ambassadors a where a.id = d.ambassador_id)) order by d.created_at desc), '[]') from public.discount_codes d),
    'ambassadors', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code, 'phone', a.phone, 'email', a.email, 'commission_rate', a.commission_rate, 'is_active', a.is_active, 'payout_note', a.payout_note,
        'orders', (select count(*) from public.commissions c join public.orders o on o.id = c.order_id where c.ambassador_id = a.id and o.status not in ('cancelled','refunded')),
        'sales_kobo', coalesce((select sum(o.subtotal_kobo) from public.commissions c join public.orders o on o.id = c.order_id where c.ambassador_id = a.id and o.status not in ('cancelled','refunded')), 0),
        'owed_kobo', coalesce((select sum(c.amount_kobo) from public.commissions c join public.orders o on o.id = c.order_id where c.ambassador_id = a.id and c.status in ('pending','approved') and o.status not in ('cancelled','refunded')), 0),
        'paid_kobo', coalesce((select sum(c.amount_kobo) from public.commissions c where c.ambassador_id = a.id and c.status = 'paid'), 0)) order by a.name), '[]') from public.ambassadors a));
end $$;

create or replace function public.admin_ambassador_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare aid uuid; v_code text := upper(regexp_replace(coalesce(p->>'code', ''), '[^A-Za-z0-9]', '', 'g'));
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if length(v_code) < 4 then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if exists (select 1 from public.discount_codes d where upper(d.code) = v_code) or exists (select 1 from public.ambassadors a where upper(a.code) = v_code) then
    return jsonb_build_object('ok', false, 'error', 'code_taken'); end if;
  insert into public.ambassadors (name, phone, email, code, commission_rate, payout_note)
  values (left(p->>'name', 80), p->>'phone', p->>'email', v_code, coalesce((p->>'commission_rate')::numeric, 0.10), left(p->>'payout_note', 200)) returning id into aid;
  insert into public.discount_codes (code, type, value, ambassador_id) values (v_code, 'percentage', 10, aid);   -- buyers get 10% off
  return jsonb_build_object('ok', true, 'id', aid, 'code', v_code);
end $$;

create or replace function public.admin_commissions_pay(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare amt bigint;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select coalesce(sum(c.amount_kobo), 0) into amt from public.commissions c join public.orders o on o.id = c.order_id
   where c.ambassador_id = (p->>'ambassador_id')::uuid and c.status in ('pending','approved') and o.status not in ('cancelled','refunded');
  update public.commissions c set status = 'paid', paid_at = now() from public.orders o
   where o.id = c.order_id and c.ambassador_id = (p->>'ambassador_id')::uuid and c.status in ('pending','approved') and o.status not in ('cancelled','refunded');
  return jsonb_build_object('ok', true, 'paid_kobo', amt);
end $$;

-- ------------------------------------------------------------ settings (admin)
create or replace function public.admin_settings_get(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object('settings', (select to_jsonb(s) - 'id' from public.settings s limit 1),
    'zones', (select coalesce(jsonb_agg(to_jsonb(z) order by z.sort_order), '[]') from public.delivery_zones z),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]') from public.products where is_active and type not in ('gift_card')));
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

do $$
declare f text;
begin
  foreach f in array array[
    '_require(uuid,text[])','_require_is_admin(uuid)','_save_row(text,jsonb,text[])','catalogue_export(jsonb)','settings_public(jsonb)',
    'admin_overview(jsonb)','admin_orders_list(jsonb)','admin_order_get(jsonb)','admin_order_note(jsonb)','admin_set_status(jsonb)','admin_proof_send(jsonb)','admin_review_moderate(jsonb)',
    'admin_board(jsonb)','admin_proofs_queue(jsonb)','admin_quotes_list(jsonb)','admin_quote_update(jsonb)','admin_quote_to_order(jsonb)','admin_reviews_list(jsonb)','admin_customers_list(jsonb)',
    'admin_reports(jsonb)','admin_catalogue_list(jsonb)','admin_product_get(jsonb)','admin_bundle_get(jsonb)','admin_save(jsonb)','admin_bundle_save(jsonb)','admin_images_save(jsonb)',
    'admin_variants_generate(jsonb)','admin_inventory_adjust(jsonb)','admin_inventory_log(jsonb)','admin_discounts_list(jsonb)','admin_ambassador_create(jsonb)','admin_commissions_pay(jsonb)',
    'admin_settings_get(jsonb)','admin_settings_save(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
