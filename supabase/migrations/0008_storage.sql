-- Pemart 0008: Storage buckets and policies (skipped cleanly if storage schema is absent)
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found; skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public) values
    ('product-images', 'product-images', true),     -- catalogue photos, public CDN
    ('review-photos',  'review-photos',  true),      -- customer review photos (random paths)
    ('design-uploads', 'design-uploads', false),     -- customer references and sketches
    ('proofs',         'proofs',         false),     -- design proofs sent to customers
    ('print-artwork',  'print-artwork',  false),     -- print-ready files
    ('bulk-uploads',   'bulk-uploads',   false)
  on conflict (id) do nothing;

  execute $p$create policy "public read catalogue images" on storage.objects
    for select using (bucket_id in ('product-images','review-photos'))$p$;
  execute $p$create policy "admin manage catalogue images" on storage.objects
    for all using (bucket_id = 'product-images' and public.is_admin())
    with check (bucket_id = 'product-images' and public.is_admin())$p$;
  -- Signed-in customers upload only into their own folder: <uid>/<file>
  execute $p$create policy "customer upload own design files" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'design-uploads' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "customer read own design files" on storage.objects
    for select to authenticated
    using (bucket_id = 'design-uploads' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "staff read private files" on storage.objects
    for select using (bucket_id in ('design-uploads','proofs','print-artwork','bulk-uploads') and public.is_staff())$p$;
  execute $p$create policy "staff write proofs and artwork" on storage.objects
    for insert with check (bucket_id in ('proofs','print-artwork') and public.is_staff())$p$;
  -- Guest uploads (bulk quotes, guest custom orders) go through server routes
  -- using signed upload URLs created with the service role.
end $$;
