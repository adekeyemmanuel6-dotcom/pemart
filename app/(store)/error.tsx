'use client';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6" role="alert">
      <p className="font-script text-3xl text-mocha">oops</p>
      <h1 className="display text-5xl">Something went wrong</h1>
      <p className="mt-3 text-muted">That was on us, not you. Try again, and if it keeps happening, message us on WhatsApp.</p>
      <Button className="mt-8" onClick={reset}>Try again</Button>
    </section>
  );
}
