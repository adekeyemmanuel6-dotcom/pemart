import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrivilegedProfile } from '@/lib/auth';
import { getAccess } from '@/lib/admin/db';
import { can, type Permission } from '@/lib/admin/permissions';
import { dbMode } from '@/lib/db';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKETS = {
  proofs: { name: 'proofs', perms: ['fulfilment', 'orders'] as Permission[], ext: ['png', 'jpg', 'jpeg', 'pdf', 'webp'] },
  catalogue: { name: 'product-images', perms: ['catalogue', 'content'] as Permission[], ext: ['png', 'jpg', 'jpeg', 'webp', 'svg'] },
} as const;
const schema = z.object({ bucket: z.enum(['proofs', 'catalogue']), filename: z.string().min(1).max(120), size: z.number().int().positive().max(20 * 1024 * 1024) });

/**
 * Staff/admin uploads. POST asks for an upload slot (role checked here); with Supabase it returns a one-time signed URL,
 * in local development it points at the PUT handler below, which writes into ./public/uploads (never available in production).
 */
export async function POST(request: NextRequest) {
  // Staff/admin with a two-factor session only.
  const me = await getPrivilegedProfile();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!(await rateLimit(`admin-upload:${me.id}`, 60, 10 * 60_000)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const b = BUCKETS[parsed.data.bucket];
  if (!can(await getAccess(me), b.perms)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const ext = parsed.data.filename.split('.').pop()?.toLowerCase() ?? '';
  if (!(b.ext as readonly string[]).includes(ext)) return NextResponse.json({ error: 'type', message: `Allowed: ${b.ext.join(', ')}` }, { status: 415 });
  const safe = parsed.data.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  const key = `${parsed.data.bucket === 'proofs' ? 'proof' : 'img'}-${crypto.randomUUID().slice(0, 8)}-${safe}`;

  if (isSupabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await createAdminClient().storage.from(b.name).createSignedUploadUrl(key);
    if (error || !data) return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
    const publicUrl = parsed.data.bucket === 'catalogue' ? `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${b.name}/${data.path}` : null;
    return NextResponse.json({ mode: 'supabase', bucket: b.name, path: data.path, token: data.token, publicUrl });
  }
  if (dbMode() === 'pg') return NextResponse.json({ mode: 'dev', uploadUrl: `/api/admin/upload?name=${encodeURIComponent(key)}`, path: `/uploads/${key}`, publicUrl: `/uploads/${key}` });
  return NextResponse.json({ error: 'not_configured', message: 'Storage is not connected yet.' }, { status: 503 });
}

/** DEV ONLY: store the file under public/uploads so it can be served locally. */
export async function PUT(request: NextRequest) {
  if (dbMode() !== 'pg') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const me = await getPrivilegedProfile();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const name = (request.nextUrl.searchParams.get('name') ?? '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!name) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'size' }, { status: 413 });
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ ok: true });
}
