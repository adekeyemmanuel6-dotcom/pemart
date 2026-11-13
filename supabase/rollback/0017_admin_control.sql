-- Rollback for 0017. Restores 0012's _require and 0014's admin_website_save, removes the new functions and
-- triggers. The audit_log and website_revisions tables are KEPT (they are records); drop them manually only
-- after exporting them, if ever.
begin;

create or replace function public._require(actor uuid, roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if actor is null or not (coalesce((select role from public.profiles where id = actor), 'none') = any(roles)) then
    raise exception 'forbidden';
  end if;
end $$;

create or replace function public.admin_website_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $website$
declare version integer;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  if p->'content' is null or jsonb_typeof(p->'content') <> 'object' or length((p->'content')::text) > 200000 then raise exception 'invalid_website_content'; end if;
  update public.settings set website_content = p->'content', website_revision = website_revision + 1
    where id and website_revision = (p->>'revision')::integer returning website_revision into version;
  if version is null then raise exception 'website_conflict'; end if;
  return jsonb_build_object('revision', version);
end $website$;

do $$
declare t text;
begin
  foreach t in array array['products','product_variants','product_images','designs','collections','bundles','bundle_slots','discount_codes','delivery_zones','settings','reviews'] loop
    if to_regclass('public.' || t) is not null then execute format('drop trigger if exists audit_%1$s on public.%1$I', t); end if;
  end loop;
end $$;
drop trigger if exists audit_profiles_role on public.profiles;

drop function if exists public.admin_activity_list(jsonb);
drop function if exists public.admin_website_history(jsonb);
drop function if exists public.admin_website_restore(jsonb);
drop function if exists public._website_publish(uuid, jsonb, integer, integer);
drop function if exists public.admin_team_list(jsonb);
drop function if exists public.admin_set_role(jsonb);
drop function if exists public._audit_row();

commit;
