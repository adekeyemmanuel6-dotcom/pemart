'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, type AuthState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <div><Label htmlFor="fg-email">Email</Label><Input id="fg-email" name="email" defaultValue={state?.email} type="email" autoComplete="email" required aria-describedby="fg-status" /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>
      <p id="fg-status" role="status" aria-live="polite" className={`min-h-5 text-sm ${state?.ok ? 'text-mocha' : 'text-ember'}`}>{state?.message}</p>
      <p className="text-sm"><Link href="/auth/sign-in" className="font-semibold underline">Back to sign in</Link></p>
    </form>
  );
}
