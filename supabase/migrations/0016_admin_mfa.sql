-- 0016: staff and admin privileges require a two-factor (aal2) session.
-- Every RLS and storage policy that grants extra access goes through public.is_staff() or public.is_admin(),
-- so redefining those two helpers enforces two-factor at the database as well as in the app: a stolen
-- password or magic link alone (aal1) can no longer read customer orders or edit the catalogue through
-- the public API. Customers' own-data policies are unaffected.
-- Service-role calls have no user JWT and never relied on these helpers; the money-critical RPCs keep
-- checking the actor's role themselves, after the app has verified the session is aal2.
-- Reversible: supabase/rollback/0016_admin_mfa.sql restores the original definitions.

create or replace function public.session_is_aal2()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('staff','admin'), false) and public.session_is_aal2()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false) and public.session_is_aal2()
$$;
