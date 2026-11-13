-- 0017: admin control centre — audit trail, website version history, team management.
-- Requires 0014 (settings.website_content / website_revision). Additive and reversible
-- (supabase/rollback/0017_admin_control.sql). No existing rows are modified or deleted.

begin;

-- ---------------------------------------------------------------- who is acting
-- Every admin SQL function already starts with _require(actor, roles). It now also records the verified
-- actor for the rest of this transaction, so the audit triggers below can attribute every change.
-- (Was STABLE; set_config makes it VOLATILE. Behaviour of the role check is unchanged.)
create or replace function public._require(actor uuid, roles text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if actor is null or not (coalesce((select role from public.profiles where id = actor), 'none') = any(roles)) then
    raise exception 'forbidden';
  end if;
  perform set_config('app.actor', actor::text, true);
end $$;

-- ---------------------------------------------------------------- audit log
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  table_name text not null,
  row_id text,
  label text,
  action text not null check (action in ('insert', 'update', 'delete')),
  changes jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;

-- Records a change only when an admin function set app.actor in this transaction. Checkout, payments and
-- customer self-service are deliberately not logged here: they have their own records (order_events, payments).
-- TG_ARGV lists columns to leave out (search vectors, timestamps) and columns to mark as changed without
-- copying their value (large content).
create or replace function public._audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor_txt text := nullif(current_setting('app.actor', true), '');
  skip text[] := coalesce(string_to_array(TG_ARGV[0], ','), '{}');
  opaque text[] := coalesce(string_to_array(TG_ARGV[1], ','), '{}');
  o jsonb := case when TG_OP <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when TG_OP <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  src jsonb := case when TG_OP = 'DELETE' then o else n end;
  diff jsonb := '{}'::jsonb;
  k text;
  clip constant int := 300;
  v_old jsonb; v_new jsonb;
begin
  if actor_txt is null then return null; end if;
  for k in select jsonb_object_keys(o || n) loop
    continue when k = any(skip);
    v_old := o -> k; v_new := n -> k;
    continue when TG_OP = 'UPDATE' and v_old is not distinct from v_new;
    if k = any(opaque) then
      diff := diff || jsonb_build_object(k, 'changed');
    else
      diff := diff || jsonb_build_object(k, jsonb_build_array(
        case when jsonb_typeof(v_old) = 'string' and length(v_old #>> '{}') > clip then to_jsonb(left(v_old #>> '{}', clip) || '…') else v_old end,
        case when jsonb_typeof(v_new) = 'string' and length(v_new #>> '{}') > clip then to_jsonb(left(v_new #>> '{}', clip) || '…') else v_new end));
    end if;
  end loop;
  if TG_OP = 'UPDATE' and diff = '{}'::jsonb then return null; end if;
  insert into public.audit_log (actor, actor_email, table_name, row_id, label, action, changes)
  values (
    actor_txt::uuid,
    (select email from public.profiles where id = actor_txt::uuid),
    TG_TABLE_NAME,
    src ->> 'id',
    coalesce(src ->> 'name', src ->> 'code', src ->> 'sku', src ->> 'slug', src ->> 'email', src ->> 'title'),
    lower(TG_OP),
    diff
  );
  return null;
end $$;

do $$
declare t record;
begin
  for t in select * from (values
    ('products',       'search,updated_at',  ''),
    ('product_variants','updated_at',        ''),
    ('product_images', '',                   ''),
    ('designs',        'search,updated_at',  ''),
    ('collections',    'search,updated_at',  ''),
    ('bundles',        'updated_at',         ''),
    ('bundle_slots',   '',                   ''),
    ('discount_codes', 'updated_at',         ''),
    ('delivery_zones', 'updated_at',         ''),
    ('settings',       'updated_at,website_revision', 'website_content'),
    ('reviews',        'updated_at',         '')
  ) as x(tbl, skip, opaque) loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists audit_%1$s on public.%1$I', t.tbl);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public._audit_row(%2$L, %3$L)', t.tbl, t.skip, t.opaque);
    end if;
  end loop;
end $$;

-- Profiles: only role changes are recorded (never customers' personal details).
drop trigger if exists audit_profiles_role on public.profiles;
create trigger audit_profiles_role after update of role on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function public._audit_row('id,email,full_name,phone,store_credit_kobo,created_at,updated_at', '');

create or replace function public.admin_activity_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pg int := greatest(1, coalesce((p->>'page')::int, 1));
  per int := least(100, greatest(1, coalesce((p->>'per_page')::int, 50)));
  tbl text := nullif(p->>'table', '');
  q text := nullif(btrim(p->>'q'), '');
  total int; rows jsonb;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select count(*) into total from public.audit_log a
    where (tbl is null or a.table_name = tbl)
      and (q is null or a.label ilike '%' || q || '%' or a.actor_email ilike '%' || q || '%');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]') into rows from (
    select a.id, a.at, a.actor_email, a.table_name, a.row_id, a.label, a.action, a.changes
    from public.audit_log a
    where (tbl is null or a.table_name = tbl)
      and (q is null or a.label ilike '%' || q || '%' or a.actor_email ilike '%' || q || '%')
    order by a.at desc limit per offset (pg - 1) * per) x;
  return jsonb_build_object('total', total, 'page', pg, 'per_page', per, 'rows', rows);
end $$;

-- ---------------------------------------------------------------- website version history
create table if not exists public.website_revisions (
  id bigint generated always as identity primary key,
  revision integer not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_email text,
  restored_from integer
);
create index if not exists website_revisions_created_idx on public.website_revisions (created_at desc);
alter table public.website_revisions enable row level security;
revoke all on public.website_revisions from public, anon, authenticated;

-- Keep what is live today as the starting point of the history.
insert into public.website_revisions (revision, content, created_by_email)
select s.website_revision, s.website_content, 'before history'
from public.settings s
where s.id and s.website_content <> '{}'::jsonb and not exists (select 1 from public.website_revisions);

create or replace function public._website_publish(actor uuid, content jsonb, expected integer, restored_from integer)
returns integer language plpgsql security definer set search_path = public as $$
declare version integer;
begin
  if content is null or jsonb_typeof(content) <> 'object' or length(content::text) > 200000 then raise exception 'invalid_website_content'; end if;
  update public.settings set website_content = content, website_revision = website_revision + 1
    where id and website_revision = expected returning website_revision into version;
  if version is null then raise exception 'website_conflict'; end if;
  insert into public.website_revisions (revision, content, created_by, created_by_email, restored_from)
  values (version, content, actor, (select email from public.profiles where id = actor), restored_from);
  -- Keep the latest 100 versions.
  delete from public.website_revisions where id in (select id from public.website_revisions order by id desc offset 100);
  return version;
end $$;
revoke all on function public._website_publish(uuid, jsonb, integer, integer) from public, anon, authenticated;

create or replace function public.admin_website_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $website$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return jsonb_build_object('revision', public._website_publish((p->>'actor')::uuid, p->'content', (p->>'revision')::integer, null));
end $website$;

create or replace function public.admin_website_history(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'revision', r.revision, 'created_at', r.created_at, 'author', r.created_by_email,
      'restored_from', r.restored_from, 'size', length(r.content::text)) order by r.id desc)
    from (select * from public.website_revisions order by id desc limit least(100, greatest(1, coalesce((p->>'limit')::int, 30)))) r), '[]'::jsonb);
