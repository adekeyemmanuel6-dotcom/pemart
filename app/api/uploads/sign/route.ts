import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { UPLOAD_RULES } from '@/lib/custom/tiers';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKETS = { custom: 'design-uploads', bulk: 'bulk-uploads', review: 'review-photos' } as const;
const EXT_OK = new Set(['png', 'jpg', 'jpeg', 'pdf', 'svg']);

const schema = z.object({
  bucket: z.enum(['custom', 'bulk', 'review']),
  filename: z.string().min(1).max(120),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/**
 * Returns a one-time signed upload URL for a PRIVATE bucket. The browser uploads
 * straight to storage; the file never passes through our server. Type and size
 * rules are enforced here, before any URL is issued.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`upload:${ip}`, 20, 10 * 60_000).ok) return NextResponse.json({ error: 'rate_limited', message: 'Too many uploads. Please wait a few minutes.' }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid', message: 'Invalid upload request.' }, { status: 400 });
  const { bucket, filename, contentType, size } = parsed.data;

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  // Review photos are public, so only plain images are accepted (no SVG or PDF).
  if (bucket === 'review' && !['png', 'jpg', 'jpeg'].includes(ext)) return NextResponse.json({ error: 'type', message: 'Please upload a PNG or JPG photo.' }, { status: 415 });
  if (!EXT_OK.has(ext) || !UPLOAD_RULES.types[contentType === 'image/jpg' ? 'image/jpeg' : contentType])
    return NextResponse.json({ error: 'type', message: 'Please upload a PNG, JPG, PDF or SVG file.' }, { status: 415 });
  if (size > UPLOAD_RULES.maxBytes) return NextResponse.json({ error: 'size', message: 'That file is over 20MB. Please upload a smaller one.' }, { status: 413 });

  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  const path = `guest/${crypto.randomUUID()}/${safe}`;
  const { data, error } = await createAdminClient().storage.from(BUCKETS[bucket]).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'sign_failed', message: 'Could not start the upload. Please try again.' }, { status: 500 });
  return NextResponse.json({ bucket: BUCKETS[bucket], path: data.path, token: data.token });
}
