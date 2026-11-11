'use client';
import { useActionState } from 'react';
import { subscribeNewsletter, type NewsletterState } from '@/lib/actions/newsletter';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function NewsletterForm({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, null);
  return (
    <form action={action} className="w-full max-w-md" noValidate>
      <Label htmlFor={`newsletter-${tone}`} className={dark ? 'text-paper' : undefined}>Get 10% off your first order</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id={`newsletter-${tone}`} name="email" defaultValue={state?.email} type="email" autoComplete="email" placeholder="you@email.com" required aria-describedby={`newsletter-status-${tone}`} className={dark ? 'border-paper/30 bg-paper/10 text-paper placeholder:text-paper/60' : undefined} />
        <Button type="submit" disabled={pending} className={dark ? 'bg-paper text-ink hover:bg-sand sm:w-auto' : 'sm:w-auto'}>{pending ? 'Joining…' : 'Join'}</Button>
      </div>
      <p id={`newsletter-status-${tone}`} role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${state?.ok ? (dark ? 'text-sand' : 'text-mocha') : dark ? 'text-[#ffb59c]' : 'text-ember'}`}>{state?.message}</p>
    </form>
  );
}
