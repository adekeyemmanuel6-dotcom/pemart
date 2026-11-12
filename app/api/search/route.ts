import { NextResponse, type NextRequest } from 'next/server';
import { getCatalogue } from '@/lib/catalogue/load';
import { searchLocal, toCollection, toProduct, type SearchResult } from '@/lib/catalogue/search';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { pickClientIp } from '@/lib/client-ip';
import { createPublicClient } from '@/lib/supabase/public';

export async function GET(request: NextRequest) {
  const ip = pickClientIp(request.headers);
  if (!(await rateLimit(`search:${ip}`, 90, 60_000)).ok) return NextResponse.json({ results: [], error: 'rate_limited' }, { status: 429 });

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const cat = await getCatalogue();

  let results: SearchResult[] = [];
  if (isSupabaseConfigured) {
    // Postgres full-text search (prefix matching plus a trigram fallback for typos).
    const { data, error } = await createPublicClient().rpc('search_catalogue', { q, max_results: 12 });
    if (!error && data) {
      results = (data as { kind: string; slug: string; name: string }[])
        .map((r) => (r.kind === 'collection' ? toCollection(r.slug, r.name) : toProduct(cat, r.slug)))
        .filter((r): r is SearchResult => !!r);
    } else results = searchLocal(cat, q);
  } else results = searchLocal(cat, q);

  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
