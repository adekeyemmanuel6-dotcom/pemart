'use client';
import { useActionState } from 'react';
import { updatePassword, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <div><Label htmlFor="rs-password">New password</Label><Input id="rs-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div><Label htmlFor="rs-confirm">Confirm password</Label><Input id="rs-confirm" name="confirm" type="password" autoComplete="new-password" required aria-describedby="rs-status" /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Saving…' : 'Save password'}</Button>
      <p id="rs-status" role="status" aria-live="polite" className="min-h-5 text-sm text-ember">{state?.message}</p>
    </form>
  );
}
