-- Pemart 0006: Postgres full-text search for products and collections

alter table public.products
  add column search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'C')
  ) stored;
create index products_search_idx on public.products using gin (search);
create index products_name_trgm on public.products using gin (name gin_trgm_ops);

alter table public.collections
  add column search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(intro,'')), 'C')
  ) stored;
create index collections_search_idx on public.collections using gin (search);

-- Prefix-aware search ("hood" finds "hoodie") with a trigram fallback for typos.
create or replace function public.search_catalogue(q text, max_results int default 12)
returns table (kind text, slug text, name text, price_kobo bigint, rank real)
language sql stable as $$
  with tokens as (
    select string_agg(quote_literal(t) || ':*', ' & ') as expr
    from unnest(regexp_split_to_array(lower(trim(q)), '\s+')) as t
    where t ~ '^[a-z0-9]+$'
  ),
  p as (
    select 'product'::text as kind, pr.slug, pr.name, pr.base_price_kobo as price_kobo,
           greatest(
             ts_rank(pr.search, to_tsquery('simple', (select expr from tokens))),
             similarity(pr.name, q)
           )::real as rank
    from public.products pr
    where pr.is_active and (
      ((select expr from tokens) is not null
        and pr.search @@ to_tsquery('simple', (select expr from tokens)))
      or pr.name % q
    )
  ),
  c as (
    select 'collection'::text as kind, co.slug, co.name, null::bigint as price_kobo,
           ts_rank(co.search, to_tsquery('simple', (select expr from tokens)))::real as rank
    from public.collections co
    where co.is_active and (select expr from tokens) is not null
      and co.search @@ to_tsquery('simple', (select expr from tokens))
  )
  select * from (select * from c union all select * from p) r
  order by rank desc, name
  limit greatest(1, least(max_results, 50))
$$;
