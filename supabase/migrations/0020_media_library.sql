-- 0020: media library. One list of every image uploaded for the shop and website, with alt text,
-- search, usage ("where is this image used?") and safe delete (refused while an image is still in use).
-- Images already used by products, collections, gift boxes, designs and the website are added on first run.
-- Rollback: supabase/rollback/0020_media_library.sql

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  path text,
  filename text not null default '',
  alt text not null default '',
  mime text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint media_url_safe check (url ~ '^(/[^/]|https://)' and length(url) <= 1000)
);
create index if not exists media_assets_created_idx on public.media_assets(created_at desc);
alter table public.media_assets enable row level security;  -- service role only (admin functions below)
revoke all on public.media_assets from anon, authenticated;

-- Backfill from what the store already uses.
insert into public.media_assets (url, filename, alt)
select distinct on (url) url, regexp_replace(url, '^.*/', ''), alt from (
  select url, alt from public.product_images
  union all select hero_image, name from public.collections where hero_image is not null
  union all select image, name from public.bundles where image is not null
  union all select preview_image, name from public.designs where preview_image is not null
) x
where url is not null and url <> '' and url !~ '^/placeholders/' and url ~ '^(/[^/]|https://)'
on conflict (url) do nothing;

-- Where an image is used (product photos, collections, gift boxes, designs, website content).
create or replace function public._media_usage(u text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('type', 'product', 'label', p.name, 'href', '/admin/catalogue/products/' || p.id) x
      from public.product_images i join public.products p on p.id = i.product_id where i.url = u
    union all select jsonb_build_object('type', 'collection', 'label', c.name, 'href', '/admin/catalogue') from public.collections c where c.hero_image = u
    union all select jsonb_build_object('type', 'gift box', 'label', b.name, 'href', '/admin/catalogue/bundles/' || b.id) from public.bundles b where b.image = u
    union all select jsonb_build_object('type', 'design', 'label', d.name, 'href', '/admin/catalogue') from public.designs d where d.preview_image = u
    union all select jsonb_build_object('type', 'website', 'label', 'Website editor', 'href', '/admin/website')
      from public.settings s where position(u in coalesce(s.website_content::text, '')) > 0
  ) t
$$;

create or replace function public.admin_media_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q text := nullif(trim(coalesce(p->>'q', '')), ''); lim int := least(greatest(coalesce((p->>'limit')::int, 48), 1), 200); off int := greatest(coalesce((p->>'offset')::int, 0), 0);
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object(
    'total', (select count(*) from public.media_assets m where q is null or m.filename ilike '%' || q || '%' or m.alt ilike '%' || q || '%'),
    'items', coalesce((select jsonb_agg(row_to_json(r)::jsonb || jsonb_build_object('used', case when coalesce((p->>'with_usage')::boolean, true) then public._media_usage(r.url) end)) from (
      select m.id, m.url, m.filename, m.alt, m.mime, m.size_bytes, m.created_at, pr.email as uploaded_by
      from public.media_assets m left join public.profiles pr on pr.id = m.uploaded_by
      where q is null or m.filename ilike '%' || q || '%' or m.alt ilike '%' || q || '%'
      order by m.created_at desc limit lim offset off) r), '[]'::jsonb));
end $$;

create or replace function public.admin_media_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid := (p->>'actor')::uuid; rid uuid;
begin
  perform public._require(actor, array['admin']);
  insert into public.media_assets (url, path, filename, alt, mime, size_bytes, uploaded_by)
  values (p->>'url', p->>'path', left(coalesce(p->>'filename', ''), 200), left(coalesce(p->>'alt', ''), 300), left(p->>'mime', 80), (p->>'size')::bigint, actor)
  on conflict (url) do update set filename = excluded.filename
  returning id into rid;
  return jsonb_build_object('id', rid);
end $$;

create or replace function public.admin_media_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  update public.media_assets set alt = left(coalesce(p->>'alt', ''), 300) where id = (p->>'id')::uuid;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Deleting is refused while the image is used anywhere. Returns the storage path so the server can remove the file.
create or replace function public.admin_media_delete(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.media_assets; used jsonb;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into m from public.media_assets where id = (p->>'id')::uuid for update;
  if m.id is null then raise exception 'not_found'; end if;
  used := public._media_usage(m.url);
  if jsonb_array_length(used) > 0 then return jsonb_build_object('ok', false, 'error', 'in_use', 'used', used); end if;
  delete from public.media_assets where id = m.id;
  return jsonb_build_object('ok', true, 'path', m.path, 'url', m.url);
end $$;

-- Who may use the library: website editors and catalogue editors (and owners).
do $$ begin
  if to_regclass('public.admin_function_permissions') is not null then
    insert into public.admin_function_permissions (fn, permissions) values
      ('admin_media_list', array['content','catalogue']), ('admin_media_register', array['content','catalogue']),
      ('admin_media_update', array['content','catalogue']), ('admin_media_delete', array['content','catalogue'])
    on conflict (fn) do update set permissions = excluded.permissions;
  end if;
end $$;

drop trigger if exists audit_media_assets on public.media_assets;
create trigger audit_media_assets after insert or update or delete on public.media_assets
  for each row execute function public._audit_row('created_at,size_bytes,mime,path', '');

do $$
declare f text;
begin
  foreach f in array array['_media_usage(text)','admin_media_list(jsonb)','admin_media_register(jsonb)','admin_media_update(jsonb)','admin_media_delete(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
