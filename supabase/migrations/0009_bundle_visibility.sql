-- Pemart 0009: show expired bundles to the storefront so pages can explain
-- "this gift box has ended" instead of a bare 404. Availability is enforced in
-- application code (hub, bundle page) and, authoritatively, by the checkout
-- server, which re-validates every bundle before creating an order.
drop policy if exists bundles_read on public.bundles;
drop policy if exists slots_read on public.bundle_slots;

create policy bundles_read on public.bundles for select
  using (is_active or public.is_staff());
create policy slots_read on public.bundle_slots for select
  using (public.is_staff() or exists (
    select 1 from public.bundles b where b.id = bundle_id and b.is_active));
