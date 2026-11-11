import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Placeholder for pages that land in later phases, so the navigation never dead-ends. */
export function ComingSoon({ title, phase, note }: { title: string; phase: number; note?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <p className="font-script text-3xl text-mocha">coming up</p>
      <h1 className="display mt-1 text-5xl sm:text-6xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">{note ?? 'This page is built in a later phase of the Pemart build.'} (Phase {phase})</p>
      <Button asChild className="mt-8"><Link href="/">Back home</Link></Button>
    </section>
  );
}
