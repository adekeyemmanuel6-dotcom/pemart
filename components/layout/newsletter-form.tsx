'use client';
import { useActionState } from 'react';
import { subscribeNewsletter, type NewsletterState } from '@/lib/actions/newsletter';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, null);
  return (
    <form action={action} className="w-full max-w-md" noValidate>
      <Label htmlFor="newsletter-email" className="text-paper">Get 10% off your first order</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="newsletter-email" name="email" type="email" autoComplete="email" placeholder="you@email.com" required aria-describedby="newsletter-status" className="border-paper/30 bg-paper/10 text-paper placeholder:text-paper/60" />
        <Button type="submit" disabled={pending} className="bg-paper text-ink hover:bg-sand sm:w-auto">{pending ? 'Joining…' : 'Join'}</Button>
      </div>
      <p id="newsletter-status" role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${state?.ok ? 'text-sand' : 'text-[#ffb59c]'}`}>{state?.message}</p>
    </form>
  );
}
