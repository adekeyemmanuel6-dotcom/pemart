'use client';
import { useActionState } from 'react';
import { signInWithPassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function PasswordForm({ next }: { next: string }) {
  const [pw, action, pending] = useActionState<AuthState, FormData>(signInWithPassword, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <div><Label htmlFor="pw-email">Email</Label><Input id="pw-email" name="email" defaultValue={pw?.email} type="email" autoComplete="username" /></div>
      <div><Label htmlFor="pw-password">Password</Label><Input id="pw-password" name="password" type="password" autoComplete="current-password" /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ember">{pw?.message}</p>
    </form>
  );
}
