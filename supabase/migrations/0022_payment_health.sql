-- 0022: Paystack status page support. Records that webhooks arrived (event name, reference, accepted or
-- rejected; never the card or customer details) and summarises recent payments for admins.
-- Rollback: supabase/rollback/0022_payment_health.sql

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('webhook_received', 'webhook_rejected', 'settle_error')),
  event text,
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_created_idx on public.payment_events(created_at desc);
alter table public.payment_events enable row level security;  -- service role only
revoke all on public.payment_events from anon, authenticated;

create or replace function public.payment_event_log(p jsonb) returns void
language sql security definer set search_path = public as $$
  with del as (delete from public.payment_events where created_at < now() - interval '90 days')
  insert into public.payment_events (kind, event, reference) values (p->>'kind', left(p->>'event', 60), left(p->>'reference', 100))
$$;

create or replace function public.admin_payments_health(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare since timestamptz := now() - interval '7 days';
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(k, n), '{}') from (select provider || ':' || status k, count(*) n from public.payments where created_at >= since group by 1) x),
    'paid_total_kobo', (select coalesce(sum(amount_kobo), 0) from public.payments where status = 'success' and verified_at >= since),
    'last_success_at', (select max(verified_at) from public.payments where status = 'success'),
    'last_webhook_at', (select max(created_at) from public.payment_events where kind = 'webhook_received'),
    'webhooks_7d', (select count(*) from public.payment_events where kind = 'webhook_received' and created_at >= since),
    'rejected_7d', (select count(*) from public.payment_events where kind = 'webhook_rejected' and created_at >= since),
    'last_rejected_at', (select max(created_at) from public.payment_events where kind = 'webhook_rejected'),
    'settle_errors_7d', (select count(*) from public.payment_events where kind = 'settle_error' and created_at >= since),
    'refunds_needed', (select count(*) from public.orders where payment_note ilike '%refund needed%' and status <> 'refunded'),
    'awaiting_payment', (select count(*) from public.orders where status = 'pending_payment'),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]') from (
      select pay.reference, pay.provider, pay.status, pay.amount_kobo, pay.created_at, pay.verified_at, o.number
      from public.payments pay join public.orders o on o.id = pay.order_id order by pay.created_at desc limit 15) r)
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array['payment_event_log(jsonb)','admin_payments_health(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