end $$;

create or replace function public.admin_website_restore(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare snap record;
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  select * into snap from public.website_revisions where id = (p->>'id')::bigint;
  if snap is null then raise exception 'revision_not_found'; end if;
  return jsonb_build_object('revision', public._website_publish((p->>'actor')::uuid, snap.content, (p->>'revision')::integer, snap.revision));
end $$;

-- ---------------------------------------------------------------- team
create or replace function public.admin_team_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require((p->>'actor')::uuid, array['admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'email', pr.email, 'name', pr.full_name, 'role', pr.role,
      'last_sign_in_at', u.last_sign_in_at) order by case pr.role when 'admin' then 0 else 1 end, pr.email)
    from public.profiles pr left join auth.users u on u.id = pr.id
    where pr.role in ('staff', 'admin')), '[]'::jsonb);
end $$;

create or replace function public.admin_set_role(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (p->>'actor')::uuid;
  new_role text := p->>'role';
  target record;
begin
  perform public._require(actor, array['admin']);
  -- Serialise concurrent role changes: two admins demoting each other at the same moment must not leave
  -- the store with no admin. After waiting for the lock, re-check that the actor is still an admin.
  perform 1 from public.profiles where role = 'admin' for update;
  if (select role from public.profiles where id = actor) is distinct from 'admin' then raise exception 'forbidden'; end if;
  if new_role not in ('customer', 'staff', 'admin') then raise exception 'invalid_role'; end if;
  select id, role into target from public.profiles where lower(email) = lower(btrim(p->>'email'));
  if target is null then raise exception 'account_not_found'; end if;
  if target.id = actor then raise exception 'cannot_change_own_role'; end if;
  if target.role = 'admin' and new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then raise exception 'last_admin'; end if;
  update public.profiles set role = new_role where id = target.id;
  return jsonb_build_object('id', target.id, 'role', new_role, 'previous', target.role);
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_activity_list(jsonb)', 'admin_website_save(jsonb)', 'admin_website_history(jsonb)', 'admin_website_restore(jsonb)', 'admin_team_list(jsonb)', 'admin_set_role(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
