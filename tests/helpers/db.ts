import { Pool } from 'pg';

/** Integration tests run against a real Postgres built from the migrations (see `npm run test:db`). */
export const TEST_DB = process.env.TEST_DATABASE_URL;
export const pool = TEST_DB ? new Pool({ connectionString: TEST_DB, max: 4 }) : (null as unknown as Pool);

export async function reset() {
  await pool.query(`
    truncate public.orders, public.gift_cards, public.custom_requests restart identity cascade;
    delete from auth.users;
    update public.product_variants set reserved_qty = 0;
    update public.product_variants set stock_qty = 40 where sku like 'FAITH-BRACELET-%';
    alter sequence public.order_number_seq restart with 10001;
    truncate public.ambassadors, public.discount_codes, public.commissions, public.bulk_quotes, public.inventory_adjustments cascade;
    do $$ begin if to_regclass('public.audit_log') is not null then truncate public.audit_log, public.website_revisions; end if; end $$;
    do $$ begin if to_regclass('public.payment_events') is not null then truncate public.payment_events; end if; end $$;
    do $$ begin if to_regclass('public.media_assets') is not null then delete from public.media_assets where url like '/uploads/test-%'; end if; end $$;
    delete from public.products where slug like 'csv-%';
    do $$ begin if exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'crypto_wallets') then
      update public.settings set crypto_enabled = false, crypto_wallets = '[]'::jsonb, crypto_instructions = null, crypto_window_hours = 48; end if; end $$;
    insert into public.ambassadors (name, email, code, commission_rate, payout_note) values ('Demo Ambassador', 'ambassador@example.com', 'GRACE10', 0.10, 'Demo only');
    insert into public.discount_codes (code, type, value) values ('PEMART10', 'percentage', 10);
    insert into public.discount_codes (code, type, value, ambassador_id) values ('GRACE10', 'percentage', 10, (select id from public.ambassadors where code = 'GRACE10'));
    -- Synthetic verified delivery services, ONLY in the isolated test database.
    update public.delivery_zones set rate_verified = true, is_active = true, min_days = 5, max_days = 5;
    update public.settings set free_shipping_threshold_kobo = 20000000;
    -- seeded configuration that admin tests edit
    update public.delivery_zones set fee_kobo = 350000, free_over_kobo = 7500000, lead_days = 5, christmas_cutoff_date = '2026-12-17' where name = 'Lagos';
    update public.delivery_zones set fee_kobo = 550000, free_over_kobo = null, lead_days = 5, christmas_cutoff_date = '2026-12-15' where name = 'South-West';
    update public.delivery_zones set fee_kobo = 750000, free_over_kobo = null, lead_days = 5, christmas_cutoff_date = '2026-12-15' where name = 'Other states';
    update public.settings set announcement_text = 'Order by 17 Dec for Christmas delivery in Lagos', announcement_active = true, gift_wrap_kobo = 200000, surprise_note_kobo = 300000,
      express_kobo = 500000, express_enabled = true, maintenance_mode = false, pay_on_delivery_enabled = false, revision_fee_kobo = 200000, review_credit_kobo = 200000;
    update public.products set is_active = true where slug = 'faith-bracelet';
    update public.product_variants set stock_qty = 40 where sku like 'FAITH-BRACELET-%';`);
}
export const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows as T[];
export const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await q<T>(sql, args))[0] as T;
export const variantId = async (sku: string) => (await one<{ id: string }>('select id from public.product_variants where sku = $1', [sku])).id;

export async function makeUser(email = 'ada@example.com', credit = 0) {
  const u = await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  if (credit) await q('update public.profiles set store_credit_kobo = $2 where id = $1', [u.id, credit]);
  return u.id;
}
