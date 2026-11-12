-- Rollback for 0015. Safe at any time: the application falls back to its per-instance limiter
-- when rate_limit_hit is missing. The table only holds short-lived hashed counters.
drop function if exists public.rate_limit_hit(jsonb);
drop table if exists public.rate_limits;
