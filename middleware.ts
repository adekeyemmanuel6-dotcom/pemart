import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSensitivePath, nonceCsp } from '@/lib/csp';

/**
 * Keeps the Supabase session fresh and gently redirects visitors who are not
 * signed in away from /account and /admin. This is a convenience only: every
 * page, server action and RLS policy re-checks access on the server.
 */
// Pre-sale lock: until launch, every public store page sends visitors to /presale.
// Staff open any page with ?preview=1 once (sets a 30-day cookie) to browse the full store; ?preview=0 clears it.
// To open the store at launch, set STORE_LOCKED to false (or delete this block).
const STORE_LOCKED = true;
const PREVIEW_COOKIE = 'wtw_preview';
const OPEN_PATHS = ['/presale', '/admin', '/api', '/auth', '/account', '/privacy', '/terms', '/og', '/robots.txt', '/sitemap.xml', '/manifest', '/_vercel'];

function presaleGate(request: NextRequest): NextResponse | null {
  if (!STORE_LOCKED) return null;
  const { pathname, searchParams } = request.nextUrl;
  const preview = searchParams.get('preview');
  if (preview === '1' || preview === '0') {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete('preview');
    const res = NextResponse.redirect(clean);
    if (preview === '1') res.cookies.set(PREVIEW_COOKIE, '1', { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
    else res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }
  if (request.cookies.get(PREVIEW_COOKIE)?.value === '1') return null;
  if (OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const to = request.nextUrl.clone();
  to.pathname = '/presale';
  to.search = '';
  return NextResponse.redirect(to, 307);
}

export async function middleware(request: NextRequest) {
  const gated = presaleGate(request);
  if (gated) return gated;
  // Strict per-request CSP for the sensitive dynamic routes. The nonce goes on the *request* so Next.js
  // stamps it onto its own scripts, and on the response so the browser enforces it.
  let csp: string | null = null;
  if (isSensitivePath(request.nextUrl.pathname)) {
    const nonce = btoa(crypto.randomUUID());
    csp = nonceCsp(nonce);
    request.headers.set('x-nonce', nonce);
    request.headers.set('Content-Security-Policy', csp);
  }
  const finish = (res: NextResponse) => { if (csp) res.headers.set('Content-Security-Policy', csp); return res; };
  return finish(await refreshSession(request));
}

async function refreshSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  if (!data.user && (pathname.startsWith('/account') || pathname.startsWith('/admin'))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/auth/sign-in';
    redirect.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|designs/|placeholders/|mockups/|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)'],
};
