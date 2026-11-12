-- 0015: shared rate limiting.
-- Serverless functions run as many short-lived instances, so a per-process counter can be bypassed by
-- simply landing on a different instance. This keeps one fixed-window counter per key in Postgres.
-- Additive and reversible (see supabase/rollback/0015_rate_limits.sql). Touches no existing table.
-- Keys arrive already SHA-256 hashed by the application, so no IP address or email is stored.

create table if not exists public.rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  count integer not null check (count >= 0),
  reset_at timestamptz not null
);
create index if not exists rate_limits_reset_at_idx on public.rate_limits (reset_at);

-- No policies: anon and authenticated users can neither read nor write it.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

create or replace function public.rate_limit_hit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := p->>'key';
  v_limit integer := (p->>'limit')::integer;
  v_window integer := (p->>'window_ms')::integer;
  v_count integer;
  v_reset timestamptz;
begin
  if v_key is null or v_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid rate limit key'; end if;
  if v_limit is null or v_limit < 1 or v_limit > 100000 then raise exception 'invalid limit'; end if;
  if v_window is null or v_window < 1000 or v_window > 86400000 then raise exception 'invalid window'; end if;

  insert into public.rate_limits as r (key_hash, count, reset_at)
  values (v_key, 1, now() + make_interval(secs => v_window / 1000.0))
  on conflict (key_hash) do update set
    count = case when r.reset_at <= now() then 1 else r.count + 1 end,
    reset_at = case when r.reset_at <= now() then now() + make_interval(secs => v_window / 1000.0) else r.reset_at end
  returning count, reset_at into v_count, v_reset;

  -- Occasional housekeeping keeps the table small without a separate job.
  if random() < 0.01 then delete from public.rate_limits where reset_at < now() - interval '1 day'; end if;

  return jsonb_build_object(
    'ok', v_count <= v_limit,
    'retry_after_sec', greatest(0, ceil(extract(epoch from (v_reset - now()))))::integer
  );
end $$;

revoke all on function public.rate_limit_hit(jsonb) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(jsonb) to service_role;
