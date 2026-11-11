import { NextResponse, type NextRequest } from 'next/server';
import { dbMode } from '@/lib/db';
import { DEV_COOKIE } from '@/lib/dev-auth';

/**
 * DEV ONLY: /api/dev/login?email=ada@example.com&role=customer|staff|admin&next=/account
 * Creates the profile if needed and signs you in with a cookie. Returns 404 anywhere but local Postgres mode.
 */
export async function GET(request: NextRequest) {
  if (dbMode() !== 'pg') return new NextResponse('Not found', { status: 404 });
  const { Pool } = await import('pg');
  const sp = request.nextUrl.searchParams;
  if (sp.get('logout')) { const r = NextResponse.redirect(new URL('/', request.url)); r.cookies.delete(DEV_COOKIE); return r; }
  const email = (sp.get('email') ?? 'dev@example.com').toLowerCase();
  const role = ['customer', 'staff', 'admin'].includes(sp.get('role') ?? '') ? sp.get('role')! : 'customer';
  const next = (sp.get('next') ?? '/account').startsWith('/') ? sp.get('next') ?? '/account' : '/account';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    let { rows } = await pool.query('select id from public.profiles where lower(email) = $1', [email]);
    if (!rows[0]) { await pool.query('insert into auth.users (email) values ($1)', [email]); ({ rows } = await pool.query('select id from public.profiles where lower(email) = $1', [email])); }
    await pool.query('update public.profiles set role = $2 where id = $1', [rows[0].id, role]);
    const res = NextResponse.redirect(new URL(next, request.url));
    res.cookies.set(DEV_COOKIE, rows[0].id, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res;
  } finally { await pool.end(); }
}
