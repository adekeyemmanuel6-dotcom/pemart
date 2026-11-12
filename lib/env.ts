import { z } from 'zod';

/**
 * Public values are read with static property access so Next.js can inline them
 * into the browser bundle. Server secrets are read only through serverEnv(),
 * which throws if called from client code.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  // Accept both legacy projects and current Supabase/Vercel integration keys.
  // Keep static NEXT_PUBLIC accesses so Next can inline the browser-safe key.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

/** True once a Supabase project URL and anon key are present. The shell renders without it. */
export const isSupabaseConfigured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function serverEnv() {
  if (typeof window !== 'undefined') throw new Error('serverEnv() must not be called in the browser');
  return serverSchema.parse({ SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY });
}
