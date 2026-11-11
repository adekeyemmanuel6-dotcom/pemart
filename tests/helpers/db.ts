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
    update public.discount_codes set times_used = 0;
    alter sequence public.order_number_seq restart with 10001;`);
}
export const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows as T[];
export const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await q<T>(sql, args))[0] as T;
export const variantId = async (sku: string) => (await one<{ id: string }>('select id from public.product_variants where sku = $1', [sku])).id;

export async function makeUser(email = 'ada@example.com', credit = 0) {
  const u = await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  if (credit) await q('update public.profiles set store_credit_kobo = $2 where id = $1', [u.id, credit]);
  return u.id;
}
