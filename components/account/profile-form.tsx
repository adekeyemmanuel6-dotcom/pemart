'use client';
import { useActionState } from 'react';
import { updateProfileAction, type AccountState } from '@/lib/actions/account';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfileAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div><Label htmlFor="p-name">Full name</Label><Input id="p-name" name="full_name" defaultValue={state?.values?.full_name ?? name} autoComplete="name" /></div>
      <div><Label htmlFor="p-phone">Phone</Label><Input id="p-phone" name="phone" type="tel" defaultValue={state?.values?.phone ?? phone} autoComplete="tel" aria-invalid={!!state?.fieldErrors?.phone || undefined} />{state?.fieldErrors?.phone && <p role="alert" className="mt-1 text-sm text-ember">{state.fieldErrors.phone}</p>}</div>
      <div className="sm:col-span-2"><Label htmlFor="p-email">Email</Label><Input id="p-email" value={email} readOnly disabled /></div>
      <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button><p role="status" aria-live="polite" className={`text-sm ${state?.ok ? 'text-mocha' : 'text-ember'}`}>{state?.message}</p></div>
    </form>
  );
}
