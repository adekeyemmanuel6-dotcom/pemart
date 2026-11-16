import 'server-only';
import { unstable_cache } from 'next/cache';
import { getRpc } from '@/lib/db';
import { resolvePresale, type PresaleConfig } from './schema';

/**
 * The pre-sale settings the storefront shows. Cached; the admin calls revalidateTag('presale') on save.
 * Never throws: with no database, or before migration 0023 is applied, the pre-sale is simply off.
 */
export const getPresaleConfig = unstable_cache(
  async (): Promise<PresaleConfig> => {
    try {
      const rpc = await getRpc();
      if (!rpc) return resolvePresale({});
      const r = await rpc<Record<string, unknown>>('presale_config_get', {});
      return resolvePresale(r.error ? {} : r.data);
    } catch {
      return resolvePresale({});
    }
  },
  ['presale-config-v1'],
  { tags: ['presale'], revalidate: 300 },
);
