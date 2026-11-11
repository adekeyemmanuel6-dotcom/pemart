'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { claimPopupOffer } from '@/lib/actions/offer-popup';
import type { OfferState } from '@/lib/actions/offer';
import { useBag } from '@/lib/cart-store';
import { COOKIE_BANNER, useConsent } from '@/lib/consent';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

const SEEN = 'pemart-offer-seen';
const DELAY_MS = 20_000;
// Never interrupt someone who is paying, reading an order, or already signed in to their account.
const QUIET = ['/checkout', '/order', '/account', '/bag', '/auth', '/track'];

/** First-order offer: after 20 s on the site. Shown once per device. */
export function OfferPopup() {
  const pathname = usePathname();
  const consent = useConsent();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<OfferState, FormData>(claimPopupOffer, null);
  const quiet = QUIET.some((q) => pathname.startsWith(q));
  const decided = !COOKIE_BANNER || (consent !== undefined && consent !== null); // if the cookie banner is on, wait until it is answered

  useEffect(() => {
    if (!decided || quiet) return;
    const seen = () => { try { return !!window.localStorage.getItem(SEEN) || !!window.sessionStorage.getItem(SEEN); } catch { return false; } };
    if (seen()) return;
    // Timed only. (An exit-intent trigger fired whenever the mouse moved up to the address bar, so it was dropped.)
    const timer = window.setTimeout(() => {
      if (seen()) return;
      setOpen(true);
      const now = new Date().toISOString();
      try { window.localStorage.setItem(SEEN, now); } catch { /* ignore */ }
      try { window.sessionStorage.setItem(SEEN, now); } catch { /* ignore */ }
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [decided, quiet]);

  const code = state?.ok ? state.code : undefined;
  useEffect(() => { if (code) useBag.getState().setCodes(code, useBag.getState().giftCode); }, [code]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade fixed inset-0 z-[70] bg-ink/60" />
        <Dialog.Content aria-describedby="offer-desc" className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-paper p-6 shadow-2xl">
          <Dialog.Close className="absolute right-2 top-2 grid size-12 place-items-center rounded-btn hover:bg-sand" aria-label="Close"><X className="size-6" aria-hidden /></Dialog.Close>
          <p className="font-script text-3xl text-mocha">welcome</p>
          <Dialog.Title className="display text-5xl">10% off your first order</Dialog.Title>
          {code ? (
            <div id="offer-desc" role="status" className="mt-4">
              <p className="text-muted">{state?.message}</p>
              <p className="my-3 rounded-lg border-2 border-dashed border-ink py-3 text-center text-3xl font-bold tracking-widest">{code}</p>
              <p className="text-sm text-muted">We have added it to your bag. It works once.</p>
              <Dialog.Close asChild><Button className="mt-4 w-full">Start shopping</Button></Dialog.Close>
            </div>
          ) : (
            <form action={action} noValidate className="mt-3 space-y-3">
              <p id="offer-desc" className="text-muted">Join Pemart and we will send you a single-use code. Use your email or your phone number.</p>
              <div><Label htmlFor="offer-email">Email</Label><Input id="offer-email" name="email" type="email" autoComplete="email" defaultValue={state?.email} placeholder="you@email.com" /></div>
              <div><Label htmlFor="offer-phone">Or phone (WhatsApp)</Label><Input id="offer-phone" name="phone" type="tel" autoComplete="tel" defaultValue={state?.phone} placeholder="0803 000 0000" /></div>
              {state && !state.ok && <p role="alert" className="text-sm text-ember">{state.message}</p>}
              <Button type="submit" disabled={pending} className="w-full">{pending ? 'Getting your code…' : 'Get my code'}</Button>
              <p className="text-xs text-muted">By joining you agree to get occasional offers from Pemart. Unsubscribe any time. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
