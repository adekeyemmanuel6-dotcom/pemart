'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { signInWithGoogle, signUpWithPassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function SignUpForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpWithPassword, null);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <div><Label htmlFor="su-name">Full name</Label><Input id="su-name" name="name" defaultValue={state?.name} autoComplete="name" required /></div>
        <div><Label htmlFor="su-email">Email</Label><Input id="su-email" name="email" defaultValue={state?.email} type="email" autoComplete="email" required /></div>
        <div><Label htmlFor="su-password">Password</Label><Input id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="su-hint su-status" /><p id="su-hint" className="mt-1 text-sm text-muted">At least 8 characters.</p></div>
        <Button type="submit" className="w-full" disabled={pending || disabled}>{pending ? 'Creating…' : 'Create account'}</Button>
        <p id="su-status" role="status" aria-live="polite" className={`min-h-5 text-sm ${state?.ok ? 'text-mocha' : 'text-ember'}`}>{state?.message}</p>
        <p className="text-sm">Already have an account? <Link href="/auth/sign-in" className="font-semibold underline">Sign in</Link></p>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full" disabled={disabled}>Continue with Google</Button>
      </form>
    </div>
  );
}
