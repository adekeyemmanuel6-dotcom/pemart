'use client';
import { useActionState } from 'react';
import { trackOrderAction, type TrackState } from '@/lib/actions/orders';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrderAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div><Label htmlFor="number">Order number</Label><Input id="number" name="number" defaultValue={state?.number} placeholder="PM-10001" autoCapitalize="characters" autoComplete="off" required /></div>
      <div><Label htmlFor="contact">Email or phone you ordered with</Label><Input id="contact" name="contact" defaultValue={state?.contact} placeholder="you@email.com or 0803 123 4567" autoComplete="email" required /></div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-ember">{state?.message}</p>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? 'Looking…' : 'Track my order'}</Button>
    </form>
  );
}
