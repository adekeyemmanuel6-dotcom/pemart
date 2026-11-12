import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Supabase deployment key compatibility', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']) vi.stubEnv(name, '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://store.example');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('supports current public and server key names', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'server-test-key');
    const env = await import('@/lib/env');
    expect(env.isSupabaseConfigured).toBe(true);
    expect(env.publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('public-test-key');
    expect(env.serverEnv().SUPABASE_SERVICE_ROLE_KEY).toBe('server-test-key');
    expect(JSON.stringify(env.publicEnv)).not.toContain('server-test-key');
    expect((await import('@/lib/db')).dbMode()).toBe('supabase');
  });

  it('retains legacy keys when both formats exist', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-public');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'modern-public');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-server');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'modern-server');
    const env = await import('@/lib/env');
    expect(env.publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('legacy-public');
    expect(env.serverEnv().SUPABASE_SERVICE_ROLE_KEY).toBe('legacy-server');
  });

  it('does not treat a URL alone as configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    expect((await import('@/lib/env')).isSupabaseConfigured).toBe(false);
  });

  it('does not substitute a server key for a missing public key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'server-test-key');
    const env = await import('@/lib/env');
    expect(env.isSupabaseConfigured).toBe(false);
    expect(env.publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('');
    expect(JSON.stringify(env.publicEnv)).not.toContain('server-test-key');
  });

  it('requires a server key for privileged operations', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
    expect((await import('@/lib/env')).serverEnv).toThrow();
  });
});
