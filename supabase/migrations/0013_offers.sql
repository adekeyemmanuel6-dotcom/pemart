-- First-order offer: a single-use 10% code issued to a new subscriber (popup or footer sign-up).
alter table public.subscribers add column if not exists offer_code text;
alter table public.subscribers add column if not exists offer_issued_at timestamptz;
create unique index if not exists subscribers_phone_uidx on public.subscribers (phone) where phone is not null;

-- p: { email?, phone?, source }. Returns { code, is_new, expires_at, used }.
-- Re-claiming with the same email/phone returns the same code instead of minting another.
create or replace function public.offer_claim(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  em text := nullif(lower(btrim(coalesce(p->>'email',''))), '');
  ph text := nullif(regexp_replace(coalesce(p->>'phone',''), '[^0-9+]', '', 'g'), '');
  src text := coalesce(nullif(p->>'source',''), 'popup');
  s public.subscribers;
  d public.discount_codes;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text; i int; tries int := 0;
  exp timestamptz := now() + interval '60 days';
begin
  if em is null and ph is null then raise exception 'email_or_phone_required'; end if;
  if em is not null then select * into s from public.subscribers where lower(email) = em; end if;
  if not found and ph is not null then select * into s from public.subscribers where phone = ph; end if;

  if found and s.offer_code is not null then
    select * into d from public.discount_codes where code = s.offer_code;
    return jsonb_build_object('code', s.offer_code, 'is_new', false, 'expires_at', d.ends_at, 'used', coalesce(d.times_used, 0) >= 1);
  end if;

  if not found then
    insert into public.subscribers (email, phone, source) values (em, ph, src) returning * into s;
  else
    update public.subscribers set email = coalesce(email, em), phone = coalesce(phone, ph) where id = s.id returning * into s;
  end if;

  loop
    c := 'PEM-';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.discount_codes where code = c);
    tries := tries + 1;
    if tries > 20 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into public.discount_codes (code, type, value, usage_limit, per_customer_limit, is_single_use, ends_at, is_active)
  values (c, 'percentage', 10, 1, 1, true, exp, true);
  update public.subscribers set offer_code = c, offer_issued_at = now() where id = s.id;
  return jsonb_build_object('code', c, 'is_new', true, 'expires_at', exp, 'used', false);
end $$;

revoke all on function public.offer_claim(jsonb) from public, anon, authenticated;
grant execute on function public.offer_claim(jsonb) to service_role;
