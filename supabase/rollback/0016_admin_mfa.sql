-- Rollback for 0016: back to role-only checks (as defined in 0002). Run only together with reverting the
-- application, otherwise the app still asks for two-factor while the database no longer does.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('staff','admin'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

drop function if exists public.session_is_aal2();
