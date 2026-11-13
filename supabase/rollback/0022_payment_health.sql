-- Rollback for 0022_payment_health.sql. Payments and orders are not touched.
drop function if exists public.admin_payments_health(jsonb);
drop function if exists public.payment_event_log(jsonb);
drop table if exists public.payment_events;
