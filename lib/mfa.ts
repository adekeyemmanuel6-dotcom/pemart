import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { dbMode } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/env';

export type Assurance = 'aal2' | 'needs-verify' | 'needs-enrol';

/**
 * Whether the current session has passed two-factor authentication (Supabase "aal2").
 * Staff and admins must be at aal2 to use any admin page, action or upload.
 *  - needs-enrol: no verified authenticator yet, so they must set one up
 *  - needs-verify: an authenticator exists but this session has not entered a code yet
 * Local Postgres development mode has no Supabase Auth, so it is exempt there (never in production).
 */
export async function sessionAssurance(): Promise<Assurance> {
  if (dbMode() === 'pg' && process.env.NODE_ENV !== 'production') return 'aal2';
  if (!isSupabaseConfigured) return 'needs-enrol';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return 'needs-enrol';
  if (data.currentLevel === 'aal2') return 'aal2';
  return data.nextLevel === 'aal2' ? 'needs-verify' : 'needs-enrol';
}

export const mfaPath = (next: string) => `/auth/mfa?next=${encodeURIComponent(next)}`;
