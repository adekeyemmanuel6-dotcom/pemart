'use client';
import { useActionState } from 'react';
import { sendMagicLink, signInWithGoogle, signInWithPassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(sendMagicLink, null);
  const [pw, pwAction, pwPending] = useActionState<AuthState, FormData>(signInWithPassword, null);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" defaultValue={state?.email} type="email" autoComplete="email" required placeholder="you@email.com" aria-describedby="sign-in-status" />
        </div>
        <Button type="submit" className="w-full" disabled={pending || disabled}>{pending ? 'Sending…' : 'Email me a sign-in link'}</Button>
        <p id="sign-in-status" role="status" aria-live="polite" className={`min-h-5 text-sm ${state?.ok ? 'text-mocha' : 'text-ember'}`}>{state?.message}</p>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full" disabled={disabled}>Continue with Google</Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form action={pwAction} className="space-y-3" noValidate aria-label="Sign in with a password">
        <input type="hidden" name="next" value={next} />
        <div><Label htmlFor="pw-email">Email</Label><Input id="pw-email" name="email" defaultValue={pw?.email} type="email" autoComplete="username" /></div>
        <div><Label htmlFor="pw-password">Password</Label><Input id="pw-password" name="password" type="password" autoComplete="current-password" /></div>
        <Button type="submit" variant="secondary" className="w-full" disabled={pwPending || disabled}>{pwPending ? 'Signing in…' : 'Sign in with password'}</Button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-ember">{pw?.message}</p>
      </form>
    </div>
  );
}
