import 'server-only';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * All money-critical database work (create order, mark paid, expire, order lookup) is done by SQL
 * functions that take ONE jsonb argument. This is the single doorway to them.
 *
 *  - Production / any Supabase project: the service-role client calls the function over PostgREST.
 *  - Local development and tests: set DATABASE_URL to a plain Postgres that has the migrations applied
 *    and the same functions run through `pg`. It is refused when NODE_ENV is "production".
 */
export type RpcResult<T> = { data: T | null; error: { message: string } | null };
export type Rpc = <T = unknown>(fn: string, arg: Record<string, unknown>) => Promise<RpcResult<T>>;

let pgRpc: Rpc | null = null;

async function getPgRpc(): Promise<Rpc> {
  if (pgRpc) return pgRpc;
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  pgRpc = async <T,>(fn: string, arg: Record<string, unknown>): Promise<RpcResult<T>> => {
    if (!/^[a-z_]+$/.test(fn)) throw new Error('invalid function name');
    try {
      const { rows } = await pool.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(arg)]);
      return { data: (rows[0]?.r ?? null) as T | null, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };
  return pgRpc;
}

export const dbMode = (): 'supabase' | 'pg' | 'none' =>
  isSupabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase'
  : process.env.DATABASE_URL && process.env.NODE_ENV !== 'production' ? 'pg' : 'none';

/** The RPC transport, or null when no database is configured (the app then runs in demo mode). */
export async function getRpc(): Promise<Rpc | null> {
  const mode = dbMode();
  if (mode === 'pg') return getPgRpc();
  if (mode === 'supabase') {
    const admin = createAdminClient();
    return async <T,>(fn: string, arg: Record<string, unknown>) => {
      const { data, error } = await admin.rpc(fn, { p: arg });
      return { data: data as T | null, error: error ? { message: error.message } : null };
    };
  }
  return null;
}
