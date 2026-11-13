import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DB, makeUser, one, pool, q, reset } from '../helpers/db';

process.env.DATABASE_URL = TEST_DB ?? '';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Migration 0017: audit trail, website history and team management, against real Postgres. */
describe.skipIf(!TEST_DB)('admin control centre (0017)', () => {
  let rpc: (fn: string, arg: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let admin: string, admin2: string, staff: string, customer: string;
  beforeAll(async () => { rpc = (await (await import('@/lib/db')).getRpc())! as never; });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await reset();
    await q(`delete from public.discount_codes where code like 'AUDIT%'`);
    admin = await makeUser('owner@example.com'); admin2 = await makeUser('second@example.com');
    staff = await makeUser('staff@example.com'); customer = await makeUser('cust@example.com');
    await q(`update public.profiles set role='admin' where id = any($1)`, [[admin, admin2]]);
    await q(`update public.profiles set role='staff' where id=$1`, [staff]);
    await q(`truncate public.audit_log, public.website_revisions`); // role setup above is not an admin action
    await q(`update public.settings set website_content = '{"v":0}'::jsonb, website_revision = 0 where id`);
  });
  const call = (fn: string, actor: string | null, extra: Json = {}) => rpc(fn, { actor, ...extra });
  const ok = async (fn: string, actor: string, extra: Json = {}) => { const r = await call(fn, actor, extra); if (r.error) throw new Error(`${fn}: ${r.error.message}`); return r.data; };
  const err = async (fn: string, actor: string | null, extra: Json = {}) => (await call(fn, actor, extra)).error?.message ?? '';

  describe('audit trail', () => {
    it('records who changed what through admin functions, with before/after values', async () => {
      const row = await ok('admin_save', admin, { table: 'discount_codes', row: { code: 'AUDIT10', type: 'percentage', value: 10 } });
      await ok('admin_save', admin, { table: 'discount_codes', row: { id: row.id ?? row, value: 15 } });
      const log = await ok('admin_activity_list', admin, { table: 'discount_codes' });
      expect(log.total).toBe(2);
      const [update, insert] = log.rows;
      expect(insert).toMatchObject({ action: 'insert', actor_email: 'owner@example.com', label: 'AUDIT10' });
      expect(update).toMatchObject({ action: 'update', actor_email: 'owner@example.com' });
      expect(update.changes).toEqual({ value: [10, 15] });
    });

    it('does not log checkout, payments or direct system writes (no admin actor)', async () => {
      await q(`update public.settings set announcement_text = 'system' where id`);
      expect(Number((await one<{ n: string }>('select count(*) n from public.audit_log')).n)).toBe(0);
    });

    it('records role changes but never customers\' personal details', async () => {
      await ok('admin_set_role', admin, { email: 'cust@example.com', role: 'staff' });
      await q(`update public.profiles set full_name = 'Private Name' where id=$1`, [customer]);
      const rows = (await ok('admin_activity_list', admin, {})).rows as Json[];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ table_name: 'profiles', action: 'update', changes: { role: ['customer', 'staff'] } });
      expect(JSON.stringify(rows)).not.toContain('Private Name');
    });

    it('large website content is marked changed, not copied into the log', async () => {
      await ok('admin_website_save', admin, { content: { v: 1, big: 'x'.repeat(5000) }, revision: 0 });
      const row = (await ok('admin_activity_list', admin, { table: 'settings' })).rows[0];
      expect(row.changes).toEqual({ website_content: 'changed' });
    });

    it('the activity log is admin only', async () => {
      expect(await err('admin_activity_list', staff)).toMatch(/forbidden/);
      expect(await err('admin_activity_list', customer)).toMatch(/forbidden/);
      expect(await err('admin_activity_list', null)).toMatch(/forbidden/);
    });
  });

  describe('website history', () => {
    it('keeps every publish and restores an earlier version as a new revision', async () => {
      await ok('admin_website_save', admin, { content: { v: 1 }, revision: 0 });
      await ok('admin_website_save', admin2, { content: { v: 2 }, revision: 1 });
      const hist = await ok('admin_website_history', admin, {});
      expect(hist.map((h: Json) => [h.revision, h.author])).toEqual([[2, 'second@example.com'], [1, 'owner@example.com']]);
      const first = hist.find((h: Json) => h.revision === 1);
      const restored = await ok('admin_website_restore', admin, { id: first.id, revision: 2 });
      expect(restored.revision).toBe(3);
      expect((await one<{ c: Json }>('select website_content c from public.settings where id')).c).toEqual({ v: 1 });
      expect((await ok('admin_website_history', admin, {}))[0]).toMatchObject({ revision: 3, restored_from: 1 });
    });

    it('refuses stale publishes and restores (optimistic locking still holds)', async () => {
      await ok('admin_website_save', admin, { content: { v: 1 }, revision: 0 });
      expect(await err('admin_website_save', admin2, { content: { v: 9 }, revision: 0 })).toMatch(/website_conflict/);
      const [h] = await ok('admin_website_history', admin, {});
      expect(await err('admin_website_restore', admin, { id: h.id, revision: 0 })).toMatch(/website_conflict/);
      expect((await one<{ c: Json }>('select website_content c from public.settings where id')).c).toEqual({ v: 1 });
    });

    it('is admin only', async () => {
      for (const fn of ['admin_website_history', 'admin_website_restore', 'admin_website_save']) {
        expect(await err(fn, staff, { id: 1, revision: 0, content: {} })).toMatch(/forbidden/);
      }
    });
  });

  describe('team', () => {
    it('lists staff and admins only', async () => {
      const team = await ok('admin_team_list', admin);
      expect(team.map((t: Json) => t.email).sort()).toEqual(['owner@example.com', 'second@example.com', 'staff@example.com']);
    });

    it('grants and revokes access by email', async () => {
      expect(await ok('admin_set_role', admin, { email: 'CUST@example.com ', role: 'staff' })).toMatchObject({ role: 'staff', previous: 'customer' });
      await ok('admin_set_role', admin, { email: 'cust@example.com', role: 'customer' });
      expect((await one<{ role: string }>('select role from public.profiles where id=$1', [customer])).role).toBe('customer');
    });

    it('an admin cannot change their own role', async () => {
      expect(await err('admin_set_role', admin, { email: 'owner@example.com', role: 'staff' })).toMatch(/cannot_change_own_role/);
      expect((await one<{ role: string }>('select role from public.profiles where id=$1', [admin])).role).toBe('admin');
    });

    it('two admins demoting each other at the same time cannot leave the store without an admin', async () => {
      const [a, b] = await Promise.all([
        call('admin_set_role', admin, { email: 'second@example.com', role: 'staff' }),
        call('admin_set_role', admin2, { email: 'owner@example.com', role: 'staff' }),
      ]);
      expect([a.error, b.error].filter(Boolean)).toHaveLength(1);                 // exactly one wins
      expect(Number((await one<{ n: string }>(`select count(*) n from public.profiles where role='admin'`)).n)).toBe(1);
    });

    it('a demoted admin loses access immediately', async () => {
      await ok('admin_set_role', admin, { email: 'second@example.com', role: 'staff' });
      expect(await err('admin_set_role', admin2, { email: 'cust@example.com', role: 'admin' })).toMatch(/forbidden/);
      expect(await err('admin_activity_list', admin2)).toMatch(/forbidden/);
    });

    it('rejects unknown accounts and roles, and non-admin callers', async () => {
      expect(await err('admin_set_role', admin, { email: 'nobody@example.com', role: 'staff' })).toMatch(/account_not_found/);
      expect(await err('admin_set_role', admin, { email: 'cust@example.com', role: 'owner' })).toMatch(/invalid_role/);
      for (const who of [staff, customer, null]) {
        expect(await err('admin_set_role', who, { email: 'cust@example.com', role: 'admin' })).toMatch(/forbidden/);
        expect(await err('admin_team_list', who)).toMatch(/forbidden/);
      }
      expect((await one<{ role: string }>('select role from public.profiles where id=$1', [customer])).role).toBe('customer');
    });
  });

  it('existing admin functions still enforce roles after _require was extended', async () => {
    expect(await err('admin_save', staff, { table: 'products', row: { name: 'x' } })).toMatch(/forbidden/);
    expect(await err('admin_overview', customer)).toMatch(/forbidden/);
    await ok('admin_overview', staff);
  });
});
