import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake Supabase session: who is signed in, their role and their assurance level.
const state = { user: { id: 'u1' } as { id: string } | null, role: 'admin', current: 'aal1', next: 'aal2', aalError: false };

vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true, publicEnv: { NEXT_PUBLIC_SITE_URL: 'http://localhost' } }));
vi.mock('@/lib/db', () => ({ dbMode: () => 'supabase' }));
vi.mock('@/lib/dev-auth', () => ({ devProfile: async () => null }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () =>
          state.aalError ? { data: null, error: new Error('x') } : { data: { currentLevel: state.current, nextLevel: state.next }, error: null },
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'u1', email: 'a@b.c', full_name: null, phone: null, role: state.role, store_credit_kobo: 0 } }) }) }) }),
  }),
}));
class Redirect extends Error { constructor(public to: string) { super(to); } }
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Redirect(to); } }));

const { requireAdmin, requireStaff, getPrivilegedProfile } = await import('@/lib/auth');
const { sessionAssurance } = await import('@/lib/mfa');

const target = async (p: Promise<unknown>) => { try { await p; return 'allowed'; } catch (e) { if (e instanceof Redirect) return e.to; throw e; } };

beforeEach(() => Object.assign(state, { user: { id: 'u1' }, role: 'admin', current: 'aal1', next: 'aal2', aalError: false }));

describe('sessionAssurance', () => {
  it('distinguishes set-up, verification and a completed two-factor session', async () => {
    Object.assign(state, { current: 'aal1', next: 'aal1' });
    expect(await sessionAssurance()).toBe('needs-enrol');
    Object.assign(state, { current: 'aal1', next: 'aal2' });
    expect(await sessionAssurance()).toBe('needs-verify');
    Object.assign(state, { current: 'aal2', next: 'aal2' });
    expect(await sessionAssurance()).toBe('aal2');
  });
  it('fails closed if the level cannot be read', async () => {
    state.aalError = true;
    expect(await sessionAssurance()).toBe('needs-enrol');
  });
});

describe('admin gate', () => {
  it('sends an admin without two-factor to the MFA page, keeping where they were going', async () => {
    expect(await target(requireAdmin('/admin/orders'))).toBe('/auth/mfa?next=%2Fadmin%2Forders');
  });
  it('lets an admin with a two-factor session through', async () => {
    state.current = 'aal2';
    expect(await target(requireAdmin())).toBe('allowed');
  });
  it('applies to staff too', async () => {
    state.role = 'staff';
    expect(await target(requireStaff('/admin'))).toBe('/auth/mfa?next=%2Fadmin');
    state.current = 'aal2';
    expect(await target(requireStaff('/admin'))).toBe('allowed');
  });
  it('still keeps customers out entirely, two-factor or not', async () => {
    Object.assign(state, { role: 'customer', current: 'aal2' });
    expect(await target(requireStaff())).toBe('/?denied=1');
  });
  it('route handlers get no profile without two-factor', async () => {
    expect(await getPrivilegedProfile()).toBeNull();
    state.current = 'aal2';
    expect((await getPrivilegedProfile())?.role).toBe('admin');
    expect(await getPrivilegedProfile(['staff'])).toBeNull();
  });
});
