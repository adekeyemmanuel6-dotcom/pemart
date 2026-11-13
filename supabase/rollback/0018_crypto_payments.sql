-- Rollback for 0018_crypto_payments.sql.
-- Unpaid crypto orders keep their rows; after rollback they behave like unpaid Paystack orders (the buyer can
-- pay by card from the order page, or they expire). Paid orders are not affected.
drop function if exists public.admin_crypto_get(jsonb);
drop function if exists public.admin_crypto_confirm(jsonb);
drop function if exists public.checkout_crypto_submit(jsonb);
drop function if exists public.checkout_get_crypto(jsonb);
drop function if exists public.checkout_use_crypto(jsonb);
drop function if exists public.admin_crypto_settings_save(jsonb);
alter table public.orders drop constraint if exists orders_payment_method;
alter table public.orders drop column if exists crypto_payment, drop column if exists payment_method;
alter table public.settings drop constraint if exists settings_crypto_window, drop constraint if exists settings_crypto_wallets_array;
alter table public.settings
  drop column if exists crypto_window_hours, drop column if exists crypto_instructions,
  drop column if exists crypto_wallets, drop column if exists crypto_enabled;
