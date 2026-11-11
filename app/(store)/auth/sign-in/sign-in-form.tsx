'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { signInWithGoogle, signInWithPassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithPassword, null);
  const q = next && next !== '/account' ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" defaultValue={state?.email} type="email" autoComplete="username" required placeholder="you@email.com" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby="sign-in-status" /></div>
        <Button type="submit" className="w-full" disabled={pending || disabled}>{pending ? 'Signing in…' : 'Sign in'}</Button>
        <p id="sign-in-status" role="status" aria-live="polite" className="min-h-5 text-sm text-ember">{state?.message}</p>
        <p className="flex justify-between text-sm"><Link href="/auth/forgot" className="font-semibold underline">Forgot password?</Link><Link href={`/auth/sign-up${q}`} className="font-semibold underline">Create an account</Link></p>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full" disabled={disabled}>Continue with Google</Button>
      </form>
    </div>
  );
}
