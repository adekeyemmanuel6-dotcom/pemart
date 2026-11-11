-- Promote yourself after your first sign-in. Run in the Supabase SQL editor
-- (service role context, so the privilege guard allows it). Replace the email.
update public.profiles set role = 'admin' where email = 'adekeyemmanuel6@gmail.com';
select email, role from public.profiles where role <> 'customer';
