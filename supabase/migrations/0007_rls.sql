-- Pemart 0007: Row Level Security on every table.
-- Server code that must bypass these rules (checkout, webhooks, guest tracking)
-- uses the service role key, which never reaches the browser.

-- Safety net: enable RLS on every table in public, so a table added later
-- without policies is locked by default rather than open.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- public catalogue (read) / admin (write) ----------
create policy zones_read on public.delivery_zones for select using (true);
create policy zones_admin on public.delivery_zones for all
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

create policy collections_read on public.collections for select
  using (is_active or public.is_staff());
create policy collections_admin on public.collections for all
  using (public.is_admin()) with check (public.is_admin());

create policy designs_read on public.designs for select
  using (is_active or public.is_staff());
create policy designs_admin on public.designs for all
  using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select
  using (is_active or public.is_staff());
create policy products_admin on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy variants_read on public.product_variants for select
  using (public.is_staff() or (is_active and exists (
    select 1 from public.products p where p.id = product_id and p.is_active)));
create policy variants_admin on public.product_variants for all
  using (public.is_admin()) with check (public.is_admin());

create policy images_read on public.product_images for select
  using (public.is_staff() or exists (
    select 1 from public.products p where p.id = product_id and p.is_active));
create policy images_admin on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

-- Bundles stay visible only inside their availability window.
create policy bundles_read on public.bundles for select
  using (public.is_staff() or (
    is_active
    and (available_from is null or available_from <= now())
    and (available_until is null or available_until >= now())));
create policy bundles_admin on public.bundles for all
  using (public.is_admin()) with check (public.is_admin());

create policy slots_read on public.bundle_slots for select
  using (public.is_staff() or exists (
    select 1 from public.bundles b where b.id = bundle_id and b.is_active
      and (b.available_from is null or b.available_from <= now())
      and (b.available_until is null or b.available_until >= now())));
create policy slots_admin on public.bundle_slots for all
  using (public.is_admin()) with check (public.is_admin());

create policy inv_adj_staff_read on public.inventory_adjustments for select
  using (public.is_staff());
create policy inv_adj_admin on public.inventory_adjustments for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- customers ----------
create policy addresses_own on public.addresses for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy addresses_staff_read on public.addresses for select
  using (public.is_staff());

create policy wishlist_own on public.wishlist_items for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy carts_own on public.carts for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()));

-- stock_alerts, subscribers, gift_cards: written by server routes only.
create policy stock_alerts_admin on public.stock_alerts for all
  using (public.is_admin()) with check (public.is_admin());
create policy subscribers_admin on public.subscribers for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- admin-only money/marketing tables ----------
create policy ambassadors_admin on public.ambassadors for all
  using (public.is_admin()) with check (public.is_admin());
create policy discount_codes_admin on public.discount_codes for all
  using (public.is_admin()) with check (public.is_admin());
create policy gift_cards_admin on public.gift_cards for all
  using (public.is_admin()) with check (public.is_admin());
create policy commissions_admin on public.commissions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- orders ----------
-- Customers read their own orders. All writes go through server code
-- (service role) or staff. Guest lookups (/track) use the service role.
create policy orders_own_read on public.orders for select
  using (profile_id = auth.uid());
create policy orders_staff_read on public.orders for select
  using (public.is_staff());
create policy orders_staff_update on public.orders for update
  using (public.is_staff()) with check (public.is_staff());

create policy order_items_own_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid()));
create policy order_items_staff_read on public.order_items for select
  using (public.is_staff());
create policy order_items_staff_update on public.order_items for update
  using (public.is_staff()) with check (public.is_staff());

create policy order_events_own_read on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid()));
create policy order_events_staff_read on public.order_events for select
  using (public.is_staff());
create policy order_events_staff_insert on public.order_events for insert
  with check (public.is_staff());

create policy payments_staff_read on public.payments for select
  using (public.is_staff());

-- ---------- custom requests ----------
create policy custom_own_read on public.custom_requests for select
  using (profile_id = auth.uid());
create policy custom_staff_read on public.custom_requests for select
  using (public.is_staff());
create policy custom_staff_update on public.custom_requests for update
  using (public.is_staff()) with check (public.is_staff());

-- ---------- bulk quotes ----------
create policy bulk_staff_read on public.bulk_quotes for select
  using (public.is_staff());
create policy bulk_staff_update on public.bulk_quotes for update
  using (public.is_staff()) with check (public.is_staff());

-- ---------- reviews ----------
create policy reviews_public_read on public.reviews for select
  using (status = 'approved');
create policy reviews_own_read on public.reviews for select
  using (profile_id = auth.uid());
create policy reviews_staff_read on public.reviews for select
  using (public.is_staff());
create policy reviews_own_insert on public.reviews for insert
  with check (
    profile_id = auth.uid() and status = 'pending' and credit_issued = false
    and exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and o.profile_id = auth.uid() and o.status = 'delivered'));
create policy reviews_staff_update on public.reviews for update
  using (public.is_staff()) with check (public.is_staff());
