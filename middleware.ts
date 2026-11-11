import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase session fresh and gently redirects visitors who are not
 * signed in away from /account and /admin. This is a convenience only: every
 * page, server action and RLS policy re-checks access on the server.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

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
