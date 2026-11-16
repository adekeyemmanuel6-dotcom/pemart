import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, pool, q, reset } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const base = { name: 'Ada Obi', email: 'Ada@Example.com', phone: '+2348031234567', state: 'Ondo', city: 'Akure', whatsapp_updates: true };

describe.skipIf(!TEST_DB)('pre-sale against real Postgres', () => {
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string, staff: string, customer: string;
  beforeAll(async () => { rpc = (await (await import('@/lib/db')).getRpc())! as never; });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    await q('delete from public.presale_requests; update public.presale_config set config = \'{}\'::jsonb where id = 1');
    admin = await makeUser('admin@example.com'); staff = await makeUser('staff@example.com'); customer = await makeUser('cust@example.com');
    await q(`update public.profiles set role='admin' where id=$1`, [admin]); await q(`update public.profiles set role='staff' where id=$1`, [staff]);
  });
  const call = (fn: string, actor: string | null, extra: Json = {}) => rpc(fn, { actor, ...extra });
  const ok = async (fn: string, actor: string, extra: Json = {}) => { const r = await call(fn, actor, extra); if (r.error) throw new Error(`${fn}: ${r.error.message}`); return r.data; };
  const submit = (over: Json = {}) => rpc('presale_submit', { ...base, items: [{ garment: 'tee', sizes: { M: 2, L: 1 } }], ...over });

  it('saves a request with a PRE- reference, normalised email and cleaned items', async () => {
    const r = (await submit({ items: [{ garment: 'hoodie', sizes: { S: 0, M: 2, XXL: 1 } }, { garment: 'tee', sizes: { L: 0 } }] })).data;
    expect(r.reference).toMatch(/^PRE-\d{4,}$/); expect(r.total_qty).toBe(3);
    expect(r.items).toEqual([{ garment: 'hoodie', sizes: { M: 2, XXL: 1 } }]);   // empty sizes and empty garments are dropped
    const row = (await q('select * from public.presale_requests'))[0]!;
    expect(row.email).toBe('ada@example.com'); expect(row.status).toBe('new'); expect(row.total_qty).toBe(3);
    const second = (await submit()).data;
    expect(second.reference).not.toBe(r.reference);
  });

  it('refuses bad garments, sizes, quantities and empty orders', async () => {
    for (const items of [[{ garment: 'socks', sizes: { M: 1 } }], [{ garment: 'tee', sizes: { XXXL: 1 } }], [{ garment: 'tee', sizes: { M: -1 } }], [{ garment: 'tee', sizes: { M: 101 } }], [{ garment: 'tee', sizes: { M: 0 } }], []]) {
      expect((await submit({ items })).error, JSON.stringify(items)).toBeTruthy();
    }
    expect(await q('select 1 from public.presale_requests')).toHaveLength(0);
    expect((await submit({ name: 'A' })).error).toBeTruthy();   // too-short name violates the table check
  });

  it('only the team can list or update; staff need the Orders permission; customers and anonymous are refused', async () => {
    await submit();
    for (const who of [customer, null]) {
      expect((await call('admin_presale_list', who)).error?.message).toMatch(/forbidden/);
      expect((await call('admin_presale_update', who, { id: crypto.randomUUID(), status: 'contacted' })).error?.message).toMatch(/forbidden/);
    }
    expect((await call('admin_presale_config_save', staff, { config: {} })).error?.message).toMatch(/forbidden/);   // owners only
    expect((await call('admin_presale_config_save', customer, { config: {} })).error?.message).toMatch(/forbidden/);
    expect((await call('admin_presale_list', staff)).error).toBeNull();          // staff default permissions include orders
    expect((await call('admin_presale_list', admin)).error).toBeNull();
  });

  it('totals count by garment and size and leave cancelled requests out', async () => {
    const a = (await submit({ items: [{ garment: 'tee', sizes: { M: 2, L: 1 } }, { garment: 'hoodie', sizes: { M: 1 } }] })).data;
    await submit({ email: 'b@example.com', items: [{ garment: 'tee', sizes: { M: 3 } }] });
    const c = (await submit({ email: 'c@example.com', items: [{ garment: 'tee', sizes: { M: 10 } }] })).data;
    const cancelId = (await q('select id from public.presale_requests where reference = $1', [c.reference]))[0]!.id;
    await ok('admin_presale_update', admin, { id: cancelId, status: 'cancelled', admin_note: 'Changed their mind' });
    const list = await ok('admin_presale_list', admin);
    expect(list.requests).toHaveLength(3);
    expect(list.counts).toMatchObject({ new: 2, cancelled: 1 });
    const cell = (g: string, s: string) => list.totals.find((t: Json) => t.garment === g && t.size === s)?.qty;
    expect(cell('tee', 'M')).toBe(5); expect(cell('tee', 'L')).toBe(1); expect(cell('hoodie', 'M')).toBe(1);
    expect(list.totals.some((t: Json) => t.qty === 10)).toBe(false);
    const filtered = await ok('admin_presale_list', admin, { status: 'cancelled' });
    expect(filtered.requests).toHaveLength(1); expect(filtered.requests[0].admin_note).toBe('Changed their mind');
    expect(a.reference).toBeTruthy();
  });

  it('rejects an unknown status and a missing request', async () => {
    const r = (await submit()).data;
    const id = (await q('select id from public.presale_requests where reference = $1', [r.reference]))[0]!.id;
    expect((await call('admin_presale_update', admin, { id, status: 'shipped' })).error?.message).toMatch(/bad_status/);
    expect((await call('admin_presale_update', admin, { id: crypto.randomUUID(), status: 'contacted' })).error?.message).toMatch(/not_found/);
  });

  it('settings save and read back; the public reader returns {} until the owner saves', async () => {
    expect((await rpc('presale_config_get', {})).data).toEqual({});
    await ok('admin_presale_config_save', admin, { config: { enabled: true, headline: 'Big sale' } });
    expect((await rpc('presale_config_get', {})).data).toMatchObject({ enabled: true, headline: 'Big sale' });
  });
});
