'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

type Setup = { factorId: string; qr: string; secret: string };
const GENERIC = 'That code did not work. Check the time on your phone is set automatically and try the newest code.';

/**
 * Talks to Supabase Auth MFA directly from the browser so the upgraded (aal2) session cookies are written
 * by the Supabase client itself. The server re-checks the level on every admin request.
 */
export function MfaForm({ mode, next, email }: { mode: 'enrol' | 'verify'; next: string; email: string | null }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const started = useRef(false); // React strict mode runs effects twice in development: enrol only once

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = createClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) { setError('Could not load your security settings. Refresh the page to try again.'); setLoading(false); return; }
      if (mode === 'verify') {
        const factor = data.totp.find((f) => f.status === 'verified');
        if (factor) setFactorId(factor.id);
        else setError('No authenticator is set up for this account. Refresh the page to set one up.');
        setLoading(false);
        return;
      }
      // Clear abandoned set-up attempts so a fresh QR code can be issued.
      for (const f of data.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Wear The Word admin', issuer: 'Wear The Word' });
      if (enrolError || !enrolled) setError('Could not start set-up. Refresh the page to try again.');
      else { setSetup({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret }); setFactorId(enrolled.id); }
      setLoading(false);
    })();
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || busy) return;
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) { setError(GENERIC); setBusy(false); setCode(''); return; }
    // Full navigation so the server reads the upgraded session cookies.
    window.location.assign(next);
  }

  if (loading) return <p role="status" className="text-muted">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {setup && (
        <div className="border border-line bg-white p-5">
          <p className="text-sm font-semibold">1. Scan this code</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an inline SVG data URL */}
          <img src={setup.qr} alt={`QR code to add ${email ?? 'this account'} to an authenticator app`} width={192} height={192} className="mx-auto my-4 size-48" />
          <p className="text-sm text-muted">Can&apos;t scan? Enter this key in your app instead:</p>
          <p className="mt-1 break-all font-mono text-sm tracking-wider select-all">{setup.secret}</p>
          <p className="mt-5 text-sm font-semibold">2. Enter the 6-digit code it shows</p>
        </div>
      )}
      {factorId && (
        <div>
          <Label htmlFor="code">Authentication code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={!!error}
            aria-describedby={error ? 'code-error' : undefined}
            autoFocus
            className="text-center font-mono text-2xl tracking-[0.5em]"
          />
        </div>
      )}
      {error && <p id="code-error" role="alert" className="text-sm text-ember">{error}</p>}
      {factorId && (
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : mode === 'enrol' ? 'Turn on two-factor' : 'Continue to admin'}
        </Button>
      )}
    </form>
  );
}
