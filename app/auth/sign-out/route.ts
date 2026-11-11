import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { DEV_COOKIE } from '@/lib/dev-auth';

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured) await (await createClient()).auth.signOut();
  const res = NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 });
  res.cookies.delete(DEV_COOKIE);
  return res;
}
