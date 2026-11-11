import 'server-only';
import { revalidatePath } from 'next/cache';
import { friendlyError } from './db';
import type { AdminResult } from './types';

/** Wrap an action body: turn thrown errors into a friendly message instead of a crash. */
export async function run(path: string | string[], body: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    const r = await body();
    for (const p of Array.isArray(path) ? path : [path]) revalidatePath(p);
    return r;
  } catch (e) {
    // redirect() and notFound() work by throwing; let those through.
    if (typeof e === 'object' && e && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_')) throw e;
    return { ok: false, message: friendlyError(e) };
  }
}
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const optStr = (fd: FormData, k: string) => { const v = str(fd, k); return v === '' ? null : v; };
export const int = (fd: FormData, k: string) => { const v = str(fd, k); return v === '' ? null : Math.round(Number(v)); };
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on';
/** Naira typed in a form (e.g. "22,000" or "22000.50") to kobo, without float drift. */
export const kobo = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/[,₦\s]/g, '');
  if (v === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new Error(`Enter ${k.replace(/_/g, ' ')} as a Naira amount, like 22000`);
  const [n, f = ''] = v.split('.');
  return Number(n) * 100 + Number(f.padEnd(2, '0'));
};
export const list = (fd: FormData, k: string) => str(fd, k).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
/** A date or datetime-local value typed in Lagos time (UTC+1 all year) -> ISO with the offset. Dates become start or end of that day. */
export const lagosDt = (fd: FormData, k: string, endOfDay = false) => {
  const v = str(fd, k);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T${endOfDay ? '23:59:59' : '00:00:00'}+01:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00+01:00`;
  throw new Error('Enter a valid date');
};
