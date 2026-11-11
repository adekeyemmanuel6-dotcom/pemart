import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="font-script text-3xl text-mocha">lost?</p>
      <h1 className="display text-6xl">Page not found</h1>
      <p className="mt-3 text-muted">That page has moved or never existed. Let&apos;s get you back to something good.</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/collections/all">Shop all</Link></Button><Button asChild variant="secondary"><Link href="/">Go home</Link></Button></div>
    </section>
  );
}
