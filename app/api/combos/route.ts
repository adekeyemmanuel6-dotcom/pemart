import { NextResponse } from 'next/server';
import { getComboCatalogue } from '@/lib/combos/server';

/** The published combo collections for the calculator: selling prices and rules only. Internal costs are not in this data. */
export async function GET() {
  const cat = await getComboCatalogue();
  return NextResponse.json(cat, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
