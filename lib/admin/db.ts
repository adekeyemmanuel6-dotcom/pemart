import 'server-only';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { getRpc } from '@/lib/db';
import { requireAdmin, requireStaff, type Profile } from '@/lib/auth';

export class AdminError extends Error { constructor(public code: string) { super(code); } }

/**
 * The one way admin pages and actions talk to the database. The actor id comes from the server-verified session,
 * and every SQL function re-checks that profile's role in the database itself (a second gate behind the page gate).
 */
export async function adm<T = unknown>(fn: string, actor: Profile, args: Record<string, unknown> = {}): Promise<T> {
  const rpc = await getRpc();
  if (!rpc) throw new AdminError('no_database');
  const r = await rpc<T>(fn, { ...args, actor: actor.id });
  if (r.error) {
    if (r.error.message.includes('forbidden')) redirect('/admin?denied=1');
    throw new AdminError(r.error.message.replace(/^.*?ERROR:\s*/, '').split('\n')[0] ?? 'db_error');
  }
  return r.data as T;
}

export { requireAdmin, requireStaff };
/** After catalogue or settings edits the storefront's cached copies must refresh. */
export const refreshStorefront = () => { revalidateTag('catalogue'); revalidateTag('settings'); };

export const friendlyError = (e: unknown) => {
  const m = e instanceof AdminError ? e.code : String((e as Error)?.message ?? e);
  if (/duplicate key|unique/i.test(m)) return 'That name, slug or code is already used.';
  if (/violates check constraint/i.test(m)) return 'One of the values is not allowed. Please check the form.';
  if (/foreign key/i.test(m)) return 'That item is still used elsewhere.';
  if (m === 'no_database') return 'The database is not connected.';
  return m.length < 120 ? m : 'Something went wrong.';
};

/** True when a database function this screen needs has not been created yet (its migration is not applied). */
export const isMissingFunction = (e: unknown) =>
  /could not find the function|function .* does not exist|schema cache/i.test(e instanceof AdminError ? e.code : String((e as Error)?.message ?? e));
